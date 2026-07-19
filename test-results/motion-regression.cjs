"use strict";

const { chromium } = require("playwright");

const BASE = (process.env.ASHENHOLD_BASE || "http://127.0.0.1:4173/").replace(/\/?$/, "/");

function diagnostics(page) {
  const result = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  page.on("requestfailed", (request) => result.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`));
  page.on("response", (response) => { if (response.status() >= 400) result.failedRequests.push(`${response.status()} ${response.url()}`); });
  return result;
}

async function boot(page, biome = "jungle", seed = 424242) {
  await page.goto(`${BASE}?test&biome=${biome}&seed=${seed}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 70000 });
  await page.evaluate(() => window.__ASHENHOLD_TEST__.start());
  await page.waitForFunction(() => window.ashenholdGame.snapshot().state === "playing");
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  const mobile = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const desktopDiagnostics = diagnostics(page);
  const mobileDiagnostics = diagnostics(mobile);
  await Promise.all([boot(page), boot(mobile, "shore", 303030)]);

  const chest = await page.evaluate(() => {
    const test = window.__ASHENHOLD_TEST__;
    const probe = test.chestInteractionProbe();
    const positioned = probe.available ? test.positionAtChest(probe.id) : null;
    const before = window.ashenholdGame.snapshot().chestsOpened;
    const opened = positioned ? test.openChest(probe.id) : false;
    const after = window.ashenholdGame.snapshot().chestsOpened;
    return { probe, positioned, opened, before, after };
  });

  const desktopSkillsButton = await page.locator("#skillsButton").boundingBox();
  await page.click("#skillsButton");
  await page.waitForFunction(() => window.ashenholdGame.snapshot().state === "skills");
  const desktopSkills = await page.evaluate(() => {
    const node = document.querySelector(".skill-node");
    const title = node?.querySelector(".node-copy strong");
    const description = node?.querySelector(".node-copy span");
    const status = node?.querySelector(".node-status");
    return {
      state: window.ashenholdGame.snapshot().state,
      buttonLabel: document.querySelector("#skillsButton span")?.textContent,
      shortcutLabel: document.querySelector("#skillsButton kbd")?.textContent,
      ariaShortcut: document.querySelector("#skillsButton")?.getAttribute("aria-keyshortcuts"),
      titleSize: parseFloat(getComputedStyle(title).fontSize),
      descriptionSize: parseFloat(getComputedStyle(description).fontSize),
      statusSize: parseFloat(getComputedStyle(status).fontSize),
      nodeHeight: node?.getBoundingClientRect().height || 0
    };
  });
  await page.screenshot({ path: "test-results/motion-skills-desktop.png", fullPage: true });
  await page.click("#closeSkillsButton");
  const returnedToGame = await page.evaluate(() => window.ashenholdGame.snapshot().state === "playing");
  await page.keyboard.press("k");
  await page.waitForFunction(() => window.ashenholdGame.snapshot().state === "skills");
  const hotkeyOpenedSkills = await page.evaluate(() => window.ashenholdGame.snapshot().state === "skills");
  await page.keyboard.press("k");
  await page.waitForFunction(() => window.ashenholdGame.snapshot().state === "playing");

  await page.evaluate(() => window.__ASHENHOLD_TEST__.prepareSlideSurface("flat"));
  await page.keyboard.down("Shift");
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.08));
  const sprintBeforeJump = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.evaluate(() => window.__ASHENHOLD_TEST__.jump());
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.14));
  const airborneRise = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.72));
  const airborneFall = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.keyboard.up("KeyW");
  await page.keyboard.up("Shift");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(1));
  const landed = await page.evaluate(() => window.ashenholdGame.snapshot());

  const surfaces = await page.evaluate(() => window.__ASHENHOLD_TEST__.slideSurfaceProbe());
  await page.evaluate(() => window.__ASHENHOLD_TEST__.prepareSlideSurface("downhill"));
  const slideStart = await page.evaluate(() => window.ashenholdGame.snapshot().position);
  await page.keyboard.down("Shift");
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.06));
  await page.keyboard.down("Control");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.12));
  const downhillSlide = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.28));
  const acceleratedSlide = await page.evaluate(() => window.ashenholdGame.snapshot());
  const preSlideJump = acceleratedSlide.position;
  await page.evaluate(() => window.__ASHENHOLD_TEST__.jump());
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.08));
  const slideJump = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.keyboard.up("Control");
  await page.keyboard.up("KeyW");
  await page.keyboard.up("Shift");

  await page.evaluate(() => window.__ASHENHOLD_TEST__.prepareSlideSurface("flat"));
  await page.keyboard.down("Shift");
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.06));
  await page.keyboard.down("Control");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.1));
  const flatControl = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.keyboard.up("Control");
  await page.keyboard.up("KeyW");
  await page.keyboard.up("Shift");

  await page.evaluate(() => window.__ASHENHOLD_TEST__.prepareSlideSurface("uphill"));
  await page.keyboard.down("Shift");
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.06));
  await page.keyboard.down("Control");
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(.1));
  const uphillControl = await page.evaluate(() => window.ashenholdGame.snapshot());
  await page.keyboard.up("Control");
  await page.keyboard.up("KeyW");
  await page.keyboard.up("Shift");
  const slideCollision = await page.evaluate(() => window.__ASHENHOLD_TEST__.slideCollisionProbe());

  const mobileSkillsButton = await mobile.locator("#mobileSkills").boundingBox();
  const mobileSlideButton = await mobile.locator("#mobileSlide").boundingBox();
  await mobile.tap("#mobileSkills");
  await mobile.waitForFunction(() => window.ashenholdGame.snapshot().state === "skills");
  const mobileSkills = await mobile.evaluate(() => {
    const node = document.querySelector(".skill-node");
    const title = node?.querySelector(".node-copy strong");
    const description = node?.querySelector(".node-copy span");
    const status = node?.querySelector(".node-status");
    const shell = document.querySelector(".skills-shell").getBoundingClientRect();
    return {
      state: window.ashenholdGame.snapshot().state,
      titleSize: parseFloat(getComputedStyle(title).fontSize),
      descriptionSize: parseFloat(getComputedStyle(description).fontSize),
      statusSize: parseFloat(getComputedStyle(status).fontSize),
      shellWithinViewport: shell.left >= 0 && shell.top >= 0 && shell.right <= innerWidth + 1 && shell.bottom <= innerHeight + 1
    };
  });
  await mobile.screenshot({ path: "test-results/motion-skills-mobile.png" });

  const slideDistance = Math.hypot(acceleratedSlide.position.x - slideStart.x, acceleratedSlide.position.z - slideStart.z);
  const slideJumpDistance = Math.hypot(slideJump.position.x - preSlideJump.x, slideJump.position.z - preSlideJump.z);
  const checks = {
    chestFrontLatchValid: chest.probe.available && chest.probe.valid && chest.probe.validDistance <= 3.5,
    chestFarRejected: chest.probe.farRejected,
    chestBelowRejected: chest.probe.belowRejected,
    chestBehindRejected: chest.probe.behindRejected,
    chestFacingAwayRejected: chest.probe.facingAwayRejected,
    chestAirborneRejected: chest.probe.airborneRejected,
    chestWallRejected: chest.probe.wallRejected,
    chestStillOpensInFront: Boolean(chest.positioned && chest.opened && chest.after === chest.before + 1),
    desktopSkillsAlwaysVisible: Boolean(desktopSkillsButton && desktopSkillsButton.width >= 90 && desktopSkillsButton.height >= 30 && desktopSkills.shortcutLabel === "K"),
    desktopSkillsDirectOpen: desktopSkills.state === "skills" && returnedToGame,
    desktopSkillsHotkey: hotkeyOpenedSkills && desktopSkills.ariaShortcut === "K",
    desktopSkillTypography: desktopSkills.titleSize >= 12 && desktopSkills.descriptionSize >= 10 && desktopSkills.statusSize >= 8.5 && desktopSkills.nodeHeight >= 90,
    sprintBeforeJump: sprintBeforeJump.sprinting,
    airborneStopsRunAnimation: !airborneRise.grounded && !airborneRise.sprinting && !airborneRise.superSprinting && airborneRise.combat.modelAnimation === "idle" && airborneRise.combat.sprintPose < .4,
    airbornePhases: ["jump", "rise", "apex"].includes(airborneRise.airbornePhase) && ["apex", "fall"].includes(airborneFall.airbornePhase),
    landingCompletes: landed.grounded && landed.airbornePhase === "grounded" && landed.combat.modelAnimation !== "run",
    slideSurfacesFound: Boolean(surfaces.downhill && surfaces.flat && surfaces.uphill && surfaces.downhill.angle >= 8 && surfaces.uphill.angle <= -8),
    downhillSlideStarts: downhillSlide.sliding && downhillSlide.slideSlopeDegrees >= 7,
    downhillSlideMoves: acceleratedSlide.sliding && slideDistance > 3 && acceleratedSlide.slideSpeed >= 10,
    slideJumpCarriesMomentum: !slideJump.sliding && !slideJump.grounded && slideJumpDistance > .7 && slideJump.combat.modelAnimation === "idle",
    flatControlRemainsSuperSprint: !flatControl.sliding && flatControl.superSprinting,
    uphillControlRemainsSuperSprint: !uphillControl.sliding && uphillControl.superSprinting,
    slideCollisionStops: slideCollision.available && slideCollision.collision && slideCollision.blocked,
    mobileSkillsVisible: Boolean(mobileSkillsButton && mobileSkillsButton.width >= 65 && mobileSkillsButton.height >= 34),
    mobileSlideVisible: Boolean(mobileSlideButton && mobileSlideButton.width >= 35 && mobileSlideButton.height >= 35),
    mobileSkillsDirectOpen: mobileSkills.state === "skills",
    mobileSkillTypography: mobileSkills.titleSize >= 11.5 && mobileSkills.descriptionSize >= 9.5 && mobileSkills.statusSize >= 8 && mobileSkills.shellWithinViewport,
    noDesktopDiagnostics: !desktopDiagnostics.consoleErrors.length && !desktopDiagnostics.pageErrors.length && !desktopDiagnostics.failedRequests.length,
    noMobileDiagnostics: !mobileDiagnostics.consoleErrors.length && !mobileDiagnostics.pageErrors.length && !mobileDiagnostics.failedRequests.length
  };
  const motionState = (snapshot) => ({
    position: snapshot.position,
    stamina: snapshot.stamina,
    grounded: snapshot.grounded,
    airbornePhase: snapshot.airbornePhase,
    velocityY: snapshot.velocityY,
    sprinting: snapshot.sprinting,
    superSprinting: snapshot.superSprinting,
    sliding: snapshot.sliding,
    slideSpeed: snapshot.slideSpeed,
    slideSlopeDegrees: snapshot.slideSlopeDegrees,
    modelAnimation: snapshot.combat.modelAnimation,
    sprintPose: snapshot.combat.sprintPose,
    slideCollision: snapshot.combat.slideCollision
  });
  const report = {
    checks,
    chest,
    desktopSkills,
    mobileSkills,
    surfaces,
    airborne: {
      sprintBeforeJump: motionState(sprintBeforeJump),
      rise: motionState(airborneRise),
      fall: motionState(airborneFall),
      landed: motionState(landed)
    },
    slide: {
      start: motionState(downhillSlide),
      accelerated: motionState(acceleratedSlide),
      distance: slideDistance,
      jump: motionState(slideJump),
      jumpDistance: slideJumpDistance,
      flatFallback: motionState(flatControl),
      uphillFallback: motionState(uphillControl),
      collision: slideCollision
    },
    diagnostics: { desktop: desktopDiagnostics, mobile: mobileDiagnostics }
  };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (Object.values(checks).some((value) => !value)) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
