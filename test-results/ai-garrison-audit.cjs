const { chromium } = require("playwright");

const BASE = (process.env.ASHENHOLD_BASE || "http://127.0.0.1:4173/").replace(/\/?$/, "/");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => diagnostics.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`));
  page.on("response", (response) => { if (response.status() >= 400) diagnostics.failedRequests.push(`${response.status()} ${response.url()}`); });

  await page.goto(`${BASE}?test`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => window.ashenholdGame?.snapshot().state === "title", null, { timeout: 60000 });
  const title = await page.evaluate(() => ({
    summary: window.ashenholdGame.snapshot().world.garrisonAI,
    roster: window.__ASHENHOLD_TEST__.garrisonAIDebug(),
    strongholds: window.ashenholdGame.snapshot().strongholds.list
  }));

  await page.evaluate(() => window.__ASHENHOLD_TEST__.start(true));
  await page.evaluate(() => window.__ASHENHOLD_TEST__.step(8));
  const settled = await page.evaluate(() => ({
    summary: window.ashenholdGame.snapshot().world.garrisonAI,
    roster: window.__ASHENHOLD_TEST__.garrisonAIDebug(),
    behavior: window.__ASHENHOLD_TEST__.garrisonBehaviorProbe(),
    occlusion: window.__ASHENHOLD_TEST__.garrisonOcclusionProbe(),
    search: window.__ASHENHOLD_TEST__.garrisonSearchProbe(),
    stuck: window.__ASHENHOLD_TEST__.garrisonStuckRecoveryProbe(),
    path: window.__ASHENHOLD_TEST__.garrisonPathProbe(),
    rosterAfterProbes: window.__ASHENHOLD_TEST__.garrisonAIDebug(),
    summaryAfterProbes: window.ashenholdGame.snapshot().world.garrisonAI
  }));

  const titleKeys = title.roster.map((enemy) => `${enemy.spawnKey}:${enemy.role}:${enemy.state}`).sort();
  const settledKeys = settled.roster.map((enemy) => `${enemy.spawnKey}:${enemy.role}`).sort();
  const patrols = settled.roster.filter((enemy) => enemy.state === "patrol");
  const patrolRoles = settled.roster.filter((enemy) => enemy.role === "patrol_guard" || enemy.role === "beast_patrol");
  const lookoutStrongholds = new Set(title.roster.filter((enemy) => enemy.role === "tower_lookout").map((enemy) => enemy.strongholdId));
  const watchposts = title.strongholds.filter((stronghold) => stronghold.kind === "watchpost").map((stronghold) => stronghold.id);
  const stableRoster = (roster) => roster.map((enemy) => ({
    spawnKey: enemy.spawnKey, state: enemy.state, previousState: enemy.previousState, reason: enemy.reason,
    detection: enemy.detection, pathLength: enemy.pathLength, stuckCount: enemy.stuckCount,
    recoveries: enemy.recoveries, x: enemy.x, y: enemy.y, z: enemy.z
  }));
  const checks = {
    authoredRosterStable: titleKeys.map((entry) => entry.replace(/:guard$/, "")).join("|") === settledKeys.join("|"),
    allGarrisonsAssigned: title.summary.actors >= 50 && title.roster.length === title.summary.actors && title.roster.every((enemy) => enemy.spawnKey && enemy.role && enemy.post && enemy.postDistance < .01),
    spawnAtGuardPosts: title.summary.states.guard === title.summary.actors && title.summary.aware === 0,
    noSpawnRunning: title.roster.every((enemy) => enemy.animation === "idle" && enemy.state === "guard"),
    roleVariety: Object.keys(title.summary.roles).length >= 6 && (title.summary.roles.gate_sentry || 0) > 0 && (title.summary.roles.tower_lookout || 0) > 0,
    watchpostLookouts: watchposts.length > 0 && watchposts.every((id) => lookoutStrongholds.has(id)),
    generatedNavGrids: title.summary.navGrids >= 12 && title.summary.navWalkableCells >= 2500,
    calmBehaviorOnly: Object.keys(settled.summary.states).every((state) => state === "guard" || state === "patrol") && settled.summary.aware === 0,
    patrolsWalk: patrols.length > 0 && patrols.every((enemy) => enemy.animation === "walk" || enemy.animation === "idle"),
    patrolRoutes: patrolRoles.length >= 10 && patrolRoles.every((enemy) => enemy.patrolPoints >= 2),
    sightAndAlertSharing: settled.behavior.available && settled.behavior.sight.visible && settled.behavior.sight.state === "alert" && settled.behavior.sight.shared && settled.behavior.sight.alertsShared >= 1,
    hearingInvestigation: settled.behavior.available && settled.behavior.hearing.state === "suspicious" && settled.behavior.hearing.reason === "heard-test-footstep" && settled.behavior.hearing.lastKnownUpdated,
    localSeparation: settled.behavior.available && settled.behavior.separation.steersApart,
    colliderOcclusion: settled.occlusion.available && settled.occlusion.colliderBlocks && settled.occlusion.worldOccluded && !settled.occlusion.parallelControlBlocked,
    lastKnownSearch: settled.search.available && settled.search.state === "search" && settled.search.reason === "lost-line-of-sight" && settled.search.lastKnownPreserved && settled.search.searchSeconds >= 4,
    stuckRecovery: settled.stuck.available && settled.stuck.blockedBefore && settled.stuck.automatic && settled.stuck.recovered && settled.stuck.repaths >= 1 && !settled.stuck.blockedAfter && settled.stuck.displacement > .4,
    obstaclePath: settled.path.available && settled.path.gridCells > 50 && settled.path.waypoints >= 2 && settled.path.distance > 15 && settled.path.allWalkable,
    probesAreIsolated: JSON.stringify(stableRoster(settled.roster)) === JSON.stringify(stableRoster(settled.rosterAfterProbes))
      && JSON.stringify(settled.summary) === JSON.stringify(settled.summaryAfterProbes),
    cleanDiagnostics: !diagnostics.consoleErrors.length && !diagnostics.pageErrors.length && !diagnostics.failedRequests.length
  };

  const report = {
    url: `${BASE}?test`,
    checks,
    title: title.summary,
    settled: settled.summary,
    probes: { behavior: settled.behavior, occlusion: settled.occlusion, search: settled.search, stuck: settled.stuck, path: settled.path },
    diagnostics
  };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
