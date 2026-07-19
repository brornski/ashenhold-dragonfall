# Ashenhold agent brief

This file applies to the entire repository. Read `GAME-DEVELOPER-GUIDE.md` and `ATTRIBUTIONS.md` before changing gameplay, rendering, assets, saves, tests, or deployment.

## Product contract

- Product: Ashenhold: Dragonfall, a third-person browser action roguelite.
- Stable production URL: https://dragon-browser-nine.vercel.app
- Runtime: dependency-free static HTML/CSS/JavaScript, Three.js r128 and loaders vendored under `assets/vendor/`.
- Main source: `app.js`. There is no build step or runtime package manifest; the dev-only test harness under `test-results/` carries its own pinned `package.json`.
- World: 1,800 units; six biome-specific geometry families with per-biome gradient skies, signature prop sets, and stone-tinted architecture; two ascent structures per realm with walkable stairs (no floating slabs); five to seven seeded settlement POIs (hamlets, watchposts, ruin shrines—moon builds graveyards) from vendored CC0 packs; every seed changes terrain features, forts, and encounter RNG.
- Camera: non-inverted 360-degree over-the-shoulder view; `C` swaps sides.
- Combat: blade, bow, axe, staff; animation-timed release, dodge/i-frames, lock-on, telegraphs, hit-stop, shake, and knockback.
- Assault: exactly five waves with targets 4, 6, 8, 10, 12. Initial delay is four seconds and inter-wave delay is eight seconds. Never create wave six.
- Completion: the boss quest and wave five must both be complete. Runes grant XP only and never start or advance waves.
- Relic chests: five per realm (three fort courtyard, two summit troves); open with `E` for Warden XP, +25 health, and +20 shout; claimed ids serialize in `world.chests` like runes.
- Dragons: base HP 150 normal / 520 boss, velocity-lead fireball aiming, boss 3-shot volley; dragon kills spawn transient absorbable soul orbs (never serialized).
- Progression: eight permanent branches plus three per-run branches, 60 total nodes, ranked prerequisites, exclusions, Warden prestige, realm depth, and independent weapon mastery.
- Persistence: permanent key `ashenhold-progression-v3` (payload version 5), active-run key `ashenhold-active-run-v1` (payload version 1), realm session key `ashenhold-realm-v1`; `WORLD_LAYOUT_VERSION = 5`, stale active runs rejected, never wiped.
- POI camp guards are leashed to their camp (radius 24), disengage and walk home beyond it, and never count toward assault-wave targets.
- Settlement packs (KayKit Medieval Hexagon, KayKit Dungeon, Kenney Fantasy Town, Kenney Nature, Kenney Graveyard) are vendored locally under CC0 with license copies; `ATTRIBUTIONS.md` covers them per the attribution rule.
- The super-sprint anime pose is a post-mixer additive bone overlay (self-resetting each frame, gated off during dodge/hit/attack/airborne); future clip additions must not fight it.
- Realm rotation: victory and death both advance a deterministic ladder—jungle → shore → desert → snowy → mountains → moon, looping—with a fresh seed each time; deliberately not level-gated.

## Non-negotiable implementation rules

1. Preserve deterministic query overrides: `?test&biome=jungle&seed=424242`.
2. Keep mutating test helpers behind `?test`. Normal production exposes only `window.ashenholdGame.snapshot()`.
3. Keep test saves isolated unless the URL also contains `test-save`.
4. If world generation changes incompatibly, bump `WORLD_LAYOUT_VERSION` so unsafe active runs are rejected.
5. If save fields change, migrate old boolean skills and legacy single-weapon saves; never silently wipe progress.
6. Imported animated models must be cloned safely, have their mixers advanced, and be uncached/disposed when enemies die or realms end.
7. Every collider must be height-bounded and orientation-aware. Do not reintroduce infinite vertical blocking beneath platforms.
8. Keep PBR color, OpenGL normal, and roughness maps local. Keep external runtime requests at zero.
9. Preserve mobile fallbacks, adaptive pixel ratio, reduced-motion behavior, keyboard focus, and compact 844×390 landscape support.
10. Add every third-party asset to `ATTRIBUTIONS.md` and retain its local license notice.
11. Do not ship local test tools, handoff documents, workstation paths, design-reference art, or Vercel metadata. `.vercelignore` defines these exclusions.
12. Do not claim AAA fidelity or production readiness from visual inspection alone; run the release gates below.

## Required edit and release loop

From `C:\Users\baile\dragon-browser`:

1. Inspect existing changes before editing and preserve unrelated user work.
2. Edit text files with `apply_patch`.
3. Run `node --check app.js` and syntax-check both test runners.
4. Serve the folder on port 4173 over HTTP.
5. Run the smoke suite:

   `$env:NODE_PATH='C:\Users\baile\.cache\ashenhold-e2e\node_modules'; node test-results\e2e-smoke.cjs`

6. Run the full release audit:

   `$env:NODE_PATH='C:\Users\baile\.cache\ashenhold-e2e\node_modules'; node test-results\production-audit.cjs`

7. Inspect `test-results/smoke-output.json`, `test-results/production-audit.json`, and screenshots. Any false top-level check blocks release.
8. Run `test-results\accessibility-audit.cjs` and `test-results\payload-audit.cjs` with the same `NODE_PATH`; serious accessibility violations, third-party runtime requests, or a startup payload above budget block release.
9. Deploy with `vercel --prod --yes` only after local gates pass.
10. Run `node test-results\live-deployment-audit.cjs` against the immutable deployment and stable alias, then run the browser smoke against the stable URL. Verify boot, security headers, model/material requests, console diagnostics, and 404s for excluded files.

The smoke/audit suites can also run without `NODE_PATH`: `cd test-results && npm install` once, then `npm run smoke`, `npm run audit`, `npm run a11y`, `npm run payload`, or `npm run live`. If port 4173 is occupied, serve the folder on another port and set `ASHENHOLD_BASE=http://127.0.0.1:<port>/` for the suites.

The full architecture, save envelope, balance surfaces, asset matrix, debug hooks, audit coverage, deployment commands, and limitations are in `GAME-DEVELOPER-GUIDE.md`.
