"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE = (process.env.ASHENHOLD_BASE || "http://127.0.0.1:4173/").replace(/\/?$/, "/");
const WORLD_ID = "ashenhold-continent-v1";
const BIOMES = ["snowy", "jungle", "desert", "shore", "mountains", "moon"];
const REPORT_PATH = path.join(__dirname, "fixed-world-regression.json");

function instrument(page, label) {
  const result = { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on("console", (message) => {
    if (message.type() === "error") result.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => result.pageErrors.push(`${label}: ${error.message}`));
  page.on("requestfailed", (request) => result.failedRequests.push(`${label}: ${request.method()} ${request.url()} :: ${request.failure()?.errorText || "failed"}`));
  page.on("response", (response) => {
    if (response.status() >= 400) result.badResponses.push(`${label}: ${response.status()} ${response.url()}`);
  });
  return result;
}

function containsForbiddenPublicKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => {
    const normalized = key.toLowerCase();
    if (normalized === "seed" || normalized === "nextrealm" || normalized === "next_realm") return true;
    return containsForbiddenPublicKey(child);
  });
}

function normalizeBiome(value) {
  if (typeof value === "string") return value.toLowerCase();
  return String(value?.biome || value?.id || value?.name || "").toLowerCase();
}

function normalizeZones(raw) {
  const source = Array.isArray(raw) ? raw : raw?.zones || raw?.biomes || [];
  return source.map((zone) => {
    const center = zone.center || zone.sample || zone.spawn || zone.position || {};
    const bounds = zone.bounds || {};
    return {
      biome: normalizeBiome(zone),
      center: {
        x: Number(center.x ?? zone.x),
        z: Number(center.z ?? zone.z)
      },
      bounds: {
        minX: Number(bounds.minX ?? bounds.left),
        maxX: Number(bounds.maxX ?? bounds.right),
        minZ: Number(bounds.minZ ?? bounds.top),
        maxZ: Number(bounds.maxZ ?? bounds.bottom)
      },
      raw: zone
    };
  });
}

function getWorldId(snapshot, fixed) {
  const continent = snapshot?.world?.continent;
  return String(continent?.id || continent?.worldId || continent || fixed?.worldId || fixed?.id || "");
}

function getLayoutSignature(snapshot, fixed) {
  const continent = snapshot?.world?.continent;
  const explicit = fixed?.layoutSignature || fixed?.signature || continent?.layoutSignature || continent?.signature;
  if (explicit) return String(explicit);
  const stable = {
    worldId: getWorldId(snapshot, fixed),
    zones: fixed?.zones || continent?.zones || [],
    strongholds: snapshot?.strongholds?.list?.map(({ id, name, kind }) => ({ id, name, kind })) || [],
    pois: snapshot?.world?.pois || [],
    forts: snapshot?.world?.layoutForts || []
  };
  return JSON.stringify(stable);
}

async function boot(context, query, label) {
  const page = await context.newPage();
  const diagnostics = instrument(page, label);
  await page.goto(BASE + query, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => window.ashenholdGame?.snapshot?.().state === "title", null, { timeout: 70000 });
  const contract = await page.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    return {
      snapshot: window.ashenholdGame.snapshot(),
      fixed: test?.fixedWorldDebug?.() || null,
      zones: test?.biomeZoneDebug?.() || null,
      bodyText: document.body.innerText,
      seedControls: [...document.querySelectorAll("[id],[name],[data-action]")]
        .filter((element) => /seed/i.test(`${element.id} ${element.getAttribute("name") || ""} ${element.getAttribute("data-action") || ""}`))
        .map((element) => element.id || element.getAttribute("name") || element.getAttribute("data-action"))
    };
  });
  return { page, diagnostics, ...contract };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const mainContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const legacyContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  let primary;
  let legacy;
  const report = { generatedAt: new Date().toISOString(), checks: {} };

  try {
    [primary, legacy] = await Promise.all([
      boot(mainContext, "?test&test-save", "fixed-world"),
      boot(legacyContext, "?test&biome=moon&seed=987654321", "legacy-query")
    ]);

    const primaryZones = normalizeZones(primary.zones || primary.fixed?.zones || primary.snapshot.world?.continent?.zones);
    const legacyZones = normalizeZones(legacy.zones || legacy.fixed?.zones || legacy.snapshot.world?.continent?.zones);
    const primaryWorldId = getWorldId(primary.snapshot, primary.fixed);
    const legacyWorldId = getWorldId(legacy.snapshot, legacy.fixed);
    const primarySignature = getLayoutSignature(primary.snapshot, primary.fixed);
    const legacySignature = getLayoutSignature(legacy.snapshot, legacy.fixed);
    const zoneBiomes = primaryZones.map((zone) => zone.biome).sort();
    const zoneCentersValid = primaryZones.every((zone) => Number.isFinite(zone.center.x) && Number.isFinite(zone.center.z));

    await primary.page.evaluate(() => window.__ASHENHOLD_TEST__.start());
    await primary.page.waitForFunction(() => window.ashenholdGame.snapshot().state === "playing", null, { timeout: 10000 });
    const documentToken = await primary.page.evaluate(() => {
      window.__fixedWorldDocumentToken = crypto.randomUUID();
      return window.__fixedWorldDocumentToken;
    });
    const traversedZones = [];
    for (const zone of primaryZones) {
      const observation = await primary.page.evaluate(async ({ biome, x, z }) => {
        const test = window.__ASHENHOLD_TEST__;
        const hookBiome = test.biomeAt?.(x, z) ?? null;
        test.teleport(x, z);
        test.step(.08);
        await test.awaitBiomeAssets(biome);
        test.step(.02);
        const snapshot = window.ashenholdGame.snapshot();
        return {
          hookBiome,
          activeBiome: snapshot.world?.activeBiome,
          position: snapshot.position,
          documentToken: window.__fixedWorldDocumentToken
        };
      }, { biome: zone.biome, x: zone.center.x, z: zone.center.z });
      traversedZones.push({ expected: zone.biome, ...observation });
    }

    const shrineCapture = await primary.page.evaluate(() => {
      const test = window.__ASHENHOLD_TEST__;
      const shrine = test.strongholdDebug().find((entry) => entry.kind === "shrine" || entry.kind === "graveyard");
      if (!shrine) return { shrine: null, before: null, after: null, duplicates: -1, saved: null };
      const before = test.captureFlagDebug().find((flag) => flag.strongholdId === shrine.id) || null;
      const cleared = test.clearStronghold(shrine.id);
      test.step(3);
      const matching = test.captureFlagDebug().filter((flag) => flag.strongholdId === shrine.id);
      test.saveRun();
      return { shrine, before, cleared, after: matching[0] || null, duplicates: matching.length, saved: test.savedRun() };
    });

    const regionalAssets = await primary.page.evaluate(async (biomes) => {
      const test = window.__ASHENHOLD_TEST__;
      await Promise.all(biomes.map((biome) => test.awaitBiomeAssets(biome)));
      return test.regionalAssetDebug();
    }, BIOMES);

    await primary.page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
    await primary.page.waitForFunction(() => window.ashenholdGame?.snapshot?.().state === "title", null, { timeout: 70000 });
    await primary.page.evaluate(() => window.__ASHENHOLD_TEST__.start());
    const restored = await primary.page.evaluate((strongholdId) => ({
      snapshot: window.ashenholdGame.snapshot(),
      flag: window.__ASHENHOLD_TEST__.captureFlagDebug().find((entry) => entry.strongholdId === strongholdId) || null,
      saved: window.__ASHENHOLD_TEST__.savedRun(),
      migration: window.__ASHENHOLD_TEST__.legacySaveMigrationProbe?.() || null
    }), shrineCapture.shrine?.id || "");

    const momentum = await primary.page.evaluate(() => window.__ASHENHOLD_TEST__.jumpMomentumProbe?.() || null);
    const sprintMomentum = momentum?.sprint || null;
    const allDiagnostics = [primary.diagnostics, legacy.diagnostics];
    const continentBiomeList = (primary.snapshot.world?.continent?.zones || primary.snapshot.world?.continent?.biomes || [])
      .map(normalizeBiome).sort();
    const savedHasLegacyKeys = containsForbiddenPublicKey(shrineCapture.saved);
    const flag = shrineCapture.after;
    const restoredFlag = restored.flag;

    report.world = {
      id: primaryWorldId,
      legacyId: legacyWorldId,
      signature: primarySignature,
      legacySignature,
      zones: primaryZones,
      legacyZones,
      traversedZones
    };
    report.shrine = { capture: shrineCapture, restored: restoredFlag };
    report.regionalAssets = regionalAssets;
    report.momentum = momentum;
    report.migration = restored.migration;
    report.diagnostics = allDiagnostics;
    report.checks = {
      canonicalWorldIdentity: primaryWorldId === WORLD_ID && legacyWorldId === WORLD_ID,
      oneStableLayoutIgnoresLegacyQuery: primarySignature.length > 8 && primarySignature === legacySignature,
      sixZonesInOneSnapshot: zoneBiomes.length === BIOMES.length && JSON.stringify(zoneBiomes) === JSON.stringify([...BIOMES].sort())
        && (continentBiomeList.length === 0 || JSON.stringify(continentBiomeList) === JSON.stringify([...BIOMES].sort())),
      zonesHaveAuthoredCoordinates: zoneCentersValid && new Set(primaryZones.map((zone) => `${zone.center.x},${zone.center.z}`)).size === BIOMES.length,
      biomeDerivedFromPosition: traversedZones.length === BIOMES.length && traversedZones.every((entry) => normalizeBiome(entry.hookBiome) === entry.expected
        && normalizeBiome(entry.activeBiome) === entry.expected && entry.documentToken === documentToken),
      noPublicSeedOrNextRealm: !("realm" in primary.snapshot) && !containsForbiddenPublicKey(primary.snapshot),
      noUserFacingSeedControls: primary.seedControls.length === 0 && legacy.seedControls.length === 0
        && !/(^|\n)\s*seed(?:\s|:|$)/im.test(primary.bodyText) && !/(^|\n)\s*seed(?:\s|:|$)/im.test(legacy.bodyText),
      saveUsesFixedWorldIdentity: Boolean(shrineCapture.saved && !savedHasLegacyKeys
        && (shrineCapture.saved.worldId === WORLD_ID || shrineCapture.saved.world?.worldId === WORLD_ID || shrineCapture.saved.world?.continentId === WORLD_ID)),
      legacySaveMigratesWithoutRegeneration: Boolean(restored.migration?.accepted && restored.migration.worldId === WORLD_ID
        && restored.migration.positionRestored && restored.migration.progressionRestored && restored.migration.legacySeedIgnored),
      tallShrineFlagRaisedOnce: Boolean(shrineCapture.shrine && shrineCapture.cleared && shrineCapture.before && !shrineCapture.before.visible
        && flag?.visible && flag.raised === 1 && flag.minimapMarker && flag.height >= 10 && shrineCapture.duplicates === 1),
      shrineFlagPersistsAfterReload: Boolean(restoredFlag?.visible && restoredFlag.raised === 1 && restoredFlag.minimapMarker
        && restoredFlag.height >= 10),
      regionalAssetsSettleBeforeReload: regionalAssets.length === BIOMES.length
        && regionalAssets.every((entry) => entry.requested && entry.texturesReady && entry.enemiesReady),
      sprintJumpMaintainsMomentum: Boolean(sprintMomentum && sprintMomentum.takeoffSpeed >= 8
        && sprintMomentum.airborneSpeed >= sprintMomentum.takeoffSpeed * .8 && sprintMomentum.directionAlignment >= .9),
      noBrowserDiagnostics: allDiagnostics.every((entry) => !entry.consoleErrors.length && !entry.pageErrors.length
        && !entry.failedRequests.length && !entry.badResponses.length)
    };
  } catch (error) {
    report.failure = { name: error.name, message: error.message, stack: error.stack };
  } finally {
    await Promise.all([mainContext.close(), legacyContext.close()]).catch(() => {});
    await browser.close().catch(() => {});
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report, null, 2));
  const failed = Object.entries(report.checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (report.failure || failed.length) {
    if (failed.length) console.error(`Failed fixed-world checks: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
