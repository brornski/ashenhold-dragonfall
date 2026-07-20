"use strict";

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = (process.env.ASHENHOLD_BASE || "http://127.0.0.1:4173/").replace(/\/?$/, "/");
const MULTIPLAYER_MODULES = new Set(["multiplayer-client.js", "multiplayer-ui.js", "multiplayer-game.js", "multiplayer-avatars.js"]);
const MULTIPLAYER_MODULE_BUDGET = 96 * 1024;
const EXPLICIT_WSS_BACKEND = (() => {
  try {
    const url = new URL(String(process.env.ASHENHOLD_MULTIPLAYER_URL || "").trim());
    return url.protocol === "wss:" ? url : null;
  } catch { return null; }
})();

function resourceUrl(value) {
  try { return new URL(value); } catch { return null; }
}

function multiplayerModuleName(url) {
  const name = url?.pathname.split("/").pop() || "";
  return MULTIPLAYER_MODULES.has(name) ? name : null;
}

function isApprovedWssBackend(url) {
  return Boolean(EXPLICIT_WSS_BACKEND && url?.protocol === "wss:" && url.origin === EXPLICIT_WSS_BACKEND.origin && url.pathname === EXPLICIT_WSS_BACKEND.pathname);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = [];
  page.on("console", (message) => { if (["error", "warning"].includes(message.type()) && !/ReadPixels|GPU stall/i.test(message.text())) diagnostics.push(message.type() + ": " + message.text()); });
  page.on("pageerror", (error) => diagnostics.push("page: " + error.message));
  page.on("requestfailed", (request) => diagnostics.push("request: " + request.url()));
  const started = Date.now();
  await page.goto(BASE + "?test", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  const bootMs = Date.now() - started;
  const result = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      durationMs: Math.round(entry.duration),
      transferBytes: entry.transferSize || 0,
      encodedBytes: entry.encodedBodySize || 0,
      decodedBytes: entry.decodedBodySize || 0
    }));
    return { resources, snapshot: window.ashenholdGame.snapshot() };
  });
  await browser.close();
  const origin = new URL(BASE).origin;
  const total = result.resources.reduce((sum, resource) => sum + (resource.transferBytes || resource.encodedBytes), 0);
  const classified = result.resources.map((resource) => ({ resource, url: resourceUrl(resource.name) }));
  const external = classified.filter(({ url }) => !url || (url.origin !== origin && !isApprovedWssBackend(url))).map(({ resource }) => resource.name);
  const approvedExternalWss = classified.filter(({ url }) => isApprovedWssBackend(url)).map(({ resource }) => resource.name);
  const multiplayerResources = classified.filter(({ url }) => multiplayerModuleName(url)).map(({ resource, url }) => ({
    ...resource,
    module: multiplayerModuleName(url),
    sameOrigin: url.origin === origin
  }));
  const multiplayerBytes = multiplayerResources.reduce((sum, resource) => sum + (resource.transferBytes || resource.encodedBytes || resource.decodedBytes), 0);
  const report = {
    generatedAt: new Date().toISOString(), base: BASE, bootMs,
    transferMB: Math.round(total / 1048576 * 100) / 100,
    resourceCount: result.resources.length,
    external,
    approvedExternalWss,
    multiplayer: {
      expectedModules: [...MULTIPLAYER_MODULES],
      loadedModules: [...new Set(multiplayerResources.map((resource) => resource.module))],
      transferKB: Math.round(multiplayerBytes / 1024 * 100) / 100,
      budgetKB: MULTIPLAYER_MODULE_BUDGET / 1024,
      resources: multiplayerResources
    },
    largest: result.resources.slice().sort((a, b) => b.decodedBytes - a.decodedBytes).slice(0, 12),
    renderer: result.snapshot.renderer,
    rendererMemory: result.snapshot.rendererMemory,
    diagnostics
  };
  report.checks = {
    bootedWithinBudget: bootMs < 60000,
    startupTransferWithinBudget: report.transferMB < 18,
    sameOriginOnly: external.length === 0,
    multiplayerModulesSameOrigin: multiplayerResources.every((resource) => resource.sameOrigin),
    multiplayerModulesWithinBudget: multiplayerBytes <= MULTIPLAYER_MODULE_BUDGET,
    cleanDiagnostics: diagnostics.length === 0
  };
  fs.writeFileSync("test-results/payload-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(report.checks).some((value) => !value)) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
