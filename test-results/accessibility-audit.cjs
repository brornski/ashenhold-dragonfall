"use strict";

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = (process.env.ASHENHOLD_BASE || "http://127.0.0.1:4173/").replace(/\/?$/, "/");
const axePath = require.resolve("axe-core/axe.min.js");

async function scan(page, state) {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }
  }));
  return {
    state,
    passes: result.passes.length,
    incomplete: result.incomplete.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
    violations: result.violations.map((item) => ({
      id: item.id, impact: item.impact, help: item.help, nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary }))
    }))
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const reports = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "?test", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  reports.push(await scan(page, "desktop-title"));
  await page.evaluate(() => window.__ASHENHOLD_TEST__.start());
  reports.push(await scan(page, "desktop-playing"));
  await page.evaluate(() => window.__ASHENHOLD_TEST__.openSkills());
  reports.push(await scan(page, "desktop-skills"));
  await page.screenshot({ path: "test-results/skills-audit.png", fullPage: true });
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await mobile.goto(BASE + "?test", { waitUntil: "domcontentloaded", timeout: 90000 });
  await mobile.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  await mobile.evaluate(() => window.__ASHENHOLD_TEST__.start());
  reports.push(await scan(mobile, "mobile-playing"));
  await mobile.screenshot({ path: "test-results/mobile-accessibility-audit.png" });
  await mobile.close();
  await browser.close();

  const violations = reports.flatMap((report) => report.violations.map((violation) => ({ state: report.state, ...violation })));
  const summary = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    states: reports,
    violationCount: violations.length,
    seriousOrCritical: violations.filter((violation) => ["serious", "critical"].includes(violation.impact)).length
  };
  fs.writeFileSync("test-results/accessibility-audit.json", JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (summary.seriousOrCritical > 0) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
