# Ashenhold agent brief

This file applies to the entire repository. Read `GAME-DEVELOPER-GUIDE.md` and `ATTRIBUTIONS.md` before changing gameplay, rendering, assets, saves, tests, or deployment.

## Product contract

- Product: Ashenhold: Dragonfall, a third-person browser action roguelite.
- Stable play URL: https://brornski.github.io/ashenhold-dragonfall/
- Source: https://github.com/brornski/ashenhold-dragonfall
- Runtime: dependency-free static HTML/CSS/JavaScript client with Three.js r128 and loaders vendored under `assets/vendor/`; optional co-op uses the separate Node service under `multiplayer-server/`.
- Main gameplay source: `app.js`. Multiplayer boundaries are `multiplayer-client.js`, `multiplayer-avatars.js`, `multiplayer-game.js`, and `multiplayer-ui.js`. There is no client build step; dev packages live only under `test-results/` and `multiplayer-server/`.
- World: 1,800 metres, one unit per metre, layout version 7, six generated sky/ecology families, 24-32 infrastructure sites, thousands of instanced trees, two walkable ascent structures, three forts, a keep, and 8-11 seeded settlement POIs per realm.
- POIs: hamlets, watchposts, shrines/graveyards, raider camps, and ruin clusters assembled from vendored CC0 models. Location guards and stronghold garrisons leash to their home areas.
- Combat: blade, bow, axe, staff; animation-timed release, dodge/i-frames, target lock, telegraphs, hit-stop, shake, knockback, dragons, and tameable creatures.
- Conquest: no wave mode remains. Every generated location is a stronghold with a level-scaled garrison. Forts/keep can gain golems at higher levels. Clearing grants a kind-specific bonus.
- Completion: `questStage === 3` and every stronghold cleared. Runes and chests never advance conquest state.
- Relic chests: every chest grants XP, healing, shout charge, and a deterministic permanent 1-3% bonus to damage, health, regeneration, sprint, stamina, or critical damage.
- Taming: slowed/crit-weakened wargs and biome light creatures can be bonded with `E`; maximum two companions. Bonded creatures follow, fight, add traversal speed, persist in an active run, and count as handled garrison members.
- Progression: nine permanent branches plus three per-run branches, 66 nodes total. `THE STRIDE` is the sprint branch and must retain a 100%+ maximum super-sprint improvement.
- Sprint: latched hysteresis and an exhaustion lock prevent stamina-threshold flicker. The additive sprint pose, FOV, streaks, and trail effects consume the stable sprint flags.
- Motion: `Control` is a slope-gated downhill slide with carried jump momentum; on flat/uphill terrain it remains super sprint. Ground, rise/fall, slide, and landing presentation must not overlap incorrectly. Skills remain directly available through `K` and the desktop/touch buttons.
- Garrison AI: seeded gate, courtyard, lookout, patrol, reserve, heavy, and beast roles use sight/hearing suspicion, shared alerts, obstacle-aware local paths, separation, post leashes, and stuck recovery.
- Co-op: Solo is the default. Host/Join supports two to four Wardens in a shared biome/seed. The server owns room state, ground-enemy AI, damage, chest claims, taming, stronghold clears, and host succession; the host registers the deterministic world and drives bounded dragon transforms.
- Persistence: permanent key `ashenhold-progression-v3` (payload 6), active-run key `ashenhold-active-run-v1` (payload 1), realm session key `ashenhold-realm-v1`, `WORLD_LAYOUT_VERSION = 7`.
- Realm rotation: jungle -> shore -> desert -> snowy -> mountains -> moon -> loop, with a fresh seed after victory or death.

## Non-negotiable implementation rules

1. Preserve deterministic query overrides: `?test&biome=jungle&seed=424242`.
2. Keep mutating gameplay helpers behind `?test`; the normal `window.ashenholdGame` surface exposes only read-only `snapshot()` and `modelCatalog()`. Multiplayer module globals are protocol/presentation boundaries, not test backdoors.
3. Keep test saves isolated unless the URL also contains `test-save`.
4. Bump `WORLD_LAYOUT_VERSION` when generated geometry, POI placement, or collider topology changes incompatibly. Reject stale active runs; never wipe permanent progress.
5. Migrate old boolean skill maps, legacy single-weapon mastery, and progression payloads without silently dropping user data. Refuse unknown future payload versions.
6. Imported animated actors must be cloned through `SkeletonUtils`, advanced by a mixer, and uncached/disposed when removed.
7. Colliders must be height-bounded and orientation-aware. Preserve movement substeps, wall sliding, step clearance, depenetration, and last-safe recovery.
8. Keep all models, textures, scripts, fonts, PBR maps, and non-party requests same-origin. The only approved cross-origin runtime request is the opt-in secure party socket declared by `<meta name="ashenhold-multiplayer-url">`: `wss://multiplayer-server-weld.vercel.app/api/ws`. Any other external request is a release blocker.
9. Preserve adaptive pixel ratio, far-garrison visibility culling, reduced-motion behavior, keyboard focus, touch controls, and 844x390 landscape support.
10. Attribute every third-party asset in `ATTRIBUTIONS.md` and retain its local license notice.
11. GitHub Pages must deploy a runtime-only artifact. Do not publish tests, handoff documents, tools, workstation paths, credentials, or reference art.
12. A displayed skill node must have a gameplay effect and save contract. A location that appears in the stronghold total must be clearable without a soft lock.
13. Do not claim a release from visual inspection alone. Run every gate below.
14. Keep the four multiplayer browser scripts in dependency order before `app.js`: client, avatars, game coordinator, UI. GitHub Pages must publish all four, but must never publish `multiplayer-server/`.
15. Room codes are discoverable invitations, not authentication. Never put credentials or privileged secrets in browser code, socket URLs, room payloads, logs, screenshots, or docs. Production transport must be `wss://`; plain `ws://` is local-development only.
16. Preserve honest co-op limits: memory-only rooms, 30-minute idle expiry, 60-second reconnect grace, local/browser progression, no accounts, matchmaking, cloud save, chat, durable recovery, or anti-cheat guarantee.

## Required edit and release loop

From the repository root:

1. Inspect `git status` and preserve unrelated user changes.
2. Edit source text with `apply_patch`.
3. Run:

   ```powershell
   node --check app.js
   node --check multiplayer-client.js
   node --check multiplayer-avatars.js
   node --check multiplayer-game.js
   node --check multiplayer-ui.js
   node --check test-results/e2e-smoke.cjs
   node --check test-results/ai-garrison-audit.cjs
   node --check test-results/motion-regression.cjs
   node --check test-results/production-audit.cjs
   node --check test-results/live-deployment-audit.cjs
   ```

4. Serve the repository over HTTP. Port 4173 is conventional; set `ASHENHOLD_BASE` if another port is used.
5. Run the deterministic smoke, AI audit, motion regression, production audit, accessibility audit, payload audit, and multiplayer-server test suite.
6. Inspect every top-level check and generated screenshot. Any false gate, serious/critical accessibility violation, external request, or startup transfer above 18 MB blocks release.
7. Merge to `main` only after the local gates pass. `.github/workflows/pages.yml` publishes the runtime-only artifact.
8. Configure the Pages source as GitHub Actions if it is not already configured, wait for the deployment workflow, then run the live HTTP audit and browser smoke against the stable Pages URL.

The reproducible harness is:

```powershell
Set-Location test-results
npm install
npx playwright install chromium
npm run smoke
npm run ai
npm run multiplayer
npm run audit
npm run a11y
npm run payload
npm run motion
```

The room service has its own reproducible gate:

```powershell
Set-Location multiplayer-server
npm ci
npm test
npm run test:remote -- wss://multiplayer-server-weld.vercel.app/api/ws
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
- Motion: verify slope-gated slide entry, acceleration, collision stop, carried slide-jump momentum, airborne/landing phases, flat/uphill super sprint, and desktop/touch skill access.
- Garrison AI: verify role distribution, seeded posts/patrols, partial/full perception, noise, ally alerts, obstacle paths, separation, return/leash behavior, culling continuity, and stuck recovery.
- Co-op: verify two clients align realm/seed, only the host registers/starts the world, remote Wardens interpolate, authoritative enemy/chest/tame/stronghold events converge, reconnect and host succession work, and Solo creates no socket.
- Saves: verify progression migration, permanent relic restoration, stronghold cleared IDs, handled garrison members, companions, and next-realm cleanup.
- Assets: verify active biome actors animate, dense model instances render, catalog paths exist, and every request is same-origin except the approved opt-in secure party WebSocket.
- Deployment: verify layout marker 7, manifest scope under the repository path, core GLTF/PBR assets, all four multiplayer modules, runtime-only exclusions, the exact public socket meta value, and a clean live browser boot.

The full architecture, balance tables, save envelopes, debug hooks, audit coverage, and honest limitations are in `GAME-DEVELOPER-GUIDE.md`.
