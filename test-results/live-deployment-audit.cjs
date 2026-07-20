"use strict";

const fs = require("fs");

const BASE = (process.env.ASHENHOLD_BASE || "https://brornski.github.io/ashenhold-dragonfall/").replace(/\/?$/, "/");
const baseUrl = new URL(BASE);
const isGitHubPages = baseUrl.hostname.endsWith("github.io");

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

function scriptsLoadInOrder(html, paths) {
  let cursor = -1;
  return paths.every((path) => {
    const next = html.indexOf(`src="${path}"`, cursor + 1);
    if (next < 0) return false;
    cursor = next;
    return true;
  });
}

(async () => {
  const [root, app, monster, warden, normal, manifest, ...moduleResponses] = await Promise.all([
    request("/"),
    request("/app.js"),
    request("/assets/models/quaternius-monsters/tribal.gltf"),
    request("/assets/models/quaternius-rpg-character/warden.gltf"),
    request("/assets/textures/biomes/jungle-normal.jpg"),
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
    "/.vercel/project.json"
  ];
  const forbidden = await Promise.all(forbiddenPaths.map(request));
  const csp = root.headers["content-security-policy"] || "";
  const moduleResults = Object.fromEntries(multiplayerModules.map(([name, path, marker], index) => {
    const response = moduleResponses[index];
    return [name, { path, status: response.status, marker: marker.test(response.body), headers: response.headers }];
  }));
  const moduleScriptPaths = multiplayerModules.map(([, path]) => path.slice(1));
  const checks = {
    root200: root.status === 200 && /ASHENHOLD/i.test(root.body),
    releaseMarker: app.status === 200 && /WORLD_LAYOUT_VERSION\s*=\s*8/.test(app.body)
      && /WORLD_ID\s*=\s*["']ashenhold-continent-v1["']/.test(app.body) && /fixedWorldDebug/.test(app.body)
      && /biomeZoneDebug/.test(app.body) && /jumpMomentumProbe/.test(app.body) && /strongholdDebug/.test(app.body)
      && /skillNodes/.test(app.body) && /createAncientForest/.test(app.body) && /MODEL_SCALE_TARGETS/.test(app.body)
      && /SKY_PROFILES/.test(app.body) && /multiplayerSnapshot/.test(app.body),
    multiplayerModules200: Object.values(moduleResults).every((result) => result.status === 200 && result.marker),
    multiplayerScriptsOrdered: scriptsLoadInOrder(root.body, [...moduleScriptPaths, "app.js"]),
    multiplayerEndpointDeclared: /<meta\s+name=["']ashenhold-multiplayer-url["']\s+content=["']wss:\/\/multiplayer-server-weld\.vercel\.app\/api\/ws["']/i.test(root.body),
    monster200: monster.status === 200 && /"animations"\s*:/.test(monster.body),
    fullWardenModel200: warden.status === 200 && /"animations"\s*:/.test(warden.body),
    pbrNormal200: normal.status === 200 && Number(normal.headers["content-length"] || normal.body.length) > 100000,
    manifest200: manifest.status === 200 && /Ashenhold/.test(manifest.body),
    secureOrigin: baseUrl.protocol === "https:",
    forbiddenFiles404: forbidden.every((result) => result.status === 404)
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
      monster: monster.status,
      warden: warden.status,
      normal: normal.status,
      manifest: manifest.status,
      multiplayerModules: Object.fromEntries(Object.entries(moduleResults).map(([name, result]) => [name, result.status])),
      forbidden: Object.fromEntries(forbidden.map((result) => [result.path, result.status]))
    },
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
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
