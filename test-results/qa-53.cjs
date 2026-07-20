"use strict";
// Visual QA 5.3: hamlet, watchpost, sprint pose, minimap+legend.
const { chromium } = require("playwright");
const BASE = (process.env.ASHENHOLD_BASE || "http://127.0.0.1:4173/").replace(/\/?$/, "/");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message.slice(0, 160)));
  await page.goto(BASE + "?test", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  await page.evaluate(() => window.__ASHENHOLD_TEST__.start());
  await page.waitForTimeout(400);

  const pois = await page.evaluate(() => window.ashenholdGame.snapshot().world.pois);
  const hamlet = pois.find((poi) => poi.kind === "hamlet");
  const watchpost = pois.find((poi) => poi.kind === "watchpost");

  await page.evaluate((poi) => {
    const test = window.__ASHENHOLD_TEST__;
    test.teleport(poi.x + 22, poi.z + 22);
    test.lookAt(poi.x, poi.z, null);
    test.step(.3);
  }, hamlet);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/qa-53-hamlet.png" });

  await page.evaluate((poi) => {
    const test = window.__ASHENHOLD_TEST__;
    test.teleport(poi.x + 16, poi.z + 16);
    test.lookAt(poi.x, poi.z, null);
    test.step(.3);
  }, watchpost);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/qa-53-watchpost.png" });

  // Sprint pose: super sprint with camera slightly to the side
  await page.evaluate(() => window.__ASHENHOLD_TEST__.teleport(0, 182));
  await page.keyboard.down("Control");
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.55));
  await page.screenshot({ path: "test-results/qa-53-sprint.png" });
  await page.keyboard.up("KeyW");
  await page.keyboard.up("Control");

  // Minimap + legend (visible at 1440px width)
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.3));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/qa-53-minimap.png", clip: { x: 1120, y: 0, width: 320, height: 300 } });

  console.log("captured:", JSON.stringify({ hamlet: hamlet.name, watchpost: watchpost.name }));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
