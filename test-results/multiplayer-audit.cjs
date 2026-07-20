"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const REPORT_PATH = path.join(__dirname, "multiplayer-audit.json");
const WORLD_ID = "ashenhold-continent-v1";
const PROTOCOL_VERSION = 2;
const TIMEOUT = Math.max(15000, Number(process.env.ASHENHOLD_MULTIPLAYER_TIMEOUT) || 70000);
const SYNC_TIMEOUT = Math.max(20000, Number(process.env.ASHENHOLD_MULTIPLAYER_SYNC_TIMEOUT) || 0);
const PRODUCTION_MODULES = [
  ["client", "multiplayer-client.js", "AshenholdMultiplayer"],
  ["party", "multiplayer-ui.js", "AshenholdParty"],
  ["avatars", "multiplayer-avatars.js", "AshenholdRemoteWardens"],
  ["runtime", "multiplayer-game.js", "AshenholdCoopRuntime"]
];
const FIXTURE = Object.freeze({
  worldId: WORLD_ID,
  navigation: { cellSize: 5, width: 24, height: 24, originX: -60, originZ: 160, blocked: [] },
  strongholds: [{ id: "audit-shrine", name: "Audit Shrine", kind: "shrine", x: 0, z: 207 }],
  enemies: [{
    id: "audit-guard", name: "Audit Guard", kind: "biomeLight", x: 0, y: 0, z: 207,
    rotation: Math.PI, health: 50, maxHealth: 50, damage: 1, sight: 12,
    strongholdId: "audit-shrine", role: "guard"
  }],
  chests: [{ id: "audit-chest", x: 0, y: 0, z: 210, powerUp: { type: "sprint", amount: 2 } }]
});

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizedBase(value) {
  const url = new URL(value);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

async function probeStatic(base) {
  try {
    const response = await fetch(new URL("index.html", base), { signal: AbortSignal.timeout(1400) });
    if (!response.ok) return false;
    const html = await response.text();
    return html.includes('id="enterButton"') && html.includes('src="app.js"');
  } catch {
    return false;
  }
}

function mimeType(filename) {
  return ({
    ".bin": "application/octet-stream", ".css": "text/css; charset=utf-8", ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json", ".html": "text/html; charset=utf-8", ".ico": "image/x-icon",
    ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp"
  })[path.extname(filename).toLowerCase()] || "application/octet-stream";
}

async function startStaticTarget() {
  const explicit = process.env.ASHENHOLD_BASE?.trim();
  if (explicit) {
    const base = normalizedBase(explicit);
    if (!await probeStatic(base)) throw new Error(`ASHENHOLD_BASE did not serve Ashenhold index.html: ${base}`);
    return { url: base, mode: "reused-explicit", async stop() { return true; } };
  }
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const relative = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "") || "index.html";
      let filename = path.resolve(ROOT, relative);
      const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
      if (filename !== ROOT && !filename.startsWith(rootPrefix)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const stat = await fsp.stat(filename);
      if (stat.isDirectory()) filename = path.join(filename, "index.html");
      const finalStat = await fsp.stat(filename);
      response.writeHead(200, {
        "Content-Type": mimeType(filename),
        "Content-Length": finalStat.size,
        "Cache-Control": "no-store"
      });
      if (request.method === "HEAD") response.end();
      else fs.createReadStream(filename).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/`;
  return {
    url, mode: "started-ephemeral",
    stop: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve(true)))
  };
}

function normalizedWebSocket(value) {
  const url = new URL(value);
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  if (!/^wss?:$/.test(url.protocol)) throw new Error(`Unsupported multiplayer URL: ${value}`);
  if (url.pathname === "/") url.pathname = "/ws";
  return url.href;
}

function backendHealthUrl(websocketUrl) {
  const url = new URL(websocketUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/health";
  url.search = "";
  url.hash = "";
  return url.href;
}

async function probeBackend(websocketUrl) {
  try {
    const response = await fetch(backendHealthUrl(websocketUrl), { signal: AbortSignal.timeout(1400) });
    if (!response.ok) return false;
    const health = await response.json();
    return health.ok === true && health.service === "ashenhold-multiplayer" && health.protocol === PROTOCOL_VERSION;
  } catch {
    return false;
  }
}

async function startMultiplayerTarget() {
  const explicit = process.env.ASHENHOLD_MULTIPLAYER_URL?.trim();
  if (explicit) {
    const url = normalizedWebSocket(explicit);
    if (!await probeBackend(url)) throw new Error(`ASHENHOLD_MULTIPLAYER_URL failed its health check: ${backendHealthUrl(url)}`);
    return { url, mode: "reused-explicit", async stop() { return true; } };
  }
  let createAshenholdServer;
  try {
    ({ createAshenholdServer } = await import(pathToFileURL(path.join(ROOT, "multiplayer-server", "create-server.mjs")).href));
  } catch (error) {
    throw new Error(`Unable to load the local multiplayer server. Run npm install --prefix multiplayer-server first. ${error.message}`);
  }
  const instance = createAshenholdServer();
  await new Promise((resolve, reject) => {
    instance.server.once("error", reject);
    instance.server.listen(0, "127.0.0.1", resolve);
  });
  const address = instance.server.address();
  const url = `ws://127.0.0.1:${address.port}/ws`;
  return {
    url, mode: "started-ephemeral",
    stop: async () => {
      for (const socket of instance.wss.clients) socket.terminate();
      await new Promise((resolve, reject) => instance.server.close((error) => error ? reject(error) : resolve()));
      return true;
    }
  };
}

function instrument(page, label, backendUrl) {
  const result = { consoleErrors: [], criticalWarnings: [], pageErrors: [], requestFailures: [], badResponses: [], expectedTransportFailures: [] };
  let expectedTransportFaults = 0;
  const sameBackend = (value) => {
    try {
      const actual = new URL(value);
      const expected = new URL(backendUrl);
      return /^wss?:$/.test(actual.protocol) && actual.origin === expected.origin && actual.pathname === expected.pathname;
    } catch {
      return false;
    }
  };
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error") result.consoleErrors.push(`${label}: ${text}`);
    if (message.type() === "warning" && /uncaught|exception|failed|context lost|multiplayer.+unavailable/i.test(text) && !/ReadPixels|GPU stall/i.test(text)) {
      result.criticalWarnings.push(`${label}: ${text}`);
    }
  });
  page.on("pageerror", (error) => result.pageErrors.push(`${label}: ${error.message}`));
  page.on("requestfailed", (request) => {
    const detail = `${label}: ${request.method()} ${request.url()} :: ${request.failure()?.errorText || "failed"}`;
    if (expectedTransportFaults > 0 && sameBackend(request.url())) {
      expectedTransportFaults -= 1;
      result.expectedTransportFailures.push(detail);
    } else result.requestFailures.push(detail);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) result.badResponses.push(`${label}: ${response.status()} ${response.url()}`);
  });
  return {
    result,
    expectTransportFault() { expectedTransportFaults += 1; },
    endTransportFault() { expectedTransportFaults = 0; }
  };
}

async function ensureProductionModules(page, base) {
  const preloaded = await page.evaluate((modules) => Object.fromEntries(modules.map(([key, , globalName]) => [key, Boolean(window[globalName])])), PRODUCTION_MODULES);
  const injected = [];
  for (const [key, filename, globalName] of PRODUCTION_MODULES) {
    if (await page.evaluate((name) => Boolean(window[name]), globalName)) continue;
    await page.addScriptTag({ url: new URL(filename, base).href });
    await page.waitForFunction((name) => Boolean(window[name]), globalName, { timeout: 10000 });
    injected.push(key);
  }
  await page.waitForSelector("[data-party-mode=host]", { timeout: 10000 });
  await page.evaluate(() => {
    const client = window.AshenholdParty?.client;
    if (!client) throw new Error("The production party controller did not create a multiplayer client.");
    if (window.__ASHENHOLD_MULTIPLAYER_AUDIT__?.client === client) return;
    const audit = {
      client, serverErrors: [], events: [], statuses: [client.status], welcomes: [], snapshots: 0,
      readAdapter() {
        const candidates = [
          ["test.multiplayerDebug", window.__ASHENHOLD_TEST__?.multiplayerDebug?.()],
          ["game.multiplayerSnapshot", window.ashenholdGame?.multiplayerSnapshot?.()],
          ["game.snapshot.multiplayer", window.ashenholdGame?.snapshot?.()?.multiplayer],
          ["global.coopRuntime", window.ashenholdCoopRuntime?.snapshot?.()],
          ["global.multiplayerRuntime", window.ashenholdMultiplayerRuntime?.snapshot?.()]
        ];
        const match = candidates.find(([, value]) => value && typeof value === "object");
        return match ? { source: match[0], snapshot: match[1] } : null;
      }
    };
    client.on("server_error", (error) => audit.serverErrors.push({ code: error.code, message: error.message }));
    client.on("game_event", (event) => audit.events.push({ ...event }));
    client.on("status", (status) => audit.statuses.push(status));
    client.on("welcome", (message) => audit.welcomes.push({ playerId: message.playerId, roomCode: message.roomCode, worldId: message.worldId, realm: message.realm }));
    client.on("snapshot", () => { audit.snapshots += 1; });
    window.__ASHENHOLD_MULTIPLAYER_AUDIT__ = audit;
  });
  return { preloaded, injected };
}

async function bootPage(context, base, label, backendUrl) {
  await context.addInitScript((url) => { window.ASHENHOLD_MULTIPLAYER_URL = url; }, backendUrl);
  const page = await context.newPage();
  const diagnostics = instrument(page, label, backendUrl);
  const startedAt = Date.now();
  await page.goto(`${base}?test`, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  await page.waitForFunction(() => window.ashenholdGame?.snapshot?.().state === "title", null, { timeout: TIMEOUT });
  const modules = await ensureProductionModules(page, base);
  return { page, diagnostics, modules, bootMs: Date.now() - startedAt };
}

async function clientState(page) {
  return page.evaluate(() => {
    const client = window.AshenholdParty.client;
    return {
      status: client.status, clientId: client.clientId, playerId: client.playerId, roomCode: client.roomCode,
      worldId: client.worldId, realm: client.realm, isHost: client.isHost, worldReady: client.worldReady, started: client.started,
      snapshot: client.snapshot,
      sampledRemotePlayers: client.sampleRemotePlayers(performance.now() + 250),
      roster: [...document.querySelectorAll("#partyRoster span")].map((item) => item.textContent.trim()),
      audit: {
        serverErrors: window.__ASHENHOLD_MULTIPLAYER_AUDIT__.serverErrors,
        events: window.__ASHENHOLD_MULTIPLAYER_AUDIT__.events,
        statuses: window.__ASHENHOLD_MULTIPLAYER_AUDIT__.statuses,
        welcomes: window.__ASHENHOLD_MULTIPLAYER_AUDIT__.welcomes,
        snapshots: window.__ASHENHOLD_MULTIPLAYER_AUDIT__.snapshots
      }
    };
  });
}

async function connectParty(page, mode, name, roomCode = "") {
  await page.locator(`[data-party-mode=${mode}]`).evaluate((element) => element.click());
  await page.locator("#partyName").fill(name);
  if (mode === "join") await page.locator("#partyCode").fill(roomCode);
  await page.locator("#partyConnect").evaluate((element) => element.click());
  await page.waitForFunction(() => window.AshenholdParty?.connected && window.AshenholdParty.client.roomCode.length === 6, null, { timeout: SYNC_TIMEOUT });
  return clientState(page);
}

function playerFrame(x, y, z, overrides = {}) {
  return {
    x, y, z, rotation: overrides.rotation || 0, health: 100, maxHealth: 100, stamina: 100,
    weapon: overrides.weapon || "blade", moving: Boolean(overrides.moving), sprinting: Boolean(overrides.sprinting),
    superSprinting: false, sliding: false, airborne: false, attacking: false, companionCount: 0, noise: 0
  };
}

async function sendPlayerFrame(page, frame) {
  const sent = await page.evaluate((state) => window.AshenholdParty.client.sendPlayerState(state, true), frame);
  if (!sent) throw new Error("The multiplayer client rejected an audit player frame.");
  await delay(70);
}

async function movePlayerThroughGame(page, x, z) {
  const state = await page.evaluate(() => {
    const teleport = window.__ASHENHOLD_TEST__?.teleport;
    const client = window.AshenholdParty?.client;
    const local = client?.snapshot?.players?.find((player) => player.id === client.playerId);
    return {
      method: typeof teleport === "function" ? "game-teleport" : "unavailable",
      x: Number(local?.x),
      z: Number(local?.z)
    };
  });
  if (state.method === "unavailable") {
    await sendPlayerFrame(page, playerFrame(x, 0, z));
    return "direct-frame-fallback";
  }
  const startX = Number.isFinite(state.x) ? state.x : x;
  const startZ = Number.isFinite(state.z) ? state.z : z;
  // Keep scripted movement inside the authoritative server's anti-teleport
  // envelope. The production adapter still serializes and acknowledges every
  // step; the audit hook only supplies input that a fast player can legally
  // traverse instead of jumping the entire distance in one frame.
  const steps = Math.max(1, Math.ceil(Math.hypot(x - startX, z - startZ) / 6));
  for (let index = 1; index <= steps; index += 1) {
    const nextX = startX + (x - startX) * index / steps;
    const nextZ = startZ + (z - startZ) * index / steps;
    const position = await page.evaluate(({ stepX, stepZ }) => {
      window.__ASHENHOLD_TEST__.teleport(stepX, stepZ);
      return window.ashenholdGame?.snapshot?.().position;
    }, { stepX: nextX, stepZ: nextZ });
    await page.waitForFunction(({ stepX, stepY, stepZ }) => {
      const client = window.AshenholdParty?.client;
      const local = client?.snapshot?.players?.find((player) => player.id === client.playerId);
      return local && Math.abs(local.x - stepX) < .35 && Math.abs(local.y - stepY) < .35 && Math.abs(local.z - stepZ) < .35;
    }, { stepX: nextX, stepY: Number(position?.y) || 0, stepZ: nextZ }, { timeout: SYNC_TIMEOUT });
  }
  return state.method;
}

async function sendPlayerFrameAndOpenChest(page, frame, chestId) {
  // The server intentionally drops player frames that arrive inside its 35 ms
  // anti-spam window. Wait for that window, then queue the position and
  // interaction together so the normal game loop cannot overwrite the
  // deliberately below-floor probe before the server checks chest range.
  await page.evaluate(() => {
    const client = window.AshenholdParty?.client;
    if (client) client.lastStateAt = performance.now() + 250;
  });
  await delay(70);
  const sent = await page.evaluate(({ state, id }) => {
    const client = window.AshenholdParty?.client;
    return Boolean(client?.sendPlayerState(state, true) && client.openChest(id));
  }, { state: frame, id: chestId });
  if (!sent) throw new Error("The multiplayer client rejected the ordered chest range probe.");
}

async function waitForEnemy(page, expected) {
  await page.waitForFunction(({ enemyId, health, dead }) => {
    const enemy = window.AshenholdParty.client.snapshot?.enemies?.find((item) => item.id === enemyId);
    return enemy && enemy.health === health && enemy.dead === dead;
  }, { enemyId: "audit-guard", ...expected }, { timeout: SYNC_TIMEOUT });
}

async function waitForServerError(page, code, afterIndex) {
  await page.waitForFunction(({ expected, index }) => window.__ASHENHOLD_MULTIPLAYER_AUDIT__.serverErrors.slice(index).some((error) => error.code === expected), { expected: code, index: afterIndex }, { timeout: SYNC_TIMEOUT });
}

async function renderFallbackAvatar(page) {
  return page.evaluate(() => {
    window.__ASHENHOLD_MULTIPLAYER_AUDIT__.renderer?.dispose?.();
    const scene = new THREE.Scene();
    const renderer = new window.AshenholdRemoteWardens(scene);
    const players = window.AshenholdParty.client.sampleRemotePlayers(performance.now() + 500);
    const count = renderer.sync(players, 1 / 60);
    window.__ASHENHOLD_MULTIPLAYER_AUDIT__.renderer = renderer;
    return { count, sceneChildren: scene.children.length, playerIds: players.map((player) => player.id), debug: renderer.debug?.() || null };
  });
}

async function waitForFullRemoteWarden(page) {
  await page.waitForFunction(() => {
    const debug = window.__ASHENHOLD_MULTIPLAYER_AUDIT__?.renderer?.debug?.();
    return debug?.asset?.status === "ready" && debug.wardens?.length === 1 && debug.wardens.every((warden) => warden.fullModel);
  }, null, { timeout: 30000 });
  return page.evaluate(() => window.__ASHENHOLD_MULTIPLAYER_AUDIT__.renderer.debug());
}

async function readAdapter(page) {
  return page.evaluate(() => window.__ASHENHOLD_MULTIPLAYER_AUDIT__.readAdapter());
}

function remoteAvatarCount(adapter) {
  const snapshot = adapter?.snapshot;
  const value = snapshot?.remoteAvatars ?? snapshot?.renderedRemoteAvatars ?? snapshot?.render?.remoteAvatars;
  if (Array.isArray(value)) return value.length;
  return Number.isFinite(Number(value)) ? Number(value) : -1;
}

async function ensurePlaying(page) {
  const state = await page.evaluate(() => window.ashenholdGame?.snapshot?.().state);
  if (state === "title") await page.locator("#enterButton").evaluate((element) => element.click());
  await page.waitForFunction(() => window.ashenholdGame?.snapshot?.().state === "playing", null, { timeout: TIMEOUT });
}

async function disconnectTransport(page) {
  return page.evaluate(() => {
    const hook = window.__ASHENHOLD_TEST__?.multiplayerDisconnectTransport;
    if (typeof hook === "function") { hook(); return "test-hook"; }
    const socket = window.AshenholdParty?.client?.socket;
    if (!socket) throw new Error("No multiplayer transport was available to interrupt.");
    socket.close(4002, "Audit reconnect");
    return "client-socket";
  });
}

async function closePageClient(page) {
  if (!page || page.isClosed()) return;
  await page.evaluate(() => {
    window.__ASHENHOLD_MULTIPLAYER_AUDIT__?.renderer?.dispose?.();
    window.AshenholdParty?.client?.disconnect?.();
  }).catch(() => {});
}

(async () => {
  let staticTarget;
  let multiplayerTarget;
  let browser;
  let hostContext;
  let guestContext;
  let host;
  let guest;
  const report = { generatedAt: new Date().toISOString(), checks: {}, cleanup: {} };
  let failure = null;

  try {
    staticTarget = await startStaticTarget();
    multiplayerTarget = await startMultiplayerTarget();
    report.targets = {
      static: { url: staticTarget.url, mode: staticTarget.mode },
      multiplayer: { url: multiplayerTarget.url, mode: multiplayerTarget.mode }
    };

    browser = await chromium.launch({ headless: true });
    // Two full WebGL clients in one headless SwiftShader process can exhaust the
    // renderer before protocol assertions run. Coarse/reduced-motion contexts use
    // the production game's supported adaptive density while preserving all co-op logic.
    const contextOptions = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: "reduce" };
    hostContext = await browser.newContext(contextOptions);
    guestContext = await browser.newContext(contextOptions);
    [host, guest] = await Promise.all([
      bootPage(hostContext, staticTarget.url, "host", multiplayerTarget.url),
      bootPage(guestContext, staticTarget.url, "guest", multiplayerTarget.url)
    ]);

    const hostWelcome = await connectParty(host.page, "host", "Audit Host");
    const guestWelcome = await connectParty(guest.page, "join", "Audit Guest", hostWelcome.roomCode);
    await Promise.all([
      host.page.waitForFunction(() => document.querySelectorAll("#partyRoster span").length === 2, null, { timeout: SYNC_TIMEOUT }),
      guest.page.waitForFunction(() => document.querySelectorAll("#partyRoster span").length === 2, null, { timeout: SYNC_TIMEOUT })
    ]);

    const joinedHost = await clientState(host.page);
    const joinedGuest = await clientState(guest.page);
    report.session = {
      roomCode: joinedHost.roomCode,
      hostPlayerId: joinedHost.playerId,
      guestPlayerId: joinedGuest.playerId,
      worldIds: [joinedHost.worldId, joinedGuest.worldId],
      rosters: [joinedHost.roster, joinedGuest.roster],
      modules: { host: host.modules, guest: guest.modules },
      bootMs: { host: host.bootMs, guest: guest.bootMs }
    };

    await host.page.evaluate((world) => {
      if (!window.AshenholdParty.client.registerWorld(world)) throw new Error("Host could not register the audit world.");
    }, FIXTURE);
    await Promise.all([
      host.page.waitForFunction(() => window.AshenholdParty.client.worldReady, null, { timeout: SYNC_TIMEOUT }),
      guest.page.waitForFunction(() => window.AshenholdParty.client.worldReady, null, { timeout: SYNC_TIMEOUT })
    ]);

    const preStartErrorIndex = (await clientState(host.page)).audit.serverErrors.length;
    await host.page.evaluate(() => window.AshenholdParty.client.attack("audit-guard", "blade", 1));
    await waitForServerError(host.page, "REALM_NOT_STARTED", preStartErrorIndex);
    const preStartRejected = (await clientState(host.page)).audit.serverErrors
      .slice(preStartErrorIndex)
      .some((error) => error.code === "REALM_NOT_STARTED");

    await host.page.evaluate(() => window.AshenholdParty.client.startRealm());
    await Promise.all([
      host.page.waitForFunction(() => window.AshenholdParty.client.started, null, { timeout: SYNC_TIMEOUT }),
      guest.page.waitForFunction(() => window.AshenholdParty.client.started, null, { timeout: SYNC_TIMEOUT })
    ]);
    const preloadedByApp = [host, guest].every((entry) => Object.values(entry.modules.preloaded).every(Boolean));
    if (preloadedByApp) await Promise.all([ensurePlaying(host.page), ensurePlaying(guest.page)]);

    const movementMethods = [];
    movementMethods.push(await movePlayerThroughGame(host.page, 1.25, 209));
    await guest.page.waitForFunction((id) => {
      const player = window.AshenholdParty.client.snapshot?.players?.find((item) => item.id === id);
      return player && Math.abs(player.x - 1.25) < .35 && Math.abs(player.z - 209) < .35;
    }, joinedHost.playerId, { timeout: SYNC_TIMEOUT });
    movementMethods.push(await movePlayerThroughGame(guest.page, -1.5, 209.5));
    await host.page.waitForFunction((id) => {
      const player = window.AshenholdParty.client.snapshot?.players?.find((item) => item.id === id);
      return player && Math.abs(player.x + 1.5) < .35 && Math.abs(player.z - 209.5) < .35;
    }, joinedGuest.playerId, { timeout: SYNC_TIMEOUT });
    const movedHost = await clientState(host.page);
    const movedGuest = await clientState(guest.page);

    await host.page.evaluate(() => window.AshenholdParty.client.attack("audit-guard", "blade", 20));
    await Promise.all([waitForEnemy(host.page, { health: 30, dead: false }), waitForEnemy(guest.page, { health: 30, dead: false })]);
    const damaged = await Promise.all([clientState(host.page), clientState(guest.page)]);
    await delay(330);
    await host.page.evaluate(() => window.AshenholdParty.client.attack("audit-guard", "blade", 100));
    await Promise.all([waitForEnemy(host.page, { health: 0, dead: true }), waitForEnemy(guest.page, { health: 0, dead: true })]);
    await Promise.all([
      host.page.waitForFunction(() => window.AshenholdParty.client.snapshot?.strongholds?.some((item) => item.id === "audit-shrine" && item.cleared && item.flagRaised), null, { timeout: SYNC_TIMEOUT }),
      guest.page.waitForFunction(() => window.AshenholdParty.client.snapshot?.strongholds?.some((item) => item.id === "audit-shrine" && item.cleared && item.flagRaised), null, { timeout: SYNC_TIMEOUT })
    ]);

    let guestState = await clientState(guest.page);
    const belowErrorIndex = guestState.audit.serverErrors.length;
    await sendPlayerFrameAndOpenChest(guest.page, playerFrame(0, -3.5, 210), "audit-chest");
    await waitForServerError(guest.page, "CHEST_RANGE", belowErrorIndex);
    movementMethods.push(await movePlayerThroughGame(guest.page, 0, 210));
    const guestClaimEventIndex = (await clientState(guest.page)).audit.events.length;
    await guest.page.evaluate(() => window.AshenholdParty.client.openChest("audit-chest"));
    await guest.page.waitForFunction((index) => window.__ASHENHOLD_MULTIPLAYER_AUDIT__.events.slice(index).some((event) => event.type === "chest_opened" && event.chestId === "audit-chest"), guestClaimEventIndex, { timeout: SYNC_TIMEOUT });
    guestState = await clientState(guest.page);
    const duplicateErrorIndex = guestState.audit.serverErrors.length;
    await guest.page.evaluate(() => window.AshenholdParty.client.openChest("audit-chest"));
    await waitForServerError(guest.page, "CHEST_CLAIMED", duplicateErrorIndex);
    movementMethods.push(await movePlayerThroughGame(host.page, 1.25, 209));
    const hostClaimEventIndex = (await clientState(host.page)).audit.events.length;
    await host.page.evaluate(() => window.AshenholdParty.client.openChest("audit-chest"));
    await host.page.waitForFunction((index) => window.__ASHENHOLD_MULTIPLAYER_AUDIT__.events.slice(index).some((event) => event.type === "chest_opened" && event.chestId === "audit-chest"), hostClaimEventIndex, { timeout: SYNC_TIMEOUT });
    await Promise.all([
      host.page.waitForFunction(() => window.AshenholdParty.client.getChest("audit-chest")?.claimed, null, { timeout: SYNC_TIMEOUT }),
      guest.page.waitForFunction(() => window.AshenholdParty.client.getChest("audit-chest")?.claimed, null, { timeout: SYNC_TIMEOUT })
    ]);
    const chestStates = await Promise.all([clientState(host.page), clientState(guest.page)]);

    const reconnectStatusIndex = chestStates[1].audit.statuses.length;
    guest.diagnostics.expectTransportFault();
    const reconnectMethod = await disconnectTransport(guest.page);
    await guest.page.waitForFunction((index) => {
      const audit = window.__ASHENHOLD_MULTIPLAYER_AUDIT__;
      return audit.statuses.slice(index).includes("disconnected") && audit.statuses.slice(index).includes("reconnecting") && window.AshenholdParty.client.status === "connected";
    }, reconnectStatusIndex, { timeout: SYNC_TIMEOUT });
    guest.diagnostics.endTransportFault();
    // Both full 3D clients can be main-thread constrained while rebuilding
    // remote actors after reconnect. The server broadcasts presence every
    // snapshot tick; allow the host page enough time to observe it under the
    // production forest/render load before declaring the roster stale.
    await Promise.all([
      host.page.waitForFunction((id) => window.AshenholdParty.client.snapshot?.players?.some((player) => player.id === id && player.connected), joinedGuest.playerId, { timeout: SYNC_TIMEOUT }),
      guest.page.waitForFunction(() => window.AshenholdParty.client.snapshot?.players?.filter((player) => player.connected).length === 2, null, { timeout: SYNC_TIMEOUT })
    ]);
    const reconnected = await clientState(guest.page);

    const fallbackAvatars = await Promise.all([renderFallbackAvatar(host.page), renderFallbackAvatar(guest.page)]);
    const fullWardenDebug = await Promise.all([waitForFullRemoteWarden(host.page), waitForFullRemoteWarden(guest.page)]);
    if (preloadedByApp) {
      await Promise.all([host.page, guest.page].map((page) => page.waitForFunction(() => {
        const adapter = window.__ASHENHOLD_MULTIPLAYER_AUDIT__.readAdapter();
        const snapshot = adapter?.snapshot;
        const value = snapshot?.remoteAvatars ?? snapshot?.renderedRemoteAvatars ?? snapshot?.render?.remoteAvatars;
        return (Array.isArray(value) ? value.length : Number(value)) >= 1;
      }, null, { timeout: 12000 }).catch(() => {})));
    }
    const adapters = await Promise.all([readAdapter(host.page), readAdapter(guest.page)]);
    const finalStates = await Promise.all([clientState(host.page), clientState(guest.page)]);
    const diagnostics = { host: host.diagnostics.result, guest: guest.diagnostics.result };
    const criticalDiagnosticCount = Object.values(diagnostics).reduce((total, entry) => total + entry.consoleErrors.length + entry.criticalWarnings.length + entry.pageErrors.length + entry.requestFailures.length + entry.badResponses.length, 0);

    report.movement = {
      methods: movementMethods,
      hostSeenByGuest: movedGuest.snapshot.players.find((player) => player.id === joinedHost.playerId),
      guestSeenByHost: movedHost.snapshot.players.find((player) => player.id === joinedGuest.playerId)
    };
    report.combat = {
      damagedHealth: damaged.map((state) => state.snapshot.enemies.find((enemy) => enemy.id === "audit-guard")?.health),
      finalEnemies: finalStates.map((state) => state.snapshot.enemies.find((enemy) => enemy.id === "audit-guard")),
      strongholds: finalStates.map((state) => state.snapshot.strongholds.find((stronghold) => stronghold.id === "audit-shrine"))
    };
    report.chest = {
      perPlayer: chestStates.map((state) => state.snapshot.chests.find((chest) => chest.id === "audit-chest")),
      guestErrors: chestStates[1].audit.serverErrors
    };
    report.avatars = { fallback: fallbackAvatars, fullWardenDebug, adapters };
    report.reconnect = { method: reconnectMethod, samePlayerId: reconnected.playerId === joinedGuest.playerId, statuses: reconnected.audit.statuses.slice(reconnectStatusIndex), roster: reconnected.roster };
    report.diagnostics = diagnostics;

    const allPreloaded = [host, guest].every((entry) => Object.values(entry.modules.preloaded).every(Boolean));
    const adapterAvatarCounts = adapters.map(remoteAvatarCount);
    const joinedPlayers = joinedHost.snapshot?.players || [];
    const joinedColors = Object.fromEntries(joinedPlayers.map((player) => [player.id, player.color]));
    const reconnectedGuest = reconnected.snapshot?.players?.find((player) => player.id === joinedGuest.playerId);
    const canonicalAnimations = ["idle", "walk", "run", "sprint", "superSprint", "jump", "fall", "land", "slide", "dodge", "attack", "death"];
    const remoteWardens = fullWardenDebug.flatMap((debug) => debug.wardens || []);
    report.checks = {
      separateBrowserContexts: joinedHost.clientId !== joinedGuest.clientId && joinedHost.playerId !== joinedGuest.playerId,
      productionUiHostJoin: joinedHost.isHost && !joinedGuest.isHost && /^[A-Z2-9]{6}$/.test(joinedHost.roomCode) && joinedGuest.roomCode === joinedHost.roomCode,
      fixedContinentSharedWithoutSeed: [joinedHost, joinedGuest].every((state) => state.worldId === WORLD_ID && !state.realm)
        && [joinedHost, joinedGuest].every((state) => state.snapshot?.worldId === WORLD_ID && !("realm" in state.snapshot)),
      twoPlayerRosterShared: [joinedHost, joinedGuest].every((state) => state.snapshot?.players?.filter((player) => player.connected).length === 2) && joinedHost.roster.length === 2 && joinedGuest.roster.length === 2,
      gameplayRequiresRealmStart: preStartRejected,
      movementPropagatesBothWays: report.movement.methods.every((method) => method === "game-teleport")
        && Math.abs(report.movement.hostSeenByGuest?.x - 1.25) < .35 && Math.abs(report.movement.guestSeenByHost?.x + 1.5) < .35,
      twoRemoteTracksShared: finalStates.every((state) => state.sampledRemotePlayers.length === 1),
      twoRemoteAvatarsConstructed: fallbackAvatars.every((entry) => entry.count === 1 && entry.sceneChildren === 1),
      remoteUsesFullMainWardenModel: remoteWardens.length === 2 && remoteWardens.every((warden) => warden.fullModel
        && warden.sourcePath === "assets/models/hooded-shadow-assassin/scene.gltf" && warden.fallbackVisible === false),
      remoteWardenMaterialsIsolated: remoteWardens.length === 2 && remoteWardens.every((warden) => warden.isolatedMaterials),
      remoteWardenAnimationSetComplete: remoteWardens.length === 2 && remoteWardens.every((warden) => canonicalAnimations.every((state) => warden.animationSet?.includes(state))),
      remoteProceduralRunAnimation: remoteWardens.length === 2 && remoteWardens.every((warden) => warden.proceduralRunAnimation),
      stableDistinctServerColors: Object.keys(joinedColors).length === 2 && new Set(Object.values(joinedColors)).size === 2
        && remoteWardens.every((warden) => warden.colorSource === "server"
          && String(warden.accentColor).toLowerCase() === String(joinedColors[warden.id]).toLowerCase())
        && String(reconnectedGuest?.color).toLowerCase() === String(joinedColors[joinedGuest.playerId]).toLowerCase(),
      sharedEnemyDamage: report.combat.damagedHealth.every((health) => health === 30),
      sharedEnemyDeath: report.combat.finalEnemies.every((enemy) => enemy?.dead && enemy.health === 0),
      sharedStrongholdClear: report.combat.strongholds.every((stronghold) => stronghold?.cleared),
      shrineFlagSynchronized: report.combat.strongholds.every((stronghold) => stronghold?.flagRaised),
      underfloorChestRejected: chestStates[1].audit.serverErrors.some((error) => error.code === "CHEST_RANGE"),
      duplicateChestClaimRejected: chestStates[1].audit.serverErrors.some((error) => error.code === "CHEST_CLAIMED"),
      personalChestClaimsShared: report.chest.perPlayer.every((chest) => chest?.opened && chest.claimed),
      reconnectRestoresIdentityAndRoster: report.reconnect.samePlayerId && reconnected.snapshot.players.filter((player) => player.connected).length === 2 && report.reconnect.statuses.includes("disconnected") && report.reconnect.statuses.includes("reconnecting"),
      productionModulesLoadedByApp: allPreloaded,
      appAdapterRendersRemoteAvatars: adapters.every(Boolean) && adapterAvatarCounts.every((count) => count >= 1),
      noCriticalBrowserDiagnostics: criticalDiagnosticCount === 0
    };
  } catch (error) {
    failure = error;
    report.failure = { name: error.name, message: error.message, stack: error.stack };
  } finally {
    await Promise.all([closePageClient(host?.page), closePageClient(guest?.page)]);
    await delay(80);
    if (browser) {
      await browser.close().catch((error) => { report.cleanup.browserError = error.message; });
      report.cleanup.browserClosed = !report.cleanup.browserError;
    }
    if (multiplayerTarget) {
      await multiplayerTarget.stop().then(() => { report.cleanup.multiplayer = multiplayerTarget.mode.startsWith("started") ? "stopped" : "reused"; }).catch((error) => { report.cleanup.multiplayer = `error: ${error.message}`; });
    }
    if (staticTarget) {
      await staticTarget.stop().then(() => { report.cleanup.static = staticTarget.mode.startsWith("started") ? "stopped" : "reused"; }).catch((error) => { report.cleanup.static = `error: ${error.message}`; });
    }
    report.checks.cleanupComplete = !Object.values(report.cleanup).some((value) => String(value).startsWith("error:")) && !report.cleanup.browserError;
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report, null, 2));
  const failedChecks = Object.entries(report.checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failure || failedChecks.length) {
    if (failedChecks.length) console.error(`Failed multiplayer checks: ${failedChecks.join(", ")}`);
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
