# Ashenhold: Dragonfall - release 5.4 developer handoff

Updated July 19, 2026. This is the source-of-truth engineering handoff for the static browser release at https://brornski.github.io/ashenhold-dragonfall/.

## Start locally

The game has no runtime dependency installation and no build step.

```powershell
Set-Location C:\Users\baile\ashenhold-github
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`. The deterministic QA realm is:

```text
http://127.0.0.1:4173/?test&biome=jungle&seed=424242
```

Never use `file://`; GLTF, texture, and font loading require an HTTP origin.

## Architecture

| Path | Responsibility |
| --- | --- |
| `index.html` | Semantic shell, premium title deck, HUD, overlays, touch controls, local vendor script order |
| `styles.css` | Responsive UI, animation, accessibility states, biome grading, 844x390 compact layout |
| `app.js` | Renderer, deterministic world generation, collisions, AI, combat, progression, persistence, audio, public/test APIs |
| `assets/vendor/` | Local Three.js r128, GLTFLoader, SkeletonUtils, and notices |
| `assets/models/` | Local Kenney, KayKit, and Quaternius model packs |
| `assets/textures/` | Local terrain, sky, and six biome PBR sets |
| `ATTRIBUTIONS.md` | Asset sources, licenses, and local notice locations |
| `test-results/` | Playwright smoke, production, WCAG, payload, and deployed-site audits |
| `.github/workflows/pages.yml` | Runtime-only GitHub Pages artifact and deployment |
| `vercel.json` | Optional legacy/custom-host security and cache headers |

The runtime is one closure in `app.js`. There is no backend, login, analytics, payment, cloud save, multiplayer, or anti-cheat layer. All runtime requests must remain on the page origin.

Runtime states are `loading`, `title`, `playing`, `paused`, `skills`, `resolving`, and `ended`. `#game[data-state]` mirrors the state for CSS and accessibility behavior.

## Boot order

1. Parse query flags and validate progression, active-run, and realm envelopes.
2. Select the current biome and deterministic seed.
3. Build the 12-branch/66-node skill graph.
4. Initialize WebGL, adaptive quality, camera, fog, light, and the audio facade.
5. Load the active biome's local textures and model catalog.
6. Generate terrain, road, forts, wilderness, imported world props, ascent structures, runes, settlements, chests, signature biome props, and atmosphere.
7. Create the Warden, register strongholds, spawn garrisons/dragons, and build landmarks.
8. Enter the responsive title state and offer Continue only when an active run matches layout version 6.

The title deck reads live realm data: biome, seed, Warden level, and stronghold count. It has independent Continue/New Realm actions and collapses into a compact landscape presentation without covering the canvas.

## Realm generation

Core constants:

- `WORLD_SIZE = 1800`
- `WORLD_LAYOUT_VERSION = 6`
- query overrides: `biome=<id>` and `seed=<nonzero number>`
- realm ladder: jungle -> shore -> desert -> snowy -> mountains -> moon -> loop

Each biome has a different terrain function, sky palette, exposure, water level, stone tint, PBR texture set, signature instanced props, fort coordinates, dragon names, and animated light/heavy enemy model pair. A layout change that invalidates positions or colliders must bump `WORLD_LAYOUT_VERSION`; stale active runs are rejected without touching permanent progression.

Each realm contains:

- three seeded forts and Ashenhold Keep
- two traversable ascent structures (spire and scaffold)
- 8-11 settlement POIs: hamlets, watchposts, shrines/graveyards, raider camps, and ruin clusters
- one relic chest at each fort, ascent summit, and settlement POI
- deterministic runes, dragons, roads, landmarks, and signature biome props

POI placement rejects water, excessive slope, existing forts/routes, and overlapping reservations. Detailed model decoration is presentation-only; encounter and chest positions are deterministic.

`importedModelInstances` records world density. Desktop strongholds receive more decorative props than coarse/mobile renderers. Distant live garrisons are visibility-culled beyond 275 units on desktop and 175 units on coarse devices; AI/state remain deterministic.

## Stronghold conquest

The old wave director is gone. `strongholds[]` is the only conquest authority. Every fort, generated POI, ascent summit, and the keep registers a stable ID, location, kind, seeded spawn spots, member references, marker, and cleared state.

Base garrison composition:

| Kind | Light | Heavy | Warg | Golem |
| --- | ---: | ---: | ---: | ---: |
| Fort | 3 | 2 | 0 | 0 |
| Hamlet | 3 | 0 | 1 | 0 |
| Watchpost | 3 | 0 | 1 | 0 |
| Shrine | 2 | 1 | 0 | 0 |
| Graveyard | 4 | 1 | 0 | 0 |
| Raider camp | 3 | 0 | 1 | 0 |
| Ruin cluster | 2 | 1 | 0 | 0 |
| Ascent summit | 2 | 0 | 1 | 0 |
| Keep | 4 | 0 | 0 | 1 |

Level scaling is computed when actors reset:

- extra light count: `min(4, floor((wardenLevel - 1) / 6))`
- each light spawn promotes to heavy when its seeded roll is below `min(0.45, wardenLevel * 0.02)`
- a fort gains a colossus at level 10+
- the keep gains its extra colossus at level 14+
- enemy stats use the continuous `ambientDifficulty()` threat calculation

Garrison enemies carry `strongholdId`, a deterministic `spawnKey`, and a home leash. A member is handled by death or taming. The stronghold clears exactly once when its remaining live, hostile member count reaches zero.

Clear rewards:

| Kind | Warden XP | Heal | Shout | Extra |
| --- | ---: | ---: | ---: | --- |
| Fort | 150 | 30% | 25 | +50 active weapon XP |
| Hamlet | 100 | 20% | 25 | - |
| Watchpost | 110 | 20% | 25 | +35 active weapon XP |
| Shrine | 120 | 20% | 25 | +40 run XP |
| Graveyard | 130 | 20% | 25 | +40 run XP |
| Raider camp | 90 | 20% | 25 | - |
| Ruin cluster | 110 | 20% | 25 | - |
| Ascent summit | 80 | 20% | 25 | full stamina |
| Keep | 200 | 30% | full | - |

If `PHOENIX OATH` is owned and Second Wind has been consumed, the next actual stronghold clear restores it.

The conquest HUD shows cleared/total, percentage fill, and the nearest uncleared location. Cleared location markers dim on the minimap. At quest stage 3, `currentObjective()` points to the nearest uncleared stronghold. Full victory requires `questStage === 3 && strongholds.every(cleared)`; neither boss-first nor strongholds-first ordering can bypass the other requirement.

## Relic chests and permanent power

Every fort, ascent, and POI chest has a deterministic `powerUp` selected from:

- `damage`
- `health`
- `regen`
- `sprint`
- `stamina`
- `critDamage`

The amount is an integer from 1% through 3%. Opening with `E` also grants the chest's Warden XP, run XP at 72%, +25 health, and +20 shout. The permanent bonus is applied before healing so a maximum-health/stamina increase is immediately usable.

Effects are multiplicative against their relevant final base:

- damage multiplies weapon output
- health/stamina multiply their computed maxima
- regeneration multiplies health and stamina recovery
- sprint adds to sprint/super-sprint power
- critical damage multiplies the critical bonus

Each stat is clamped to a generous 500% when loading or stacking. A colored crystal/shockwave, combat text, banner, and immediate progression write confirm the reward. Opened chest IDs remain active-run data, while the resulting `relicBonuses` are permanent progression.

## Traversal and collision overhaul

`movePlayer(dx, dz)` is the single horizontal movement path. It now:

- divides movement into steps no longer than 0.28 units, preventing tunneling at capstone sprint speed
- uses a 0.72-unit capsule radius with a 0.055 collision skin
- attempts the full vector, then independent axes for reliable wall sliding
- accepts upward surface changes up to 0.92 units
- updates the grounded surface during each substep
- rejects deep water and excessive unsupported terrain slopes
- reports actual distance traveled rather than requested movement

All new colliders must be oriented boxes with finite vertical bands. `hitsCollider()` transforms the capsule into collider-local space and checks both the horizontal rounded rectangle and actor height. Walkable decks use thin collider bands below their top surface, so platforms do not block space underneath or above.

`recoverPlayerFromCollision()` searches five radial rings (16 directions each) when the player becomes embedded. If no nearby legal point exists, it returns the Warden to `lastSafePosition`. The test-only `collisionRecoveryProbe()` verifies a real generated collider transitions from blocked to unblocked.

Castle door gaps have a minimum 2.4-unit opening. High-speed routes, stairs, entrances, restored positions, and generated spawn spots must remain part of the multi-seed release audit.

## Sprint hysteresis and THE STRIDE

Sprint input is latched rather than recomputed at one stamina threshold every frame:

- sprint enters above 8 stamina and exits at 2 or on input release
- super sprint enters above 12 and exits at 5 or on input release
- reaching zero forces both latches off and sets exhaustion
- exhaustion clears only after stamina reaches 10

The sprint animation overlay, FOV, time scale, streaks, and storm effects consume the stable `player.sprinting` / `player.superSprinting` flags. This prevents drain/regen threshold thrashing and the old animation flicker.

`THE STRIDE` is the ninth permanent branch:

| Node | Ranks | Effect |
| --- | ---: | --- |
| Gale Pace | 3 | +15% sprint and +10% super-sprint speed per rank |
| Tempest Pace | 3 | +25% super-sprint speed per rank; requires Gale Pace 3 and level 6 |
| Marathon | 2 | -25% sprint/super drain per rank |
| Second Lungs | 2 | +30% stamina regeneration while sprinting per rank |
| Stormlaunch | 1 | super-sprint engage emits 12 damage and knockback in a 6-unit radius |
| Stormstride | 1 | +25% super speed and a lightning AoE trail every 0.25 seconds |

At capstone, super sprint reaches about +130% before relic and bonded-creature bonuses. Movement substeps are therefore a functional requirement, not merely a polish feature.

## Creature taming and companions

Wargs and biome light creatures are tameable; heavies, golems, and dragons are not.

- every staff hit applies slow and adds 30 tame progress
- a critical hit adds 55 tame progress
- reaching 100 progress marks the creature ready
- a creature below 50% health can also become ready through a critical hit or a staff hit while slowed
- press `E` near a ready or slowed/low-health eligible creature to bond it

Maximum companions: two. Bonded actors are renamed, recolored with a cyan ground ring, removed from hostile targeting/minimap passes, and immediately count as handled if they belonged to a stronghold. They follow formation slots, warp back if stranded far away, choose nearby hostiles, and attack through the normal damage system.

Bonded Pace is +30% per warg and +16% per other eligible companion, capped at +45%. Companion kind/name/health and handled stronghold member keys persist in the active run. Companions are runtime allies rather than permanent account unlocks.

## Combat and progression

Weapons remain animation-timed:

| Weapon | Role | Base behavior |
| --- | --- | --- |
| Ashen Blade | close tempo | 34 melee, fast cooldown |
| Frostfang Bow | range | 28 projectile with gravity |
| Wyrmcleaver Axe | heavy hybrid | 42 melee, splash, strong knockback |
| Stormcaller Staff | control/taming | splash bolts, slow, chain/storm skills |

Attacks release at 55% of the animation window. Dodge lasts 0.58 seconds, costs 22 stamina, and has a 0.10-0.36 second immunity window. Ground enemies telegraph before their damage frame and re-check distance/facing at impact. Dragons use velocity-lead fireballs; Vharok has 520 base health, a three-shot volley, and an enrage below 35%.

The graph has 66 nodes in 12 branches:

Permanent: Warden, Warmaster, Voice, Wayfarer, Duelist, Ranger, Reaver, Arcanist, Stride.

Per run: Fury, Resolve, Hunt.

Warden level caps at 50, each weapon mastery at 10, and run level at 25. Integer ranks, costs, rank prerequisites, all/any prerequisites, exclusions, Warden levels, and mastery gates are data-driven. Permanent and run points are separate.

## Save contracts

### Permanent progression

Local-storage key: `ashenhold-progression-v3`. Payload version: 6.

```json
{
  "version": 6,
  "level": 1,
  "xp": 0,
  "skillPoints": 0,
  "prestige": 0,
  "realmDepth": 0,
  "activeWeapon": "blade",
  "mastery": {
    "blade": { "level": 1, "xp": 0 },
    "bow": { "level": 1, "xp": 0 },
    "axe": { "level": 1, "xp": 0 },
    "staff": { "level": 1, "xp": 0 }
  },
  "skills": {},
  "relicBonuses": {
    "damage": 0,
    "health": 0,
    "regen": 0,
    "sprint": 0,
    "stamina": 0,
    "critDamage": 0
  }
}
```

Compatibility fields `weaponLevel` and `weaponXp` are still written. Loading migrates legacy single-weapon mastery, boolean skill values, and payloads without relic bonuses. Versions above 6 are warned about and left untouched.

### Active run

Local-storage key: `ashenhold-active-run-v1`. Payload version: 1; layout version: 6.

It stores realm/seed, player transform and combat resources, run skills, quest/boss state, discovery cells, landmarks, runes, chest IDs, dead dragons, cleared stronghold IDs, handled tamed-member spawn keys, up to two companions, and deterministic encounter RNG. Old envelopes with a `director.rngState` can contribute only an RNG fallback; wave/director state is no longer written or consumed.

Restore clamps numeric values and array lengths, validates the position against water/colliders, reconstructs cleared markers and claimed pickups, skips handled garrison spawn keys, restores companions, and respawns only the appropriate stronghold members. Dragon souls are transient and intentionally not serialized.

`?test` disables persistence unless `test-save` is also present. Saves debounce at 1.2 seconds; material events such as chest rewards, stronghold clears, and taming checkpoint immediately.

## Asset model system

`loadModelAssets()` defines named model slots and loads them with `THREE.GLTFLoader`. The active biome supplies `biomeLight` and `biomeHeavy`; world slots cover fort pieces, buildings, props, tents, ruins, statues, trees, graveyard pieces, the Warden, and warg.

Normal production exposes:

```js
window.ashenholdGame.modelCatalog()
```

It returns `{ slotName: "assets/..." }` for every active slot, making the registry inspectable from developer tools. `snapshot().world.modelSlots` returns slot names and `importedModelInstances` reports density. Replacing a file in place requires a reload; changing a slot path belongs in `loadModelAssets()` and must retain the same-origin/license/test contracts.

Animated models must be cloned safely through `SkeletonUtils`. Mixers are advanced only while relevant/visible and must be stopped/uncached during disposal. Procedural fallbacks remain required when a GLTF cannot load.

## Public and test APIs

Normal pages expose only read-only methods:

- `window.ashenholdGame.snapshot()`
- `window.ashenholdGame.modelCatalog()`

The snapshot includes realm, player/progression, relic bonuses, companions/Bonded Pace, stronghold summary/list, quest, route reports, POIs, asset density, model slots, spawn failures, collision-relevant position, sprint latches, renderer counts, and quality.

Only `?test` exposes mutating `window.__ASHENHOLD_TEST__` helpers. Important 5.4 additions are:

- `strongholdDebug()` and `clearStronghold(id)`
- `prepareNearestTame()` and expanded `enemyDebug()`
- `setStamina()`, `setSkillForTest()`, and `respawnActors()`
- `moveBy()`, `collisionState()`, and `collisionRecoveryProbe()`
- `chestPositions()` with deterministic `powerUp`
- `modelCatalog()` and `skillSchema()`
- active-run write/read and progression migration helpers

Never expose those mutations on a normal production URL.

## Release gates

Install once in `test-results/` or use the workstation cache described in `AGENTS.md`.

```powershell
$env:ASHENHOLD_BASE='http://127.0.0.1:4173/'
node test-results\e2e-smoke.cjs
node test-results\production-audit.cjs
node test-results\accessibility-audit.cjs
node test-results\payload-audit.cjs
```

The deterministic smoke covers title boot, local models/PBR, combat roles, runes/souls, permanent chest power, stronghold rewards/victory, taming, base/capstone sprint, hysteresis, collision recovery, routes/POIs, camera, minimap, mobile-safe state, and clean browser diagnostics.

The production audit covers the biome/seed matrix, geometry and roster divergence, model density, 8+ POIs, 12+ strongholds with garrisons, progression migration/restore, combat timing, high-level garrison scaling, taming, sprint capstone, unified victory, 844x390 controls, and console/HTTP cleanliness.

Accessibility scans desktop title/gameplay/skills and mobile gameplay. Serious/critical violations block. Payload audit requires boot below 60 seconds, cold active-biome transfer below 18 MB, same-origin-only requests, and clean diagnostics. The July 19 local 5.4 result was 845 ms, 16.47 MB, 133 resources, and no diagnostics.

## GitHub Pages deployment

The primary release workflow follows GitHub's Pages artifact model:

1. merge tested work to `main`
2. GitHub Actions checks out `main`
3. the workflow assembles `_site` from `index.html`, `styles.css`, `app.js`, `manifest.json`, and `assets/`
4. `actions/upload-pages-artifact` uploads only that runtime tree
5. `actions/deploy-pages` publishes it to the `github-pages` environment

The manifest uses relative `start_url` and `scope` so installation works beneath `/ashenhold-dragonfall/`.

After deployment:

```powershell
$env:ASHENHOLD_BASE='https://brornski.github.io/ashenhold-dragonfall/'
node test-results\live-deployment-audit.cjs
node test-results\e2e-smoke.cjs
```

Verify root/title, layout marker 6, active GLTF, biome normal map, manifest, excluded docs/tests/tools, same-origin browser requests, and a full stronghold victory. GitHub Pages does not expose Vercel's configurable response headers; the live audit applies provider-appropriate checks.

## Safe extension patterns

Adding a POI kind requires placement/reservation logic, a model/fallback builder, finite colliders, chest spot, landmark, stronghold kind/composition/ring/reward, minimap behavior, save-stable ID, and two-seed audit coverage.

Adding a skill requires a unique ID, rank/cost/prerequisite data, implemented effect, migration-safe serialization, accurate copy, and a deterministic test. A cosmetic-only node is a bug.

Adding an enemy requires readable telegraphs, threat scaling, seeded spawn safety, model fallback, animation mapping, cleanup, minimap identity, XP/mastery rewards, leash behavior when location-bound, and explicit tame eligibility.

Changing terrain or structures requires checking safe start/keep/fort foundations, all route reports, entrance clearance, under-platform traversal, high-speed collision, run restore, zero spawn failures, and multiple seeds for all biomes.

## Honest limitations

Ashenhold 5.4 is a polished static browser game, not a large-studio native production.

- Three.js r128 is old and an upgrade needs a separate import/render regression pass.
- Ground enemies use local obstacle whiskers and home leashes, not a full navmesh.
- Dragons are procedural rather than skeletal.
- Companions use lightweight follow/attack behavior and are not a commandable party system.
- Saves are browser/device local and player-editable.
- No cloud backend, multiplayer, leaderboard, localization pipeline, or remapping UI exists.
- Automated software-rendered WebGL cannot replace real GPU, thermal, controller, screen-reader, and long-session memory QA.

Highest-value future work: a modern Three.js migration, navmesh/pathfinding, skeletal dragons, mesh LODs, gamepad/remapping/accessibility settings, companion commands, and an opt-in authenticated cloud save only when backend scope is explicitly authorized.
