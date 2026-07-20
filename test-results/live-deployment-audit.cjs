"use strict";

const fs = require("fs");
const vm = require("node:vm");

const BASE = (process.env.ASHENHOLD_BASE || "https://brornski.github.io/ashenhold-dragonfall/").replace(/\/?$/, "/");
const baseUrl = new URL(BASE);
const isGitHubPages = baseUrl.hostname.endsWith("github.io");
const WORLD_OVERRIDE_SCHEMA_VERSION = 1;
const WORLD_SIGNATURE = "ashenhold-authored-continent-8";

async function request(path) {
  const response = await fetch(new URL(path.replace(/^\//, ""), BASE), { redirect: "manual" });
  return {
    path,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text()
  };
}

const multiplayerModules = [
  ["client", "/multiplayer-client.js", /window\.AshenholdMultiplayer\s*=/],
  ["avatars", "/multiplayer-avatars.js", /window\.AshenholdRemoteWardens\s*=/],
  ["game", "/multiplayer-game.js", /window\.AshenholdCoopRuntime\s*=/],
  ["ui", "/multiplayer-ui.js", /window\.AshenholdParty\s*=/]
];

const adminOnlyPaths = [
  "/admin-editor.js",
  "/admin-editor.css",
  "/open-admin-editor.cmd",
  "/tools/ashenhold-admin-server.mjs",
  "/__admin/session"
];

function scriptsLoadInOrder(html, paths) {
  let cursor = -1;
  return paths.every((path) => {
    const next = html.indexOf(`src="${path}"`, cursor + 1);
    if (next < 0) return false;
    cursor = next;
    return true;
  });
}

function isDataOnly(value, seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.every((item) => isDataOnly(item, seen));
  if (Object.prototype.toString.call(value) !== "[object Object]") return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !isDataOnly(descriptor.value, seen)) return false;
  }
  return true;
}

function executableSkeleton(source) {
  let output = "";
  let mode = "code";
  let quote = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (mode === "code") {
      if (character === "/" && next === "/") { output += "  "; index += 1; mode = "line-comment"; continue; }
      if (character === "/" && next === "*") { output += "  "; index += 1; mode = "block-comment"; continue; }
      if (character === '"' || character === "'") { output += " "; quote = character; mode = "string"; continue; }
      output += character;
      continue;
    }
    if (mode === "string") {
      if (character === "\\") { output += "  "; index += 1; continue; }
      if (character === quote) { output += " "; mode = "code"; continue; }
      output += character === "\n" ? "\n" : " ";
      continue;
    }
    if (mode === "line-comment") {
      if (character === "\n") { output += "\n"; mode = "code"; } else output += " ";
      continue;
    }
    if (character === "*" && next === "/") { output += "  "; index += 1; mode = "code"; }
    else output += character === "\n" ? "\n" : " ";
  }
  return output;
}

function inspectWorldOverrides(source) {
  const code = executableSkeleton(source);
  const wrapperOnly = /^\s*\(function\s*\(\)\s*\{/.test(code)
    && /window\.AshenholdWorldOverrides\s*=\s*\{/.test(code)
    && /\}\s*\)\s*\(\s*\)\s*;\s*$/.test(code);
  const singleFunction = (code.match(/\bfunction\b/g) || []).length === 1 && !/=>/.test(code);
  const singleAssignment = (code.match(/=/g) || []).length === 1;
  const singleWindowExport = (code.match(/window\./g) || []).length === 1
    && (code.match(/window\.AshenholdWorldOverrides\s*=/g) || []).length === 1;
  const activeCode = /[`]|\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|Worker|document|navigator|location|localStorage|sessionStorage|indexedDB|eval|Function|setTimeout|setInterval|requestAnimationFrame|require|process|module|exports|import|new|return|if|for|while|switch|try|catch|throw|with|delete|await|yield)\b/.test(code)
    || /(?:__admin|admin-editor|open-admin-editor|ashenhold-admin-server)/i.test(code)
    || /\b[A-Za-z_$][\w$]*\s*\(/.test(code.replace(/\bfunction\s*\(/, ""));
  const sandbox = { window: Object.create(null) };
  let documentValue = null;
  let evaluationError = null;
  try {
    vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
    new vm.Script(source, { filename: "world-overrides.js" }).runInContext(sandbox, { timeout: 100 });
    documentValue = sandbox.window.AshenholdWorldOverrides;
  } catch (error) {
    evaluationError = error.message;
  }
  const topLevelKeys = documentValue && typeof documentValue === "object" ? Object.keys(documentValue).sort() : [];
  const enemyKeys = documentValue?.enemies && typeof documentValue.enemies === "object" ? Object.keys(documentValue.enemies).sort() : [];
  const exactShape = topLevelKeys.join(",") === "biomes,enemies,entities,schemaVersion,worldSignature"
    && enemyKeys.join(",") === "byKind,global";
  const noSideExports = Object.keys(sandbox).join(",") === "window"
    && Object.keys(sandbox.window).join(",") === "AshenholdWorldOverrides";
  const contract = {
    wrapperOnly,
    singleFunction,
    singleAssignment,
    singleWindowExport,
    noActiveCode: !activeCode,
    noSideExports,
    dataOnly: isDataOnly(documentValue),
    exactShape,
    schemaVersion: documentValue?.schemaVersion,
    worldSignature: documentValue?.worldSignature,
    evaluationError
  };
  contract.valid = Object.entries(contract).every(([key, value]) => {
    if (key === "schemaVersion") return value === WORLD_OVERRIDE_SCHEMA_VERSION;
    if (key === "worldSignature") return value === WORLD_SIGNATURE;
    if (key === "evaluationError") return value === null;
    return value === true;
  });
  return contract;
}

async function run() {
  const [root, app, worldOverrides, monster, warden, normal, desertSkybox, moonSkybox, shoreSkybox, snowySkybox, manifest, ...moduleResponses] = await Promise.all([
    request("/"),
    request("/app.js"),
    request("/world-overrides.js"),
    request("/assets/models/quaternius-monsters/tribal.gltf"),
    request("/assets/models/quaternius-rpg-character/warden.gltf"),
    request("/assets/textures/biomes/jungle-normal.jpg"),
    request("/assets/textures/skyboxes/ember-dunes-sandsky-2k.png"),
    request("/assets/textures/skyboxes/moonfall-moonsky-2k.png"),
    request("/assets/textures/skyboxes/drowned-coast-skybox-2k.png"),
    request("/assets/textures/skyboxes/frostbound-skyline-2k.png"),
    request("/manifest.json"),
    ...multiplayerModules.map(([, path]) => request(path))
  ]);
  const forbiddenPaths = [
    "/AGENTS.md",
    "/GAME-DEVELOPER-GUIDE.md",
    "/README.md",
    "/test-results/production-audit.cjs",
    "/tools/strip-gltf-noop.js",
    "/multiplayer-server/package.json",
    "/multiplayer-server/api/ws.js",
    "/assets/dragons.png",
    "/.vercel/project.json",
    ...adminOnlyPaths
  ];
  const forbidden = await Promise.all(forbiddenPaths.map(request));
  const csp = root.headers["content-security-policy"] || "";
  const moduleResults = Object.fromEntries(multiplayerModules.map(([name, path, marker], index) => {
    const response = moduleResponses[index];
    return [name, { path, status: response.status, marker: marker.test(response.body), headers: response.headers }];
  }));
  const moduleScriptPaths = multiplayerModules.map(([, path]) => path.slice(1));
  const overrideContract = inspectWorldOverrides(worldOverrides.body);
  const adminOnlyStatuses = Object.fromEntries(adminOnlyPaths.map((path) => {
    const result = forbidden.find((entry) => entry.path === path);
    return [path, result?.status];
  }));
  const checks = {
    root200: root.status === 200 && /ASHENHOLD/i.test(root.body),
    releaseMarker: app.status === 200 && /WORLD_LAYOUT_VERSION\s*=\s*8/.test(app.body)
      && /WORLD_ID\s*=\s*["']ashenhold-continent-v1["']/.test(app.body) && /fixedWorldDebug/.test(app.body)
      && /biomeZoneDebug/.test(app.body) && /jumpMomentumProbe/.test(app.body) && /strongholdDebug/.test(app.body)
      && /skillNodes/.test(app.body) && /createAncientForest/.test(app.body) && /MODEL_SCALE_TARGETS/.test(app.body)
      && /SKY_PROFILES/.test(app.body) && /multiplayerSnapshot/.test(app.body),
    multiplayerModules200: Object.values(moduleResults).every((result) => result.status === 200 && result.marker),
    worldOverrides200: worldOverrides.status === 200,
    worldOverridesContract: overrideContract.valid,
    worldOverridesBeforeRuntime: scriptsLoadInOrder(root.body, ["world-overrides.js", ...moduleScriptPaths, "app.js"]),
    multiplayerScriptsOrdered: scriptsLoadInOrder(root.body, ["world-overrides.js", ...moduleScriptPaths, "app.js"]),
    multiplayerEndpointDeclared: /<meta\s+name=["']ashenhold-multiplayer-url["']\s+content=["']wss:\/\/multiplayer-server-weld\.vercel\.app\/api\/ws["']/i.test(root.body),
    monster200: monster.status === 200 && /"animations"\s*:/.test(monster.body),
    fullWardenModel200: warden.status === 200 && /"animations"\s*:/.test(warden.body),
    pbrNormal200: normal.status === 200 && Number(normal.headers["content-length"] || normal.body.length) > 100000,
    desertSkybox200: desertSkybox.status === 200 && Number(desertSkybox.headers["content-length"] || desertSkybox.body.length) > 900000,
    moonSkybox200: moonSkybox.status === 200 && Number(moonSkybox.headers["content-length"] || moonSkybox.body.length) > 900000,
    drownedCoastSkybox200: shoreSkybox.status === 200 && Number(shoreSkybox.headers["content-length"] || shoreSkybox.body.length) > 800000,
    frostboundSkybox200: snowySkybox.status === 200 && Number(snowySkybox.headers["content-length"] || snowySkybox.body.length) > 700000,
    manifest200: manifest.status === 200 && /Ashenhold/.test(manifest.body),
    secureOrigin: baseUrl.protocol === "https:",
    forbiddenFiles404: forbidden.every((result) => result.status === 404),
    adminSurfaceAbsent: Object.values(adminOnlyStatuses).every((status) => status === 404)
  };
  if (isGitHubPages) {
    checks.githubPagesHost = baseUrl.hostname === "brornski.github.io";
    checks.projectPath = baseUrl.pathname.startsWith("/ashenhold-dragonfall/");
  } else {
    checks.contentSecurityPolicy = csp.includes("default-src 'self'") && csp.includes("connect-src 'self' blob: wss://multiplayer-server-weld.vercel.app") && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'");
    checks.nosniff = root.headers["x-content-type-options"] === "nosniff";
    checks.frameDenied = root.headers["x-frame-options"] === "DENY";
    checks.permissionsRestricted = /camera=\(\)/.test(root.headers["permissions-policy"] || "");
    checks.rootRevalidates = /no-cache|max-age=0.*must-revalidate/.test(root.headers["cache-control"] || "");
    checks.assetCaching = /max-age=86400/.test(monster.headers["cache-control"] || "");
    checks.multiplayerModuleCaching = Object.values(moduleResults).every((result) => /max-age=3600/.test(result.headers["cache-control"] || ""));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    provider: isGitHubPages ? "github-pages" : "custom-or-vercel",
    checks,
    statuses: {
      root: root.status,
      app: app.status,
      worldOverrides: worldOverrides.status,
      monster: monster.status,
      warden: warden.status,
      normal: normal.status,
      desertSkybox: desertSkybox.status,
      moonSkybox: moonSkybox.status,
      manifest: manifest.status,
      multiplayerModules: Object.fromEntries(Object.entries(moduleResults).map(([name, result]) => [name, result.status])),
      forbidden: Object.fromEntries(forbidden.map((result) => [result.path, result.status])),
      adminOnly: adminOnlyStatuses
    },
    worldOverrides: overrideContract,
    selectedHeaders: {
      cacheControl: root.headers["cache-control"],
      csp: root.headers["content-security-policy"],
      contentTypeOptions: root.headers["x-content-type-options"],
      frameOptions: root.headers["x-frame-options"],
      permissionsPolicy: root.headers["permissions-policy"],
      assetCacheControl: monster.headers["cache-control"],
      multiplayerModuleCacheControl: Object.fromEntries(Object.entries(moduleResults).map(([name, result]) => [name, result.headers["cache-control"]]))
    }
  };
  fs.writeFileSync("test-results/live-deployment-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(checks).some((value) => !value)) process.exit(1);
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { inspectWorldOverrides, isDataOnly, scriptsLoadInOrder };
