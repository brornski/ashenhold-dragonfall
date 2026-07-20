"use strict";

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.ASHENHOLD_ADMIN_PORT || (44000 + process.pid % 1000));
const BASE = `http://127.0.0.1:${PORT}/`;

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForBridge() {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE + "__admin/session");
      if (response.ok) return response.json();
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error("Local admin bridge did not become ready.");
}

async function stopBridgeProcess(bridge) {
  if (!bridge || bridge.exitCode != null) return;
  const waitForExit = (timeout) => new Promise((resolve) => {
    const onExit = () => { clearTimeout(timer); resolve(true); };
    const timer = setTimeout(() => { bridge.off("exit", onExit); resolve(false); }, timeout);
    bridge.once("exit", onExit);
  });
  bridge.kill("SIGTERM");
  if (!await waitForExit(1200) && bridge.exitCode == null) {
    bridge.kill("SIGKILL");
    await waitForExit(1200);
  }
}

(async () => {
  const bridge = spawn(process.execPath, ["tools/ashenhold-admin-server.mjs", `--port=${PORT}`], {
    cwd: ROOT, windowsHide: true, stdio: ["ignore", "pipe", "pipe"]
  });
  let bridgeError = "";
  bridge.stderr.on("data", (chunk) => { bridgeError += chunk.toString(); });
  let browser;
  try {
    const session = await waitForBridge();
    check(session.localOnly && session.token, "Bridge must issue a local ephemeral session token.");
    check(session.publishConfigured === false, "Audit bridge must report that publish capability was not configured.");
    check(!session.publishEnabled, "Audit bridge must not enable publishing without the launch flag.");
    check(path.resolve(session.repositoryRoot) === ROOT && session.repositoryId, "Bridge session must identify the exact worktree it writes.");

    const wrongOrigin = await fetch(BASE + "__admin/session", { headers: { Origin: "https://example.invalid" } });
    check(wrongOrigin.status === 403, "Bridge must reject a non-loopback page origin.");

    const unauthorized = await fetch(BASE + "__admin/validate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
    });
    check(unauthorized.status === 401, "Mutation endpoints must reject missing session tokens.");

    const validDocument = {
      schemaVersion: 1, worldSignature: "ashenhold-authored-continent-8",
      entities: {}, biomes: { desert: { treeDensity: 0 } }, enemies: { global: {}, byKind: {} }
    };
    const validated = await fetch(BASE + "__admin/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Ashenhold-Admin": session.token },
      body: JSON.stringify(validDocument)
    });
    const validationResponse = await validated.json();
    check(validated.ok && validationResponse.valid, "Bridge must validate a bounded editor document without writing it.");

    const wrongWorld = await fetch(BASE + "__admin/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Ashenhold-Admin": session.token },
      body: JSON.stringify(Object.assign({}, validDocument, { worldSignature: "wrong-world" }))
    });
    check(wrongWorld.status === 400, "Bridge must reject a mismatched world signature.");

    const prototypeDocument = '{"schemaVersion":1,"worldSignature":"ashenhold-authored-continent-8","entities":{"__proto__":{"visible":false}},"biomes":{},"enemies":{"global":{},"byKind":{}}}';
    const prototypeResponse = await fetch(BASE + "__admin/validate", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Ashenhold-Admin": session.token }, body: prototypeDocument
    });
    check(prototypeResponse.status === 400, "Bridge must reject prototype-bearing editor data.");

    const traversalDocument = JSON.parse(JSON.stringify(validDocument));
    traversalDocument.entities.bad = { type: "model", texture: "assets/../app.js" };
    const traversalResponse = await fetch(BASE + "__admin/validate", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Ashenhold-Admin": session.token }, body: JSON.stringify(traversalDocument)
    });
    check(traversalResponse.status === 400, "Bridge must reject normalized asset traversal in texture paths.");

    const oversizedResponse = await fetch(BASE + "__admin/validate", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Ashenhold-Admin": session.token }, body: " ".repeat(513 * 1024)
    });
    check(oversizedResponse.status === 413, "Bridge must reject editor bodies above 512 KB.");

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
    const diagnostics = [];
    const admin = await context.newPage();
    admin.on("pageerror", (error) => diagnostics.push("page: " + error.message));
    admin.on("console", (message) => { if (message.type() === "error") diagnostics.push("console: " + message.text()); });
    await admin.goto(BASE + "?admin", { waitUntil: "domcontentloaded", timeout: 120000 });
    await admin.waitForSelector("#ashenholdAdmin .admin-panel", { timeout: 120000 });
    await admin.waitForFunction(() => window.__ASHENHOLD_ADMIN__?.info().ready, null, { timeout: 120000 });

    const runtime = await admin.evaluate(() => {
      const api = window.__ASHENHOLD_ADMIN__;
      const before = api.info();
      const entities = api.listEntities();
      const modelSlots = api.modelCatalog();
      const baseModel = entities.find((entry) => entry.type === "model" && ["siegeTower", "bridgePillar"].includes(entry.modelSlot) && entry.id.split(":").length >= 7)
        || entities.find((entry) => entry.type === "model" && entry.modelSlot && entry.id.startsWith("model:") && entry.id.split(":").length >= 7)
        || entities.find((entry) => entry.type === "model" && entry.modelSlot && entry.id.startsWith("model:"));
      const baseChest = entities.find((entry) => entry.type === "chest");
      const baseEnemy = entities.find((entry) => entry.type === "enemy" && !/^ASHENHOLD KEEP\b/.test(entry.label))
        || entities.find((entry) => entry.type === "enemy");
      const keep = entities.find((entry) => entry.id === "location:keep");
      const custom = api.addModel(modelSlots.some((entry) => entry.id === "crateBig") ? "crateBig" : modelSlots[0].id);
      const moved = api.setTransform(custom.id, {
        position: { x: custom.transform.position.x + 3, y: custom.transform.position.y + 1, z: custom.transform.position.z - 2 },
        rotationY: .35, scale: { x: custom.transform.scale.x * 1.1, y: custom.transform.scale.y * 1.2, z: custom.transform.scale.z * .9 }
      });
      api.setColor(custom.id, "#47b8d8");
      api.setCollision(custom.id, false);
      const hiddenCollision = api.getEntity(custom.id).collision;
      api.setCollision(custom.id, true);
      const desert = api.setBiome("desert", { treeDensity: 2, propDensity: 1.1, fogDensity: .0022 });
      api.setEnemyProfile("warg", { health: 1.15, damage: 1.25, sightRange: 1.2, tracking: 1.3 });
      const documentValue = api.getDocument();
      const source = api.sourceFile();
      const report = api.validate();
      const undoWorked = api.undo();
      const redoWorked = api.redo();
      return {
        before, after: api.info(), entities: entities.length,
        categories: Array.from(new Set(entities.map((entry) => entry.category))),
        modelSlots: modelSlots.length, custom, moved, hiddenCollision,
        collisionRestored: api.getEntity(custom.id).collision,
        desert, warg: documentValue.enemies.byKind.warg,
        documentEntry: documentValue.entities[custom.id], source, report, undoWorked, redoWorked,
        fixtureTargets: {
          model: baseModel && api.getEntity(baseModel.id), chest: baseChest && api.getEntity(baseChest.id),
          enemy: baseEnemy && api.getEntity(baseEnemy.id), keep: keep && api.getEntity(keep.id)
        },
        gameState: document.getElementById("game")?.dataset.state,
        titleActive: document.getElementById("titleScreen")?.classList.contains("active"),
        publicApi: Object.keys(window.ashenholdGame)
      };
    });

    check(runtime.gameState === "playing" && !runtime.titleActive, "Admin mode must boot directly into the editable world.");
    check(runtime.before.simulationPaused, "Admin sandbox must pause simulation by default.");
    check(runtime.entities >= 100 && runtime.modelSlots >= 40, "Editor must expose the real scene and asset catalog.");
    for (const category of ["Locations", "Models", "Enemies", "Chests"]) check(runtime.categories.includes(category), `Missing scene category: ${category}`);
    check(runtime.custom && runtime.moved && runtime.documentEntry.type === "custom-model", "Custom model placement and transform persistence failed.");
    check(runtime.hiddenCollision === false && runtime.collisionRestored, "Collider toggle did not follow the edited object.");
    check(runtime.desert.treeDensity === 0, "Ember Dunes must remain tree-free through the editor.");
    check(runtime.warg.damage === 1.25 && runtime.warg.tracking === 1.3, "Enemy archetype tuning was not persisted.");
    check(runtime.source.includes("window.AshenholdWorldOverrides") && !runtime.source.includes("__ASHENHOLD_ADMIN__"), "Source export must be data-only.");
    check(runtime.report.valid && runtime.undoWorked && runtime.redoWorked, "Validation or editor history failed.");
    check(runtime.publicApi.join(",") === "snapshot,modelCatalog,multiplayerSnapshot", "Normal public game API contract changed.");

    await admin.locator('[data-admin-tab="appearance"]').dispatchEvent("click");
    await admin.waitForSelector("#adminApplyColor");
    await admin.locator('[data-admin-tab="world"]').dispatchEvent("click");
    await admin.waitForSelector("#adminApplyBiome");
    await admin.locator('[data-admin-tab="combat"]').dispatchEvent("click");
    await admin.waitForSelector("#adminApplyEnemyProfile");
    await admin.locator('[data-admin-tab="data"]').dispatchEvent("click");
    await admin.waitForSelector("#adminSaveRepo");

    const targets = runtime.fixtureTargets;
    check(targets.model && targets.chest && targets.enemy && targets.keep, "Production fixture targets were not registered.");
    const replacementSlot = targets.model.modelSlot === "rock" ? "crateBig" : "rock";
    const fixture = {
      schemaVersion: 1, worldSignature: "ashenhold-authored-continent-8",
      entities: {
        [targets.model.id]: {
          type: "model", modelSlot: replacementSlot, color: "#47b8d8",
          position: { x: targets.model.transform.position.x + 3, y: targets.model.transform.position.y + 1, z: targets.model.transform.position.z - 2 },
          rotationY: targets.model.transform.rotationY + .2, scale: targets.model.transform.scale, collision: false, visible: true
        },
        [targets.chest.id]: { type: "chest", visible: false, collision: false },
        [targets.enemy.id]: {
          type: "enemy", enemy: { health: 77, maxHealth: 123, damage: 19, speed: 4.5, attackRange: 8, attackInterval: 1.4, sightRange: 88, tracking: 1.7 }
        },
        "location:keep": {
          type: "location", position: { x: targets.keep.transform.position.x + 9, y: targets.keep.transform.position.y, z: targets.keep.transform.position.z + 7 },
          rotationY: .22, scale: { x: 1.08, y: 1, z: 1.08 }
        },
        "custom:audit:fixture": {
          type: "custom-model", label: "Audit custom crate", modelSlot: "crateBig", color: "#c98642",
          position: { x: 28, y: 16, z: 32 }, rotationY: .4, scale: { x: 3, y: 3, z: 3 }, visible: true, collision: false
        }
      },
      biomes: { jungle: { ground: "#345a41", fogDensity: .0027, exposure: 1.15, treeDensity: .65, propDensity: .8, grassDensity: .7 } },
      enemies: { global: {}, byKind: {} }
    };
    await context.route("**/world-overrides.js", (route) => route.fulfill({
      status: 200, contentType: "text/javascript; charset=utf-8",
      body: `(function(){"use strict";window.AshenholdWorldOverrides=${JSON.stringify(fixture).replace(/</g, "\\u003c")};})();`
    }));
    const normal = await context.newPage();
    const adminAssetRequests = [];
    normal.on("request", (request) => { if (/admin-editor\.(?:js|css)/.test(request.url())) adminAssetRequests.push(request.url()); });
    await normal.goto(BASE + "?test", { waitUntil: "domcontentloaded", timeout: 120000 });
    await normal.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 120000 });
    const normalState = await normal.evaluate(() => ({
      mutationApi: typeof window.__ASHENHOLD_ADMIN__, panel: Boolean(document.getElementById("ashenholdAdmin")),
      scriptTags: Array.from(document.scripts).map((script) => script.getAttribute("src") || "").filter((source) => /admin-editor/.test(source)),
      publicApi: Object.keys(window.ashenholdGame), overrides: window.__ASHENHOLD_TEST__.worldOverrideDebug()
    }));
    check(normalState.mutationApi === "undefined" && !normalState.panel, "Ordinary game URL exposed the local mutation API.");
    check(normalState.scriptTags.length === 0 && adminAssetRequests.length === 0, "Ordinary game URL loaded local editor assets.");
    const applied = normalState.overrides.entities;
    check(normalState.overrides.registered.length >= 5, "Ordinary mode did not consume entity overrides.");
    check(applied[targets.model.id]?.modelSlot === replacementSlot && Math.abs(applied[targets.model.id].transform.position.x - fixture.entities[targets.model.id].position.x) < .05, "Published model swap/transform was not applied in ordinary mode.");
    check(applied[targets.model.id]?.color === "#47b8d8" && applied[targets.model.id]?.collision === false, "Published model appearance/collision was not applied.");
    check(applied[targets.chest.id]?.visible === false && applied[targets.chest.id]?.collision === false, "Published chest visibility/collision was not applied.");
    check(applied[targets.enemy.id]?.enemy?.maxHealth === 123 && applied[targets.enemy.id]?.enemy?.damage === 19, "Published per-enemy values were not applied.");
    check(applied["location:keep"] && Math.abs(applied["location:keep"].transform.position.x - fixture.entities["location:keep"].position.x) < .05, "Published keep transform was not applied.");
    check(applied["custom:audit:fixture"]?.modelSlot === "crateBig" && applied["custom:audit:fixture"]?.color === "#c98642", "Published custom model was not created in ordinary mode.");
    check(normalState.overrides.biomes.jungle.ground === "#345a41" && normalState.overrides.biomes.jungle.treeDensity === .65, "Published biome settings were not applied in ordinary mode.");
    check(diagnostics.length === 0, "Browser diagnostics were not clean: " + diagnostics.join(" | "));

    console.log(JSON.stringify({
      checks: {
        loopbackToken: true, worktreeIdentity: true, originRejected: true, unauthorizedWriteRejected: true, signatureValidated: true,
        prototypeRejected: true, textureTraversalRejected: true, bodyLimit: true,
        adminBoot: true, sceneRegistry: true, customTransform: true, colliderLink: true,
        treelessDesert: true, enemyTuning: true, history: true, dataOnlyExport: true,
        ordinaryUrlReadOnly: true, ordinaryUrlSkipsEditorAssets: true, productionOverridesApplied: true, cleanDiagnostics: true
      },
      metrics: { entities: runtime.entities, modelSlots: runtime.modelSlots, categories: runtime.categories, bridgeBranch: session.branch }
    }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopBridgeProcess(bridge);
    if (bridgeError) process.stderr.write(bridgeError);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
