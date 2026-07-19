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
    await first.page.screenshot({ path: "test-results/biome-" + biome + ".png", timeout: 90000 });
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
      sky: first.snapshot.world.skyProfile,
      forest: first.snapshot.world.forest,
      infrastructure: first.snapshot.world.infrastructure,
      canonicalScale: first.snapshot.world.canonicalScale,
      renderedEnemy: enemy ? { name: enemy.name, kind: enemy.kind, animation: enemy.animation } : null,
      routes: first.snapshot.world.routeReports,
      platform,
      terrainCorrelation,
      layoutsDiffer,
      checks: {
        pbr: first.snapshot.world.pbrBiomeMaterial,
        titleVantageDry: first.snapshot.position.y > first.snapshot.world.waterLevel + 1,
        activeModelsLoaded: first.snapshot.world.importedModels >= 17,
        denseImportedWorld: first.snapshot.world.importedModelInstances >= 120,
        canonicalMeters: first.snapshot.world.canonicalScale.unitMeters === 1 && first.snapshot.world.canonicalScale.wardenHeight === 1.9,
        playerScaledBuildings: ["tavern", "homeA", "homeB", "ruinedHouse"].every((id) => {
          const structure = first.snapshot.world.canonicalScale.structures[id];
          return structure && structure.height >= 8 && structure.height <= 12;
        }),
        playerScaledCastle: first.snapshot.world.canonicalScale.structures.wall.height >= 9 && first.snapshot.world.canonicalScale.structures.wall.height <= 15
          && first.snapshot.world.canonicalScale.structures.gate.height >= 7 && first.snapshot.world.canonicalScale.structures.gate.height <= 10
          && first.snapshot.world.canonicalScale.structures.tower.height >= 18 && first.snapshot.world.canonicalScale.structures.tower.height <= 32,
        ancientForestDensity: first.snapshot.world.forest.total >= 2000 && first.snapshot.world.forest.instancedMeshes === first.snapshot.world.forest.chunks * 3,
        forestLodCulling: first.snapshot.world.forest.nearChunks > 0 && first.snapshot.world.forest.farChunks > 0
          && first.snapshot.world.forest.culledChunks > 0 && first.snapshot.world.forest.visible < first.snapshot.world.forest.total,
        infrastructureMicroLandmarks: first.snapshot.world.infrastructure.total >= 24 && Object.keys(first.snapshot.world.infrastructure.byKind).length >= 4,
        biomeSkyTransition: first.snapshot.world.skyProfile.features.length >= 3 && first.snapshot.world.skyProfile.featureCount > 0
          && first.snapshot.world.skyProfile.gradientStops >= 5 && first.snapshot.world.skyProfile.horizonBlend && first.snapshot.world.skyProfile.environmentMap,
        biomeEnemyRendered: Boolean(enemy && first.snapshot.world.biomeEnemyNames.includes(enemy.name)),
        locationGarrisons: first.snapshot.strongholds.total >= 12 && first.snapshot.strongholds.list.every((stronghold) => stronghold.alive >= 3),
        expandedPois: first.snapshot.world.pois.length >= 8,
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
    const chest = test.chestPositions()[0];
    test.positionAtChest(chest.id);
    test.openChest(chest.id);
    test.teleport(42, 118);
    test.collectNearestRune();
    const shrine = test.strongholdDebug().find((stronghold) => stronghold.kind === "shrine" || stronghold.kind === "graveyard");
    const captureBefore = shrine ? test.captureFlagDebug().find((flag) => flag.strongholdId === shrine.id) : null;
    const shrineCleared = shrine ? test.clearStronghold(shrine.id) : false;
    test.step(2);
    const captureAfter = shrine ? test.captureFlagDebug().find((flag) => flag.strongholdId === shrine.id) : null;
    test.saveRun();
    return { correctWeaponGate, shrine, captureBefore, shrineCleared, captureAfter, snapshot: window.ashenholdGame.snapshot(), saved: test.savedRun() };
  });
  await progressionPage.waitForTimeout(500);
  await progressionPage.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await progressionPage.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  const continueLabel = await progressionPage.locator("#enterButton span").textContent();
  await progressionPage.evaluate(() => window.__ASHENHOLD_TEST__.start());
  const restored = await progressionPage.evaluate(() => window.ashenholdGame.snapshot());
  const restoredCaptureFlags = await progressionPage.evaluate(() => window.__ASHENHOLD_TEST__.captureFlagDebug());
  const progression = {
    migrated,
    wrongWeaponGate,
    correctWeaponGate: ranked.correctWeaponGate,
    purchased: ranked.snapshot,
    restored,
    capture: { shrine: ranked.shrine, before: ranked.captureBefore, after: ranked.captureAfter, restored: restoredCaptureFlags },
    continueLabel,
    checks: {
      booleanMigration: migrated.skillRanks.vitality === 1 && migrated.skillRanks.edge === 1,
      relicMigration: Object.values(migrated.relicBonuses).every((value) => value === 0),
      specificWeaponGate: wrongWeaponGate === false && ranked.correctWeaponGate === true,
      rankedPurchases: ranked.snapshot.skillRanks.vitality === 3 && ranked.snapshot.runSkills.run_damage === 2,
      sprintTreePresent: migrated.skillBranches >= 12 && migrated.skillNodes >= 66,
      permanentChestPower: Object.values(ranked.snapshot.relicBonuses).some((value) => value > 0) && JSON.stringify(restored.relicBonuses) === JSON.stringify(ranked.snapshot.relicBonuses),
      activeRunWritten: Boolean(ranked.saved && ranked.saved.status === "active" && ranked.saved.layoutVersion === 7 && Array.isArray(ranked.saved.world.strongholds)),
      activeRunRestored: restored.realm.seed === 737373 && restored.runesCollected === ranked.snapshot.runesCollected && restored.chestsOpened === ranked.snapshot.chestsOpened && restored.runSkills.run_damage === 2 && Math.abs(restored.position.x - ranked.snapshot.position.x) < .1,
      shrineFlagCaptured: Boolean(ranked.shrine && ranked.captureBefore && !ranked.captureBefore.visible && ranked.shrineCleared
        && ranked.captureAfter && ranked.captureAfter.visible && ranked.captureAfter.raised === 1 && ranked.captureAfter.minimapMarker),
      shrineFlagPersisted: Boolean(ranked.shrine && ranked.saved.world.strongholds.includes(ranked.shrine.id)
        && restoredCaptureFlags.some((flag) => flag.strongholdId === ranked.shrine.id && flag.visible && flag.raised === 1 && flag.minimapMarker)),
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

  const strongholdsPage = await context.newPage();
  instrument(strongholdsPage, "strongholds", diagnostics);
  await strongholdsPage.goto(BASE + "?test&biome=snowy&seed=929292", { waitUntil: "domcontentloaded", timeout: 90000 });
  await strongholdsPage.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  const strongholds = await strongholdsPage.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    test.start();
    const base = window.ashenholdGame.snapshot();
    const first = test.strongholdDebug()[0];
    test.clearStronghold(first.id);
    const afterClear = window.ashenholdGame.snapshot();
    test.setSkillResources(16, 30, 0);
    const scaledAlive = test.respawnActors();
    const scaled = window.ashenholdGame.snapshot();
    test.clearGroundEnemies();
    test.placeEnemy("warg", 4, 40);
    const tamePrepared = test.prepareNearestTame();
    test.interact();
    const tamed = window.ashenholdGame.snapshot();
    test.setSkillForTest("gale_pace", 3);
    test.setSkillForTest("tempest_pace", 3);
    test.setSkillForTest("marathon", 2);
    test.setSkillForTest("second_lungs", 2);
    test.setSkillForTest("stormlaunch", 1);
    test.setSkillForTest("stormstride", 1);
    test.teleport(0, 182);
    test.setStamina(100);
    return { base, first, afterClear, scaledAlive, scaled, tamePrepared, tamed };
  });
  const sprintStartPosition = await strongholdsPage.evaluate(() => window.ashenholdGame.snapshot().position);
  await strongholdsPage.keyboard.down("Control");
  await strongholdsPage.keyboard.down("KeyW");
  await strongholdsPage.evaluate(() => window.__ASHENHOLD_TEST__.step(.25));
  strongholds.intenseSprint = await strongholdsPage.evaluate(() => window.ashenholdGame.snapshot());
  await strongholdsPage.evaluate(() => { window.__ASHENHOLD_TEST__.setStamina(4); window.__ASHENHOLD_TEST__.step(.08); });
  strongholds.lowStamina = await strongholdsPage.evaluate(() => window.ashenholdGame.snapshot());
  await strongholdsPage.evaluate(() => { window.__ASHENHOLD_TEST__.setStamina(1); window.__ASHENHOLD_TEST__.step(.08); });
  strongholds.exhausted = await strongholdsPage.evaluate(() => window.ashenholdGame.snapshot());
  await strongholdsPage.keyboard.up("KeyW");
  await strongholdsPage.keyboard.up("Control");
  strongholds.intenseSprintDistance = Math.hypot(strongholds.intenseSprint.position.x - sprintStartPosition.x, strongholds.intenseSprint.position.z - sprintStartPosition.z);
  strongholds.beforeVictory = await strongholdsPage.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    test.setQuestComplete();
    const objective = test.objectiveInfo();
    test.strongholdDebug().forEach((stronghold) => test.clearStronghold(stronghold.id));
    return { objective, snapshot: window.ashenholdGame.snapshot() };
  });
  await strongholdsPage.waitForFunction(() => window.ashenholdGame.snapshot().state === "ended", null, { timeout: 6000 });
  strongholds.ended = await strongholdsPage.evaluate(() => window.ashenholdGame.snapshot());
  strongholds.checks = {
    locationCount: strongholds.base.strongholds.total >= 12,
    garrisonsSpawned: strongholds.base.strongholds.list.every((stronghold) => stronghold.alive >= 3),
    levelScaling: strongholds.scaledAlive > strongholds.base.strongholds.list.reduce((sum, stronghold) => sum + stronghold.alive, 0) - strongholds.first.alive,
    clearBonus: strongholds.afterClear.strongholds.cleared === 1 && (strongholds.afterClear.level > strongholds.base.level || strongholds.afterClear.xp !== strongholds.base.xp),
    strongholdObjective: Boolean(strongholds.beforeVictory.objective && /^CLEAR /.test(strongholds.beforeVictory.objective.label)),
    taming: strongholds.tamePrepared && strongholds.tamed.companions.length === 1 && strongholds.tamed.bondedPace >= .3,
    sprintTree: strongholds.base.skillBranches >= 12 && strongholds.base.skillNodes >= 66,
    intenseSprint: strongholds.intenseSprint.superSprinting && strongholds.intenseSprintDistance > 12,
    staminaHysteresis: !strongholds.lowStamina.superSprinting && strongholds.lowStamina.sprinting && !strongholds.exhausted.superSprinting && !strongholds.exhausted.sprinting,
    noWaveDirectorState: !("wave" in strongholds.base) && !("wavePhase" in strongholds.base),
    unifiedVictory: strongholds.beforeVictory.snapshot.strongholds.cleared === strongholds.beforeVictory.snapshot.strongholds.total && strongholds.ended.questStage === 3 && strongholds.ended.state === "ended"
  };
  await strongholdsPage.close();

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
    noMinimumHeightOverflow: mobile.height === 390,
    adaptiveForestDensity: mobile.snapshot.world.forest.total >= 900 && mobile.snapshot.world.forest.total <= 2200
      && mobile.snapshot.world.forest.instancedMeshes === mobile.snapshot.world.forest.chunks * 3
  };
  await mobilePage.screenshot({ path: "test-results/mobile-landscape.png", timeout: 90000 });
  await mobileContext.close();

  const checks = {
    realmMatrix: realmMatrix.every((realm) => Object.values(realm.checks).every(Boolean)),
    uniqueBiomeGeometry: new Set(realmMatrix.map((realm) => realm.geometry)).size === 6,
    uniqueEnemyRosters: new Set(realmMatrix.map((realm) => realm.enemyModels.join("/"))).size === 6,
    uniqueBiomeSkies: new Set(realmMatrix.map((realm) => realm.sky.id)).size === 6
      && new Set(realmMatrix.map((realm) => realm.sky.signature)).size === 6,
    uniqueForestProfiles: new Set(realmMatrix.map((realm) => realm.forest.profile)).size === 6,
    progression: Object.values(progression.checks).every(Boolean),
    combat: Object.values(combat.checks).every(Boolean),
    strongholds: Object.values(strongholds.checks).every(Boolean),
    mobile: Object.values(mobile.checks).every(Boolean),
    noConsoleErrors: diagnostics.errors.length === 0,
    noConsoleWarnings: diagnostics.warnings.length === 0,
    noHttpFailures: diagnostics.http.length === 0
  };
  const report = { generatedAt: new Date().toISOString(), checks, realmMatrix, progression, combat, strongholds, mobile, diagnostics };
  fs.writeFileSync("test-results/production-audit.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks, realmChecks: realmMatrix.map((realm) => ({ biome: realm.biome, correlation: realm.terrainCorrelation, checks: realm.checks })), progression: progression.checks, combat: combat.checks, strongholds: strongholds.checks, mobile: mobile.checks, diagnostics }, null, 2));
  await context.close();
  await browser.close();
  if (Object.values(checks).some((value) => !value)) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
