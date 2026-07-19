"use strict";

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = (process.env.ASHENHOLD_BASE || "http://127.0.0.1:4173/").replace(/\/?$/, "/");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = [];
  page.on("console", (message) => { if (["error", "warning"].includes(message.type()) && !/ReadPixels|GPU stall/i.test(message.text())) diagnostics.push(message.type() + ": " + message.text()); });
  page.on("pageerror", (error) => diagnostics.push("page: " + error.message));
  page.on("requestfailed", (request) => diagnostics.push("request: " + request.url()));
  const started = Date.now();
  await page.goto(BASE + "?test&biome=jungle&seed=424242", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  const bootMs = Date.now() - started;
  const result = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
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
  const external = result.resources.filter((resource) => new URL(resource.name).origin !== origin).map((resource) => resource.name);
  const report = {
    generatedAt: new Date().toISOString(), base: BASE, bootMs,
    transferMB: Math.round(total / 1048576 * 100) / 100,
    resourceCount: result.resources.length,
    external,
    largest: result.resources.slice().sort((a, b) => b.decodedBytes - a.decodedBytes).slice(0, 12),
    renderer: result.snapshot.renderer,
    rendererMemory: result.snapshot.rendererMemory,
    diagnostics
  };
  report.checks = {
    bootedWithinBudget: bootMs < 60000,
    startupTransferWithinBudget: report.transferMB < 18,
    sameOriginOnly: external.length === 0,
    cleanDiagnostics: diagnostics.length === 0
  };
  fs.writeFileSync("test-results/payload-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(report.checks).some((value) => !value)) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
