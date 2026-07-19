"use strict";

const fs = require("fs");

const BASE = (process.env.ASHENHOLD_BASE || "https://dragon-browser-nine.vercel.app/").replace(/\/?$/, "/");

async function request(path) {
  const response = await fetch(new URL(path.replace(/^\//, ""), BASE), { redirect: "manual" });
  return {
    path,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text()
  };
}

(async () => {
  const [root, app, monster, normal, manifest] = await Promise.all([
    request("/"),
    request("/app.js"),
    request("/assets/models/quaternius-monsters/tribal.gltf"),
    request("/assets/textures/biomes/jungle-normal.jpg"),
    request("/manifest.json")
  ]);
  const forbiddenPaths = [
    "/AGENTS.md",
    "/GAME-DEVELOPER-GUIDE.md",
    "/README.md",
    "/test-results/production-audit.cjs",
    "/tools/strip-gltf-noop.js",
    "/assets/dragons.png",
    "/.vercel/project.json"
  ];
  const forbidden = await Promise.all(forbiddenPaths.map(request));
  const csp = root.headers["content-security-policy"] || "";
  const checks = {
    root200: root.status === 200 && /ASHENHOLD/i.test(root.body),
    releaseMarker: app.status === 200 && /WORLD_LAYOUT_VERSION\s*=\s*5/.test(app.body) && /skillNodes/.test(app.body),
    monster200: monster.status === 200 && /"animations"\s*:/.test(monster.body),
    pbrNormal200: normal.status === 200 && Number(normal.headers["content-length"] || normal.body.length) > 100000,
    manifest200: manifest.status === 200 && /Ashenhold/.test(manifest.body),
    contentSecurityPolicy: csp.includes("default-src 'self'") && csp.includes("connect-src 'self' blob:") && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"),
    nosniff: root.headers["x-content-type-options"] === "nosniff",
    frameDenied: root.headers["x-frame-options"] === "DENY",
    permissionsRestricted: /camera=\(\)/.test(root.headers["permissions-policy"] || ""),
    rootRevalidates: /no-cache|max-age=0.*must-revalidate/.test(root.headers["cache-control"] || ""),
    assetCaching: /max-age=86400/.test(monster.headers["cache-control"] || ""),
    forbiddenFiles404: forbidden.every((result) => result.status === 404)
  };
  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    checks,
    statuses: {
      root: root.status,
      app: app.status,
      monster: monster.status,
      normal: normal.status,
      manifest: manifest.status,
      forbidden: Object.fromEntries(forbidden.map((result) => [result.path, result.status]))
    },
    selectedHeaders: {
      cacheControl: root.headers["cache-control"],
      csp: root.headers["content-security-policy"],
      contentTypeOptions: root.headers["x-content-type-options"],
      frameOptions: root.headers["x-frame-options"],
      permissionsPolicy: root.headers["permissions-policy"],
      assetCacheControl: monster.headers["cache-control"]
    }
  };
  fs.writeFileSync("test-results/live-deployment-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(checks).some((value) => !value)) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
