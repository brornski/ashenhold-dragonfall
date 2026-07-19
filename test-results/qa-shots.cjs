"use strict";
// Visual QA: title + ascent structure screenshots for every biome.
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
    await page.goto(BASE + "?test&biome=" + biome + "&seed=777001", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: "test-results/qa-" + biome + "-title.png" });
    const ascent = await page.evaluate(() => {
      const test = window.__ASHENHOLD_TEST__;
      test.start();
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
