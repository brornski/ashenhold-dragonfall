# Ashenhold agent brief

This file applies to the entire repository. Read `GAME-DEVELOPER-GUIDE.md` and `ATTRIBUTIONS.md` before changing gameplay, rendering, assets, saves, tests, or deployment.

## Product contract

- Product: Ashenhold: Dragonfall, a third-person browser action roguelite.
- Stable play URL: https://brornski.github.io/ashenhold-dragonfall/
- Source: https://github.com/brornski/ashenhold-dragonfall
- Runtime: dependency-free static HTML/CSS/JavaScript with Three.js r128 and loaders vendored under `assets/vendor/`.
- Main source: `app.js`. There is no runtime package manifest or build step; the dev-only harness is under `test-results/`.
- World: 1,800 units, six biome geometry families, local PBR materials, two walkable ascent structures, three forts, a keep, and 8-11 seeded settlement POIs per realm.
- POIs: hamlets, watchposts, shrines/graveyards, raider camps, and ruin clusters assembled from vendored CC0 models. Location guards and stronghold garrisons leash to their home areas.
- Combat: blade, bow, axe, staff; animation-timed release, dodge/i-frames, target lock, telegraphs, hit-stop, shake, knockback, dragons, and tameable creatures.
- Conquest: no wave mode remains. Every generated location is a stronghold with a level-scaled garrison. Forts/keep can gain golems at higher levels. Clearing grants a kind-specific bonus.
- Completion: `questStage === 3` and every stronghold cleared. Runes and chests never advance conquest state.
- Relic chests: every chest grants XP, healing, shout charge, and a deterministic permanent 1-3% bonus to damage, health, regeneration, sprint, stamina, or critical damage.
- Taming: slowed/crit-weakened wargs and biome light creatures can be bonded with `E`; maximum two companions. Bonded creatures follow, fight, add traversal speed, persist in an active run, and count as handled garrison members.
- Progression: nine permanent branches plus three per-run branches, 66 nodes total. `THE STRIDE` is the sprint branch and must retain a 100%+ maximum super-sprint improvement.
- Sprint: latched hysteresis and an exhaustion lock prevent stamina-threshold flicker. The additive sprint pose, FOV, streaks, and trail effects consume the stable sprint flags.
- Persistence: permanent key `ashenhold-progression-v3` (payload 6), active-run key `ashenhold-active-run-v1` (payload 1), realm session key `ashenhold-realm-v1`, `WORLD_LAYOUT_VERSION = 6`.
- Realm rotation: jungle -> shore -> desert -> snowy -> mountains -> moon -> loop, with a fresh seed after victory or death.

## Non-negotiable implementation rules

1. Preserve deterministic query overrides: `?test&biome=jungle&seed=424242`.
2. Keep mutating helpers behind `?test`; normal production exposes only read-only `window.ashenholdGame.snapshot()` and `window.ashenholdGame.modelCatalog()`.
3. Keep test saves isolated unless the URL also contains `test-save`.
4. Bump `WORLD_LAYOUT_VERSION` when generated geometry, POI placement, or collider topology changes incompatibly. Reject stale active runs; never wipe permanent progress.
5. Migrate old boolean skill maps, legacy single-weapon mastery, and progression payloads without silently dropping user data. Refuse unknown future payload versions.
6. Imported animated actors must be cloned through `SkeletonUtils`, advanced by a mixer, and uncached/disposed when removed.
7. Colliders must be height-bounded and orientation-aware. Preserve movement substeps, wall sliding, step clearance, depenetration, and last-safe recovery.
8. Keep all runtime models, textures, scripts, fonts, and PBR maps same-origin. External runtime requests are a release blocker.
9. Preserve adaptive pixel ratio, far-garrison visibility culling, reduced-motion behavior, keyboard focus, touch controls, and 844x390 landscape support.
10. Attribute every third-party asset in `ATTRIBUTIONS.md` and retain its local license notice.
11. GitHub Pages must deploy a runtime-only artifact. Do not publish tests, handoff documents, tools, workstation paths, credentials, or reference art.
12. A displayed skill node must have a gameplay effect and save contract. A location that appears in the stronghold total must be clearable without a soft lock.
13. Do not claim a release from visual inspection alone. Run every gate below.

## Required edit and release loop

From the repository root:

1. Inspect `git status` and preserve unrelated user changes.
2. Edit source text with `apply_patch`.
3. Run:

   ```powershell
   node --check app.js
   node --check test-results/e2e-smoke.cjs
   node --check test-results/production-audit.cjs
   node --check test-results/live-deployment-audit.cjs
   ```

4. Serve the repository over HTTP. Port 4173 is conventional; set `ASHENHOLD_BASE` if another port is used.
5. Run the deterministic smoke, production audit, accessibility audit, and payload audit.
6. Inspect every top-level check and generated screenshot. Any false gate, serious/critical accessibility violation, external request, or startup transfer above 18 MB blocks release.
7. Merge to `main` only after the local gates pass. `.github/workflows/pages.yml` publishes the runtime-only artifact.
8. Configure the Pages source as GitHub Actions if it is not already configured, wait for the deployment workflow, then run the live HTTP audit and browser smoke against the stable Pages URL.

The reproducible harness is:

```powershell
Set-Location test-results
npm install
npx playwright install chromium
npm run smoke
npm run audit
npm run a11y
npm run payload
```

On the original workstation, the existing dependency cache can also be used:

```powershell
$env:NODE_PATH='C:\Users\baile\.cache\ashenhold-e2e\node_modules'
node test-results\e2e-smoke.cjs
```

## Change-sensitive checks

- Strongholds: check a low-level realm, a high-level respawn, per-kind rewards, non-lethal tame handling, full clear, and boss-plus-clear victory.
- Collision: verify routes, stairs, door gaps, high-speed substeps, axis sliding, embedded-player recovery, water rejection, and zero spawn failures across multiple seeds.
- Sprint: verify enter/exit thresholds, zero-stamina lockout, animation/FOV stability, capstone speed, launch shockwave, and trail damage.
- Saves: verify progression migration, permanent relic restoration, stronghold cleared IDs, handled garrison members, companions, and next-realm cleanup.
- Assets: verify active biome actors animate, dense model instances render, catalog paths exist, and all requests remain same-origin.
- Deployment: verify layout marker 6, manifest scope under the repository path, core GLTF/PBR assets, runtime-only exclusions, and a clean live browser boot.

The full architecture, balance tables, save envelopes, debug hooks, audit coverage, and honest limitations are in `GAME-DEVELOPER-GUIDE.md`.
