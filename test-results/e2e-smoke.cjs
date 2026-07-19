const { chromium } = require("playwright");
const BASE = (process.env.ASHENHOLD_BASE || "http://127.0.0.1:4173/").replace(/\/?$/, "/");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("console", (message) => { if (message.type() === "warning" && !/ReadPixels|GPU stall/i.test(message.text())) consoleWarnings.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`));
  page.on("response", (response) => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });

  await page.goto(BASE + "?test&biome=jungle&seed=424242", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 60000 });
  const titleSnapshot = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.screenshot({ path: "test-results/title-latest.png", fullPage: true, timeout: 90000 });

  await page.evaluate(() => window.__ASHENHOLD_TEST__.start());
  await page.waitForTimeout(450);
  const initial = await page.evaluate(() => window.ashenholdGame.snapshot());

  await page.evaluate(() => {
    window.__ASHENHOLD_TEST__.equipWeapon("blade");
    window.__ASHENHOLD_TEST__.placeEnemy("draugr", 3.2, 12);
    window.__ASHENHOLD_TEST__.attack();
    window.__ASHENHOLD_TEST__.step(.4);
  });
  await page.waitForTimeout(850);
  const afterBlade = await page.evaluate(() => window.ashenholdGame.snapshot());

  await page.evaluate(() => {
    window.__ASHENHOLD_TEST__.equipWeapon("bow", true);
    const bowTarget = window.__ASHENHOLD_TEST__.placeEnemy("warg", 14, 12);
    window.__ASHENHOLD_TEST__.aimAt(bowTarget);
    window.__ASHENHOLD_TEST__.attack();
    window.__ASHENHOLD_TEST__.step(.5);
  });
  await page.waitForTimeout(150);
  const afterBow = await page.evaluate(() => window.ashenholdGame.snapshot());

  const aimOnEnemy = await page.evaluate(() => {
    const aimTarget = window.__ASHENHOLD_TEST__.placeEnemy("warg", 18, 100);
    window.__ASHENHOLD_TEST__.aimAt(aimTarget);
    return window.__ASHENHOLD_TEST__.aimPoint();
  });
  const aimClear = await page.evaluate(() => {
    window.__ASHENHOLD_TEST__.clearGroundEnemies();
    return window.__ASHENHOLD_TEST__.aimPoint();
  });

  await page.evaluate(() => window.__ASHENHOLD_TEST__.teleport(68, 126));
  await page.waitForTimeout(200);
  const beforeRune = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.evaluate(() => window.__ASHENHOLD_TEST__.interact());
  const afterRune = await page.evaluate(() => window.ashenholdGame.snapshot());

  const strongholdResult = await page.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    const before = window.ashenholdGame.snapshot();
    const first = test.strongholdDebug()[0];
    const healthBefore = before.health;
    test.clearStronghold(first.id);
    const after = window.ashenholdGame.snapshot();
    return {
      total: before.strongholds.total,
      baseAlive: first.alive,
      clearedBefore: before.strongholds.cleared,
      clearedAfter: after.strongholds.cleared,
      healthBefore,
      healthAfter: after.health,
      xpChanged: after.level > before.level || after.xp !== before.xp,
      objective: test.objectiveInfo()
    };
  });
  const captureFlagResult = await page.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    const shrine = test.strongholdDebug().find((stronghold) => stronghold.kind === "shrine" || stronghold.kind === "graveyard");
    if (!shrine) return { found: false };
    const before = test.captureFlagDebug().find((flag) => flag.strongholdId === shrine.id);
    const cleared = test.clearStronghold(shrine.id);
    test.step(2);
    const after = test.captureFlagDebug().find((flag) => flag.strongholdId === shrine.id);
    return { found: true, shrine, before, cleared, after };
  });
  await page.screenshot({ path: "test-results/stronghold-latest.png", fullPage: true, timeout: 90000 });

  const beforeDragon = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.evaluate(() => {
    window.__ASHENHOLD_TEST__.teleport(0, 182);
    window.__ASHENHOLD_TEST__.equipWeapon("blade", true);
    window.__ASHENHOLD_TEST__.placeDragon(4, 1.5, 0);
    window.__ASHENHOLD_TEST__.attack();
    window.__ASHENHOLD_TEST__.step(1.6);
  });
  const afterDragon = await page.evaluate(() => window.ashenholdGame.snapshot());
  const combatTextCount = await page.evaluate(() => document.querySelectorAll("#combatText .ct").length);
  const soulAbsorb = await page.evaluate(() => {
    const souls = window.__ASHENHOLD_TEST__.soulPositions().filter((soul) => soul.grounded);
    if (!souls.length) return { found: 0 };
    window.__ASHENHOLD_TEST__.teleport(souls[0].x, souls[0].z);
    const before = window.ashenholdGame.snapshot();
    window.__ASHENHOLD_TEST__.interact();
    const after = window.ashenholdGame.snapshot();
    return {
      found: souls.length,
      soulsBefore: before.souls,
      soulsAfter: after.souls,
      absorbed: after.souls === before.souls - 1,
      xpChanged: after.level > before.level || after.xp !== before.xp
    };
  });

  const chestResult = await page.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    const spots = test.chestPositions();
    if (!spots.length) return { found: 0 };
    const positioned = test.positionAtChest(spots[0].id);
    if (!positioned) return { found: spots.length, positioned: false };
    const before = window.ashenholdGame.snapshot();
    const powerBefore = before.relicBonuses[spots[0].powerUp.type];
    if (before.health > 45) test.damagePlayer(35, "CHEST TEST");
    const damaged = window.ashenholdGame.snapshot().health;
    test.openChest(spots[0].id);
    let after = window.ashenholdGame.snapshot();
    if (after.chestsOpened === before.chestsOpened) test.openChest(spots[0].id);
    after = window.ashenholdGame.snapshot();
    return {
      found: spots.length,
      positioned: true,
      opened: after.chestsOpened === before.chestsOpened + 1,
      healed: after.health > damaged,
      xpChanged: after.level > before.level || after.xp !== before.xp,
      powerUp: spots[0].powerUp,
      permanentPower: after.relicBonuses[spots[0].powerUp.type] === powerBefore + spots[0].powerUp.amount,
      openedCount: after.chestsOpened
    };
  });
  const routeWalkability = await page.evaluate(() => window.ashenholdGame.snapshot().world.routeReports);
  const collisionRecovery = await page.evaluate(() => window.__ASHENHOLD_TEST__.collisionRecoveryProbe());
  const biomeProps = await page.evaluate(() => window.ashenholdGame.snapshot().world.props);
  const modelCatalog = await page.evaluate(() => window.ashenholdGame.modelCatalog());
  const worldDebug = await page.evaluate(() => ({
    scales: window.__ASHENHOLD_TEST__.modelScaleRegistry(),
    forest: window.__ASHENHOLD_TEST__.forestDebug(),
    infrastructure: window.__ASHENHOLD_TEST__.infrastructureDebug(),
    sky: window.__ASHENHOLD_TEST__.skyDebug()
  }));
  const poiInfo = await page.evaluate(() => ({ pois: window.ashenholdGame.snapshot().world.pois, debug: window.__ASHENHOLD_TEST__.poiDebug() }));
  const legendCount = await page.evaluate(() => document.querySelectorAll("#mapLegend > *").length);
  const tamingResult = await page.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    test.teleport(0, 182);
    test.placeEnemy("warg", 4, 30);
    const prepared = test.prepareNearestTame();
    test.interact();
    const after = window.ashenholdGame.snapshot();
    return { prepared, companions: after.companions, bondedPace: after.bondedPace };
  });

  await page.evaluate(() => window.__ASHENHOLD_TEST__.teleport(-115, 70));
  const jumpStart = await page.evaluate(() => window.ashenholdGame.snapshot().position.y);
  await page.evaluate(() => window.__ASHENHOLD_TEST__.jump());
  let jumpPeak = jumpStart;
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(60);
    jumpPeak = Math.max(jumpPeak, await page.evaluate(() => window.ashenholdGame.snapshot().position.y));
  }

  await page.evaluate(() => window.__ASHENHOLD_TEST__.teleport(0, 182));
  const sprintStart = await page.evaluate(() => window.ashenholdGame.snapshot().position);
  await page.keyboard.down("Control");
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.35));
  const superSprint = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.evaluate(() => window.__ASHENHOLD_TEST__.setStamina(4));
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.08));
  const lowStaminaSprint = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.evaluate(() => window.__ASHENHOLD_TEST__.setStamina(1));
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.08));
  const exhaustedSprint = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.keyboard.up("KeyW");
  await page.keyboard.up("Control");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.02));
  await page.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    test.setSkillForTest("gale_pace", 3);
    test.setSkillForTest("tempest_pace", 3);
    test.setSkillForTest("marathon", 2);
    test.setSkillForTest("second_lungs", 2);
    test.setSkillForTest("stormlaunch", 1);
    test.setSkillForTest("stormstride", 1);
    test.setStamina(100);
    test.teleport(0, 182);
  });
  const intenseSprintStart = await page.evaluate(() => window.ashenholdGame.snapshot().position);
  await page.keyboard.down("Control");
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.25));
  const intenseSprint = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.keyboard.up("KeyW");
  await page.keyboard.up("Control");

  const beforeLook = await page.evaluate(() => window.ashenholdGame.snapshot().camera);
  await page.evaluate(() => window.__ASHENHOLD_TEST__.look(-2700, -140));
  const afterLook = await page.evaluate(() => window.ashenholdGame.snapshot().camera);
  await page.evaluate(() => window.__ASHENHOLD_TEST__.swapShoulder());
  const leftShoulder = await page.evaluate(() => { window.__ASHENHOLD_TEST__.step(.3); return window.ashenholdGame.snapshot().camera; });
  const finalPlaying = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    test.setQuestComplete();
    test.strongholdDebug().forEach((stronghold) => test.clearStronghold(stronghold.id));
  });
  await page.waitForFunction(() => window.ashenholdGame.snapshot().state === "ended", null, { timeout: 6000 });
  const ended = await page.evaluate(() => window.ashenholdGame.snapshot());

  const sprintDistance = Math.hypot(superSprint.position.x - sprintStart.x, superSprint.position.z - sprintStart.z);
  const intenseSprintDistance = Math.hypot(intenseSprint.position.x - intenseSprintStart.x, intenseSprint.position.z - intenseSprintStart.z);
  const checks = {
    booted: titleSnapshot.state === "title",
    correctRealm: titleSnapshot.realm.biome === "jungle" && titleSnapshot.realm.seed === 424242,
    pbrBiomeMaterial: titleSnapshot.world.pbrBiomeMaterial,
    animatedWarden: titleSnapshot.world.animatedWarden,
    importedModels: titleSnapshot.world.importedModels >= 15,
    canonicalWorldScale: titleSnapshot.world.canonicalScale.unitMeters === 1 && titleSnapshot.world.canonicalScale.wardenHeight === 1.9 && titleSnapshot.world.canonicalScale.doorWidth >= 2.4,
    playerScaledBuildings: ["tavern", "homeA", "homeB", "ruinedHouse"].every((id) => {
      const structure = titleSnapshot.world.canonicalScale.structures[id];
      return structure && structure.height >= 8 && structure.height <= 12;
    }),
    playerScaledCastles: titleSnapshot.world.canonicalScale.structures.wall.height >= 9 && titleSnapshot.world.canonicalScale.structures.wall.height <= 15
      && titleSnapshot.world.canonicalScale.structures.gate.height >= 7 && titleSnapshot.world.canonicalScale.structures.gate.height <= 10
      && titleSnapshot.world.canonicalScale.structures.tower.height >= 18 && titleSnapshot.world.canonicalScale.structures.tower.height <= 32,
    canonicalRegistryMeasured: Object.keys(worldDebug.scales).length === Object.keys(modelCatalog).length
      && worldDebug.scales.wall.targetHeight === 12.5 && worldDebug.scales.wall.verticalScale < worldDebug.scales.wall.scale,
    ancientInstancedForest: titleSnapshot.world.forest.total >= 3000
      && titleSnapshot.world.forest.instancedMeshes === titleSnapshot.world.forest.chunks * 3
      && titleSnapshot.world.forest.heroes > 0 && titleSnapshot.world.forest.maxTrunkDiameter >= 8,
    forestLodAndCulling: titleSnapshot.world.forest.nearChunks > 0 && titleSnapshot.world.forest.farChunks > 0
      && titleSnapshot.world.forest.culledChunks > 0 && titleSnapshot.world.forest.visible < titleSnapshot.world.forest.total
      && worldDebug.forest.lodChunks.some((chunk) => chunk.lod === "near")
      && worldDebug.forest.lodChunks.some((chunk) => chunk.lod === "far")
      && worldDebug.forest.lodChunks.some((chunk) => chunk.lod === "culled"),
    infrastructureMicroLandmarks: titleSnapshot.world.infrastructure.total >= 24
      && Object.keys(titleSnapshot.world.infrastructure.byKind).length >= 4
      && worldDebug.infrastructure.length === titleSnapshot.world.infrastructure.total,
    biomeSkyAndTransition: titleSnapshot.world.skyProfile.id === "verdant-canopy"
      && titleSnapshot.world.skyProfile.features.length >= 3 && titleSnapshot.world.skyProfile.featureCount > 0
      && titleSnapshot.world.skyProfile.gradientStops >= 5 && titleSnapshot.world.skyProfile.horizonBlend
      && titleSnapshot.world.skyProfile.environmentMap && worldDebug.sky.signature === titleSnapshot.world.skyProfile.signature,
    biomeGrass: titleSnapshot.world.grassInstances >= 1200,
    platforms: titleSnapshot.world.platforms >= 10,
    expandedSkillTrees: titleSnapshot.skillBranches >= 12 && titleSnapshot.skillNodes >= 66,
    overShoulderCamera: initial.camera.overShoulder && initial.camera.shoulderSide === "right" && initial.camera.playerScreen.x < -.08,
    bladeKilledCloseEnemy: afterBlade.kills >= initial.kills + 1,
    bowKilledLongEnemy: afterBow.kills >= afterBlade.kills + 1,
    crosshairFindsTarget: Boolean(aimOnEnemy.target),
    crosshairConverges: aimClear.rayDistance < .6,
    runeGrantsXpOnly: afterRune.runesCollected === beforeRune.runesCollected + 1 && afterRune.strongholds.cleared === beforeRune.strongholds.cleared && (afterRune.level > beforeRune.level || afterRune.xp > beforeRune.xp),
    strongholdsPresent: strongholdResult.total >= 8,
    garrisonsSpawned: titleSnapshot.strongholds.list.some((stronghold) => stronghold.alive >= 3),
    clearGrantsBonus: strongholdResult.clearedAfter === strongholdResult.clearedBefore + 1 && strongholdResult.xpChanged,
    shrineCaptureFlag: Boolean(captureFlagResult.found && captureFlagResult.before && !captureFlagResult.before.visible
      && captureFlagResult.cleared && captureFlagResult.after && captureFlagResult.after.visible
      && captureFlagResult.after.raised === 1 && captureFlagResult.after.minimapMarker),
    higherJump: jumpPeak - jumpStart > 4.5,
    superSprint: superSprint.superSprinting && sprintDistance > 7,
    sprintHysteresis: !lowStaminaSprint.superSprinting && lowStaminaSprint.sprinting && !exhaustedSprint.superSprinting && !exhaustedSprint.sprinting,
    intenseSprintTree: intenseSprint.superSprinting && intenseSprintDistance > sprintDistance,
    cameraOrbit: Math.abs(afterLook.yaw - beforeLook.yaw) > Math.PI * 1.5,
    cameraPitchResponds: afterLook.pitch < beforeLook.pitch,
    shoulderSwap: leftShoulder.shoulderSide === "left" && leftShoulder.shoulderOffset < 0,
    dragonMeleeKill: afterDragon.kills >= beforeDragon.kills + 1,
    dragonDropsSouls: afterDragon.souls >= 3,
    dragonGrantsXp: afterDragon.level > beforeDragon.level || afterDragon.xp !== beforeDragon.xp,
    soulAbsorbGrantsXp: Boolean(soulAbsorb.absorbed && soulAbsorb.xpChanged),
    combatTextRenders: combatTextCount > 0,
    chestGrantsRewards: Boolean(chestResult.found >= 5 && chestResult.opened && chestResult.healed && chestResult.xpChanged && chestResult.permanentPower),
    routesWalkable: routeWalkability.length === 2 && routeWalkability.every((route) => route.valid),
    collisionRecovery: Boolean(collisionRecovery.available && collisionRecovery.colliders > 30 && collisionRecovery.blockedBefore && collisionRecovery.recovered && !collisionRecovery.blockedAfter && collisionRecovery.displacement > .1),
    biomePropsPresent: Boolean(biomeProps && biomeProps.total > 0 && biomeProps.kind),
    modelCatalogExposed: Boolean(modelCatalog.warden && modelCatalog.biomeLight && modelCatalog.tower && Object.keys(modelCatalog).length >= 40),
    poisPresent: Boolean(poiInfo.pois && poiInfo.pois.length >= 8 && poiInfo.debug && poiInfo.debug.every((poi) => poi.collidersAdded > 0)),
    poiChestsExist: initial.totalChests >= 13,
    enemyTaming: Boolean(tamingResult.prepared && tamingResult.companions.length === 1 && tamingResult.bondedPace >= .3),
    sprintPoseEngages: Boolean(superSprint.combat && superSprint.combat.sprintPose > .5),
    minimapLegend: legendCount >= 10,
    dragonFacesForward: finalPlaying.dragonForwardDot == null || finalPlaying.dragonForwardDot > 0.5,
    strongholdVictory: ended.state === "ended" && ended.questStage === 3 && ended.strongholds.cleared === ended.strongholds.total,
    nextRealmPrepared: ended.state === "ended" && ended.realm.next && ended.realm.next.biome !== ended.realm.biome,
    noConsoleErrors: consoleErrors.length === 0,
    noConsoleWarnings: consoleWarnings.length === 0,
    noPageErrors: pageErrors.length === 0,
    noFailedRequests: failedRequests.length === 0
  };
  const report = { checks, jump: { start: jumpStart, peak: jumpPeak, height: jumpPeak - jumpStart }, sprintDistance, intenseSprintDistance, titleSnapshot, initial, afterBlade, afterBow, aimOnEnemy, aimClear, beforeRune, afterRune, strongholdResult, captureFlagResult, afterDragon, soulAbsorb, combatTextCount, chestResult, routeWalkability, collisionRecovery, modelCatalog, worldDebug, biomeProps, poiInfo, tamingResult, legendCount, superSprint, lowStaminaSprint, exhaustedSprint, intenseSprint, finalPlaying, ended, consoleErrors, consoleWarnings, pageErrors, failedRequests };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (Object.values(checks).some((value) => !value)) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
