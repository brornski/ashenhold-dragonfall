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
  await page.screenshot({ path: "test-results/title-latest.png", fullPage: true });

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

  await page.evaluate(() => {
    window.__ASHENHOLD_TEST__.teleport(0, 182);
    window.__ASHENHOLD_TEST__.skipIntermission();
    window.__ASHENHOLD_TEST__.step(.12);
  });
  const waveOne = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.screenshot({ path: "test-results/assault-wave-latest.png", fullPage: true });
  for (let i = 0; i < 14; i += 1) {
    await page.evaluate(() => {
      window.__ASHENHOLD_TEST__.step(.8);
      window.__ASHENHOLD_TEST__.defeatWave();
      window.__ASHENHOLD_TEST__.step(.08);
    });
    const phase = await page.evaluate(() => window.ashenholdGame.snapshot().wavePhase);
    if (phase === "intermission") break;
  }
  const betweenWaves = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.evaluate(() => window.__ASHENHOLD_TEST__.skipIntermission());
  const waveTwo = await page.evaluate(() => window.ashenholdGame.snapshot());

  const beforeDragon = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.evaluate(() => {
    window.__ASHENHOLD_TEST__.completeCurrentWave();
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
    test.teleport(spots[0].x, spots[0].z);
    const before = window.ashenholdGame.snapshot();
    if (before.health > 45) test.damagePlayer(35, "CHEST TEST");
    const damaged = window.ashenholdGame.snapshot().health;
    test.interact();
    let after = window.ashenholdGame.snapshot();
    if (after.chestsOpened === before.chestsOpened) test.interact();
    after = window.ashenholdGame.snapshot();
    return {
      found: spots.length,
      opened: after.chestsOpened === before.chestsOpened + 1,
      healed: after.health > damaged,
      xpChanged: after.level > before.level || after.xp !== before.xp,
      openedCount: after.chestsOpened
    };
  });
  const routeWalkability = await page.evaluate(() => window.ashenholdGame.snapshot().world.routeReports);
  const biomeProps = await page.evaluate(() => window.ashenholdGame.snapshot().world.props);
  const poiInfo = await page.evaluate(() => ({ pois: window.ashenholdGame.snapshot().world.pois, debug: window.__ASHENHOLD_TEST__.poiDebug() }));
  const legendCount = await page.evaluate(() => document.querySelectorAll("#mapLegend > *").length);

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
  await page.keyboard.up("KeyW");
  await page.keyboard.up("Control");

  const beforeLook = await page.evaluate(() => window.ashenholdGame.snapshot().camera);
  await page.evaluate(() => window.__ASHENHOLD_TEST__.look(-2700, -140));
  const afterLook = await page.evaluate(() => window.ashenholdGame.snapshot().camera);
  await page.evaluate(() => window.__ASHENHOLD_TEST__.swapShoulder());
  const leftShoulder = await page.evaluate(() => { window.__ASHENHOLD_TEST__.step(.3); return window.ashenholdGame.snapshot().camera; });
  const finalPlaying = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.evaluate(() => window.__ASHENHOLD_TEST__.endRun(false));
  const ended = await page.evaluate(() => window.ashenholdGame.snapshot());

  const sprintDistance = Math.hypot(superSprint.position.x - sprintStart.x, superSprint.position.z - sprintStart.z);
  const checks = {
    booted: titleSnapshot.state === "title",
    correctRealm: titleSnapshot.realm.biome === "jungle" && titleSnapshot.realm.seed === 424242,
    pbrBiomeMaterial: titleSnapshot.world.pbrBiomeMaterial,
    animatedWarden: titleSnapshot.world.animatedWarden,
    importedModels: titleSnapshot.world.importedModels >= 15,
    biomeGrass: titleSnapshot.world.grassInstances >= 1200,
    platforms: titleSnapshot.world.platforms >= 10,
    expandedSkillTrees: titleSnapshot.skillBranches >= 11 && titleSnapshot.skillNodes >= 60,
    overShoulderCamera: initial.camera.overShoulder && initial.camera.shoulderSide === "right" && initial.camera.playerScreen.x < -.08,
    bladeKilledCloseEnemy: afterBlade.kills >= initial.kills + 1,
    bowKilledLongEnemy: afterBow.kills >= afterBlade.kills + 1,
    crosshairFindsTarget: Boolean(aimOnEnemy.target),
    crosshairConverges: aimClear.rayDistance < .6,
    runeGrantsXpOnly: afterRune.runesCollected === beforeRune.runesCollected + 1 && afterRune.wave === 0 && (afterRune.level > beforeRune.level || afterRune.xp > beforeRune.xp),
    automaticWaveOne: waveOne.wave === 1 && waveOne.waveActive && waveOne.waveTotal === 4 && waveOne.waveSpawned >= 1,
    intermissionTimer: betweenWaves.wavePhase === "intermission" && betweenWaves.wave === 1 && betweenWaves.waveTimer > 6,
    waveTwoAutomatic: waveTwo.wave === 2 && waveTwo.waveActive && waveTwo.waveTotal === 6,
    higherJump: jumpPeak - jumpStart > 4.5,
    superSprint: superSprint.superSprinting && sprintDistance > 7,
    cameraOrbit: Math.abs(afterLook.yaw - beforeLook.yaw) > Math.PI * 1.5,
    cameraPitchResponds: afterLook.pitch < beforeLook.pitch,
    shoulderSwap: leftShoulder.shoulderSide === "left" && leftShoulder.shoulderOffset < 0,
    dragonMeleeKill: afterDragon.kills >= beforeDragon.kills + 1,
    dragonDropsSouls: afterDragon.souls >= 3,
    dragonGrantsXp: afterDragon.level > beforeDragon.level || afterDragon.xp !== beforeDragon.xp,
    soulAbsorbGrantsXp: Boolean(soulAbsorb.absorbed && soulAbsorb.xpChanged),
    combatTextRenders: combatTextCount > 0,
    chestGrantsRewards: Boolean(chestResult.found >= 5 && chestResult.opened && chestResult.healed && chestResult.xpChanged),
    routesWalkable: routeWalkability.length === 2 && routeWalkability.every((route) => route.valid),
    biomePropsPresent: Boolean(biomeProps && biomeProps.total > 0 && biomeProps.kind),
    poisPresent: Boolean(poiInfo.pois && poiInfo.pois.length >= 5 && poiInfo.debug && poiInfo.debug.every((poi) => poi.collidersAdded > 0)),
    poiChestsExist: initial.totalChests >= 9,
    sprintPoseEngages: Boolean(superSprint.combat && superSprint.combat.sprintPose > .5),
    minimapLegend: legendCount >= 10,
    dragonFacesForward: finalPlaying.dragonForwardDot == null || finalPlaying.dragonForwardDot > 0.5,
    nextRealmPrepared: ended.state === "ended" && ended.realm.next && ended.realm.next.biome !== ended.realm.biome,
    noConsoleErrors: consoleErrors.length === 0,
    noConsoleWarnings: consoleWarnings.length === 0,
    noPageErrors: pageErrors.length === 0,
    noFailedRequests: failedRequests.length === 0
  };
  const report = { checks, jump: { start: jumpStart, peak: jumpPeak, height: jumpPeak - jumpStart }, sprintDistance, titleSnapshot, initial, afterBlade, afterBow, aimOnEnemy, aimClear, beforeRune, afterRune, waveOne, betweenWaves, waveTwo, afterDragon, soulAbsorb, combatTextCount, chestResult, routeWalkability, biomeProps, poiInfo, legendCount, superSprint, finalPlaying, ended, consoleErrors, consoleWarnings, pageErrors, failedRequests };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (Object.values(checks).some((value) => !value)) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
