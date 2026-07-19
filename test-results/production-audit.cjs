"use strict";

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = (process.env.ASHENHOLD_BASE || "http://127.0.0.1:4173/").replace(/\/?$/, "/");
const BIOMES = ["snowy", "jungle", "desert", "shore", "mountains", "moon"];

function correlation(a, b) {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;
  a.forEach((value, index) => {
    const da = value - meanA;
    const db = b[index] - meanB;
    numerator += da * db;
    denominatorA += da * da;
    denominatorB += db * db;
  });
  return numerator / Math.sqrt(denominatorA * denominatorB);
}

function instrument(page, label, diagnostics) {
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.errors.push(label + ": " + message.text());
    if (message.type() === "warning" && !/ReadPixels|GPU stall/i.test(message.text())) diagnostics.warnings.push(label + ": " + message.text());
  });
  page.on("pageerror", (error) => diagnostics.errors.push(label + ": " + error.message));
  page.on("requestfailed", (request) => diagnostics.http.push(label + ": FAILED " + request.url()));
  page.on("response", (response) => { if (response.status() >= 400) diagnostics.http.push(label + ": " + response.status() + " " + response.url()); });
}

async function boot(context, biome, seed, diagnostics, suffix) {
  const page = await context.newPage();
  const label = biome + "-" + seed + (suffix || "");
  instrument(page, label, diagnostics);
  await page.goto(BASE + "?test&biome=" + biome + "&seed=" + seed, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => window.ashenholdGame && window.ashenholdGame.snapshot().state === "title", null, { timeout: 70000 });
  const snapshot = await page.evaluate(() => window.ashenholdGame.snapshot());
  const terrain = await page.evaluate(() => window.__ASHENHOLD_TEST__.terrainSignature());
  return { page, snapshot, terrain, label };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const diagnostics = { errors: [], warnings: [], http: [] };
  const realmMatrix = [];

  for (let index = 0; index < BIOMES.length; index += 1) {
    const biome = BIOMES[index];
    const first = await boot(context, biome, 610001 + index * 101, diagnostics, "-primary");
    await first.page.screenshot({ path: "test-results/biome-" + biome + ".png" });
    const platform = await first.page.evaluate(() => window.__ASHENHOLD_TEST__.platformProbe());
    await first.page.evaluate(() => {
      window.__ASHENHOLD_TEST__.start();
      window.__ASHENHOLD_TEST__.placeEnemy("biomeLight", 6, 100);
      window.__ASHENHOLD_TEST__.step(.12);
    });
    const enemies = await first.page.evaluate(() => window.__ASHENHOLD_TEST__.enemyDebug());
    const enemy = enemies.filter((entry) => !entry.camp)[0] || enemies[0];
    const alternate = await boot(context, biome, 910003 + index * 103, diagnostics, "-alternate");
    const terrainCorrelation = correlation(first.terrain, alternate.terrain);
    const layoutsDiffer = JSON.stringify(first.snapshot.world.layoutForts) !== JSON.stringify(alternate.snapshot.world.layoutForts);
    realmMatrix.push({
      biome,
      geometry: first.snapshot.world.biomeGeometry,
      enemyModels: first.snapshot.world.biomeEnemyModels,
      renderedEnemy: enemy ? { name: enemy.name, kind: enemy.kind, animation: enemy.animation } : null,
      routes: first.snapshot.world.routeReports,
      platform,
      terrainCorrelation,
      layoutsDiffer,
      checks: {
        pbr: first.snapshot.world.pbrBiomeMaterial,
        titleVantageDry: first.snapshot.position.y > first.snapshot.world.waterLevel + 1,
        activeModelsLoaded: first.snapshot.world.importedModels >= 17,
        biomeEnemyRendered: Boolean(enemy && first.snapshot.world.biomeEnemyNames.includes(enemy.name)),
        routesValid: first.snapshot.world.routeReports.length === 2 && first.snapshot.world.routeReports.every((route) => route.valid),
        platformWalkable: Boolean(platform && platform.moved > .25 && Math.abs(platform.surface - platform.top) < .01 && platform.blocksBelow && !platform.blocksAbove),
        differentSeedGeometry: layoutsDiffer && terrainCorrelation < .999
      }
    });
    await first.page.close();
    await alternate.page.close();
  }

  const progressionContext = await browser.newContext({ viewport: { width: 1365, height: 768 } });
  await progressionContext.addInitScript(() => {
    if (sessionStorage.getItem("audit-progression-seeded")) return;
    sessionStorage.setItem("audit-progression-seeded", "1");
    localStorage.setItem("ashenhold-progression-v3", JSON.stringify({
      version: 4, level: 12, xp: 20, skillPoints: 8, activeWeapon: "blade",
      mastery: { blade: { level: 10, xp: 0 }, bow: { level: 1, xp: 0 }, axe: { level: 1, xp: 0 }, staff: { level: 1, xp: 0 } },
      skills: { vitality: true, edge: true }
    }));
  });
  const progressionPage = await progressionContext.newPage();
  instrument(progressionPage, "progression", diagnostics);
  const progressionUrl = BASE + "?test&test-save&biome=desert&seed=737373";
  await progressionPage.goto(progressionUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await progressionPage.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  const migrated = await progressionPage.evaluate(() => window.ashenholdGame.snapshot());
  await progressionPage.evaluate(() => window.__ASHENHOLD_TEST__.start());
  const wrongWeaponGate = await progressionPage.evaluate(() => window.__ASHENHOLD_TEST__.canPurchaseSkill("marksman"));
  const ranked = await progressionPage.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    test.setSkillResources(20, 12, 12, { bow: 2 });
    const correctWeaponGate = test.canPurchaseSkill("marksman");
    test.purchaseSkill("vitality");
    test.purchaseSkill("vitality");
    test.purchaseSkill("run_damage");
    test.purchaseSkill("run_damage");
    test.teleport(42, 118);
    test.collectNearestRune();
    test.saveRun();
    return { correctWeaponGate, snapshot: window.ashenholdGame.snapshot(), saved: test.savedRun() };
  });
  await progressionPage.waitForTimeout(500);
  await progressionPage.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await progressionPage.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  const continueLabel = await progressionPage.locator("#enterButton span").textContent();
  await progressionPage.evaluate(() => window.__ASHENHOLD_TEST__.start());
  const restored = await progressionPage.evaluate(() => window.ashenholdGame.snapshot());
  const progression = {
    migrated,
    wrongWeaponGate,
    correctWeaponGate: ranked.correctWeaponGate,
    purchased: ranked.snapshot,
    restored,
    continueLabel,
    checks: {
      booleanMigration: migrated.skillRanks.vitality === 1 && migrated.skillRanks.edge === 1,
      specificWeaponGate: wrongWeaponGate === false && ranked.correctWeaponGate === true,
      rankedPurchases: ranked.snapshot.skillRanks.vitality === 3 && ranked.snapshot.runSkills.run_damage === 2,
      activeRunWritten: Boolean(ranked.saved && ranked.saved.status === "active" && ranked.saved.layoutVersion === 5),
      activeRunRestored: restored.realm.seed === 737373 && restored.runesCollected === ranked.snapshot.runesCollected && restored.runSkills.run_damage === 2 && Math.abs(restored.position.x - ranked.snapshot.position.x) < .1,
      continueAffordance: /CONTINUE/.test(continueLabel)
    }
  };
  await progressionContext.close();

  const combatPage = await context.newPage();
  instrument(combatPage, "combat", diagnostics);
  await combatPage.goto(BASE + "?test&biome=moon&seed=818181", { waitUntil: "domcontentloaded", timeout: 90000 });
  await combatPage.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  const combat = await combatPage.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    test.start();
    test.placeEnemy("biomeLight", 20, 100);
    const locked = test.toggleTargetLock();
    const healthBeforeDodge = window.ashenholdGame.snapshot().health;
    const dodgeStarted = test.dodge();
    test.step(.15);
    test.damagePlayer(20, "IFRAME TEST");
    const healthInsideIframes = window.ashenholdGame.snapshot().health;
    test.step(.3);
    test.damagePlayer(20, "RECOVERY TEST");
    const healthOutsideIframes = window.ashenholdGame.snapshot().health;
    test.step(.25);
    const telegraphStarted = test.forceEnemyAttack();
    const healthBeforeTelegraph = window.ashenholdGame.snapshot().health;
    test.step(.2);
    const healthDuringWindup = window.ashenholdGame.snapshot().health;
    test.step(.2);
    const healthAfterStrike = window.ashenholdGame.snapshot().health;
    test.placeEnemy("biomeLight", 3.1, 100);
    test.equipWeapon("axe", true);
    test.attack();
    test.step(.42);
    const postHit = window.ashenholdGame.snapshot();
    const enemies = test.enemyDebug();
    return {
      locked, dodgeStarted, healthBeforeDodge, healthInsideIframes, healthOutsideIframes,
      telegraphStarted, healthBeforeTelegraph, healthDuringWindup, healthAfterStrike, postHit, enemies
    };
  });
  combat.checks = {
    targetLock: combat.locked && Boolean(combat.postHit.combat.locked),
    dodgeIframes: combat.dodgeStarted && combat.healthInsideIframes === combat.healthBeforeDodge && combat.healthOutsideIframes < combat.healthInsideIframes,
    telegraphBeforeDamage: combat.telegraphStarted && combat.healthDuringWindup === combat.healthBeforeTelegraph && combat.healthAfterStrike < combat.healthDuringWindup,
    hitStop: combat.postHit.combat.hitStopRemaining > 0,
    axeKnockback: combat.enemies.some((enemy) => enemy.impulse > 1 && enemy.health < 100)
  };
  combat.capstones = await combatPage.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    test.clearGroundEnemies();
    test.setSkillForTest("pathfinder", 1);
    const beforeReveal = window.ashenholdGame.snapshot().world.landmarksRevealed;
    const fort = window.ashenholdGame.snapshot().world.layoutForts[0];
    test.teleport(fort.x + 120, fort.z);
    test.step(.03);
    const afterReveal = window.ashenholdGame.snapshot().world.landmarksRevealed;

    test.clearGroundEnemies();
    test.setSkillForTest("world_voice", 1);
    test.placeEnemy("biomeLight", 6, 500);
    test.placeEnemy("biomeHeavy", 12, 500);
    test.shoutReady();
    test.shout();
    const worldVoice = { enemies: test.enemyDebug(), lightning: window.ashenholdGame.snapshot().combat.lightningArcs };

    test.clearGroundEnemies();
    test.setSkillForTest("storm_archer", 1);
    test.equipWeapon("bow", true);
    const archerFirst = test.placeEnemy("biomeLight", 6, 500);
    test.placeEnemy("biomeHeavy", 10, 500);
    test.step(.6);
    test.forceCritical();
    test.aimAt(archerFirst);
    test.attack();
    test.step(.38);
    const stormArcher = { enemies: test.enemyDebug(), lightning: window.ashenholdGame.snapshot().combat.lightningArcs };

    test.clearGroundEnemies();
    test.setSkillForTest("world_splitter", 1);
    test.equipWeapon("axe", true);
    test.placeEnemy("biomeLight", 3, 500);
    test.placeEnemy("biomeHeavy", 10, 500);
    test.step(.25);
    test.attack();
    test.step(.4);
    const worldSplitter = test.enemyDebug();
    return { beforeReveal, afterReveal, worldVoice, stormArcher, worldSplitter };
  });
  combat.checks.pathfinderReveal = combat.capstones.afterReveal > combat.capstones.beforeReveal;
  combat.checks.worldVoiceChain = combat.capstones.worldVoice.enemies.length === 2 && combat.capstones.worldVoice.enemies[1].health < combat.capstones.worldVoice.enemies[0].health && combat.capstones.worldVoice.lightning > 0;
  combat.checks.stormArcherChain = combat.capstones.stormArcher.enemies.length === 2 && combat.capstones.stormArcher.enemies.every((enemy) => enemy.health < 500) && combat.capstones.stormArcher.lightning > 0;
  combat.checks.worldSplitterPulse = combat.capstones.worldSplitter.length === 2 && combat.capstones.worldSplitter[1].health < 500 && combat.capstones.worldSplitter[1].impulse > 1;
  await combatPage.close();

  const wavesPage = await context.newPage();
  instrument(wavesPage, "waves", diagnostics);
  await wavesPage.goto(BASE + "?test&biome=snowy&seed=929292", { waitUntil: "domcontentloaded", timeout: 90000 });
  await wavesPage.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  const waves = await wavesPage.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    test.start();
    test.setQuestComplete();
    const targets = [];
    for (let wave = 1; wave <= 5; wave += 1) {
      test.skipIntermission();
      targets.push(window.ashenholdGame.snapshot().waveTotal);
      test.completeCurrentWave();
    }
    const completion = window.ashenholdGame.snapshot();
    test.skipIntermission();
    const afterExtraStart = window.ashenholdGame.snapshot();
    return { targets, completion, afterExtraStart };
  });
  await wavesPage.waitForFunction(() => window.ashenholdGame.snapshot().state === "ended", null, { timeout: 5000 });
  waves.ended = await wavesPage.evaluate(() => window.ashenholdGame.snapshot());
  waves.checks = {
    exactTargets: JSON.stringify(waves.targets) === JSON.stringify([4, 6, 8, 10, 12]),
    fiveWaveCap: waves.completion.wave === 5 && waves.completion.maxWaves === 5 && waves.afterExtraStart.wave === 5,
    unifiedVictory: waves.completion.assaultCompleted && waves.completion.questStage === 3 && waves.ended.state === "ended"
  };
  await wavesPage.close();

  const mobileContext = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  instrument(mobilePage, "mobile-landscape", diagnostics);
  await mobilePage.goto(BASE + "?test&biome=shore&seed=303030", { waitUntil: "domcontentloaded", timeout: 90000 });
  await mobilePage.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  await mobilePage.evaluate(() => window.__ASHENHOLD_TEST__.start());
  const mobile = await mobilePage.evaluate(() => {
    const ids = ["joystick", "mobileAttack", "mobileShout", "mobileJump", "mobileWeapon", "mobileDodge", "mobileLock"];
    const controls = Object.fromEntries(ids.map((id) => {
      const element = document.getElementById(id);
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return [id, { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, display: style.display, visibility: style.visibility }];
    }));
    const dodgeStarted = window.__ASHENHOLD_TEST__.dodge();
    return { controls, dodgeStarted, snapshot: window.ashenholdGame.snapshot(), width: innerWidth, height: innerHeight };
  });
  mobile.checks = {
    allControlsVisible: Object.values(mobile.controls).every((rect) => rect.display !== "none" && rect.visibility !== "hidden" && rect.left >= -1 && rect.top >= -1 && rect.right <= mobile.width + 1 && rect.bottom <= mobile.height + 1),
    touchDodge: mobile.dodgeStarted && mobile.snapshot.combat.dodging,
    noMinimumHeightOverflow: mobile.height === 390
  };
  await mobilePage.screenshot({ path: "test-results/mobile-landscape.png" });
  await mobileContext.close();

  const checks = {
    realmMatrix: realmMatrix.every((realm) => Object.values(realm.checks).every(Boolean)),
    uniqueBiomeGeometry: new Set(realmMatrix.map((realm) => realm.geometry)).size === 6,
    uniqueEnemyRosters: new Set(realmMatrix.map((realm) => realm.enemyModels.join("/"))).size === 6,
    progression: Object.values(progression.checks).every(Boolean),
    combat: Object.values(combat.checks).every(Boolean),
    waves: Object.values(waves.checks).every(Boolean),
    mobile: Object.values(mobile.checks).every(Boolean),
    noConsoleErrors: diagnostics.errors.length === 0,
    noConsoleWarnings: diagnostics.warnings.length === 0,
    noHttpFailures: diagnostics.http.length === 0
  };
  const report = { generatedAt: new Date().toISOString(), checks, realmMatrix, progression, combat, waves, mobile, diagnostics };
  fs.writeFileSync("test-results/production-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks, realmChecks: realmMatrix.map((realm) => ({ biome: realm.biome, correlation: realm.terrainCorrelation, checks: realm.checks })), progression: progression.checks, combat: combat.checks, waves: waves.checks, mobile: mobile.checks, diagnostics }, null, 2));
  await context.close();
  await browser.close();
  if (Object.values(checks).some((value) => !value)) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
