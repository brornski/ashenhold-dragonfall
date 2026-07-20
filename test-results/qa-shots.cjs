"use strict";
// Visual QA: geographic zone + ascent structure screenshots in the fixed continent.
// Usage: ASHENHOLD_BASE=http://127.0.0.1:4181/ node test-results/qa-shots.cjs [biomeFilter]
const { chromium } = require("playwright");
const BASE = (process.env.ASHENHOLD_BASE || "http://127.0.0.1:4173/").replace(/\/?$/, "/");
const BIOMES = ["snowy", "jungle", "desert", "shore", "mountains", "moon"];

(async () => {
  const filter = process.argv[2];
  const browser = await chromium.launch({ headless: true });
  for (const biome of BIOMES) {
    if (filter && biome !== filter) continue;
    const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    page.on("pageerror", (error) => console.log(biome, "PAGEERROR", error.message.slice(0, 160)));
    await page.goto(BASE + "?test", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
    const located = await page.evaluate((expected) => {
      const test = window.__ASHENHOLD_TEST__;
      const raw = test.biomeZoneDebug?.() || [];
      const zones = Array.isArray(raw) ? raw : raw.zones || [];
      const zone = zones.find((entry) => String(entry.biome || entry.id || entry.name).toLowerCase() === expected);
      const center = zone?.center || zone?.sample || zone?.spawn || zone?.position || zone;
      if (!Number.isFinite(Number(center?.x)) || !Number.isFinite(Number(center?.z))) return false;
      test.start();
      test.teleport(Number(center.x), Number(center.z));
      test.step(.35);
      return window.ashenholdGame.snapshot().world.activeBiome === expected;
    }, biome);
    if (!located) throw new Error(`Could not locate ${biome} in the fixed continent.`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: "test-results/qa-" + biome + "-title.png" });
    const ascent = await page.evaluate(() => {
      const test = window.__ASHENHOLD_TEST__;
      const reports = window.ashenholdGame.snapshot().world.routeReports;
      const start = reports && reports[0] && reports[0].start;
      if (!start) return null;
      test.teleport(start.x + 15, start.z + 15);
      test.lookAt(start.x, start.z, null);
      test.step(.25);
      return start;
    });
    await page.waitForTimeout(450);
    await page.screenshot({ path: "test-results/qa-" + biome + "-ascent.png" });
    console.log(biome, "captured", ascent ? JSON.stringify(ascent) : "NO ROUTE START");
    await page.close();
  }
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
