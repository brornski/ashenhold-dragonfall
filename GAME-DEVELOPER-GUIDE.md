# Ashenhold: Dragonfall — release 5.3 developer handoff

Updated July 19, 2026. This document is the source-of-truth handoff for the static browser build at https://dragon-browser-nine.vercel.app.

## Start and test locally

The game has no build step and no package dependency at runtime.

```powershell
Set-Location C:\Users\baile\dragon-browser
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`. Use `http://127.0.0.1:4173/?test&biome=jungle&seed=424242` for a deterministic test realm. Never open `index.html` through `file://` because loaders require an HTTP origin.

## Release architecture

| Path | Responsibility |
| --- | --- |
| `index.html` | Semantic shell, local vendor scripts, HUD, overlays, touch controls |
| `styles.css` | UI art direction, accessibility states, responsive/mobile layout, biome grading |
| `app.js` | Renderer, seeded world, collision, models, AI, combat, progression, saves, audio, test API |
| `assets/vendor/` | Vendored Three.js r128, GLTFLoader, SkeletonUtils, license |
| `assets/models/` | Kenney castle kit, Quaternius Warden/monsters, warg |
| `assets/textures/biomes/` | Six local color/normal/roughness material sets |
| `ATTRIBUTIONS.md` | Asset source, license, and local notice index |
| `vercel.json` | Security and cache headers |
| `.vercelignore` | Production exclusions |
| `test-results/e2e-smoke.cjs` | Fast deterministic release regression |
| `test-results/production-audit.cjs` | Full seeded realm/progression/combat/save/mobile matrix |
| `test-results/package.json` + `README.md` | Pinned dev-only harness (playwright, axe-core) with `npm run` scripts and setup notes |
| `tools/strip-gltf-noop.js` | Conservative one-time removal of redundant glTF texture transforms |

The runtime is a single closure in `app.js`. It intentionally makes no network request outside the deployment origin. There is no backend, account, cloud save, analytics, payment, multiplayer, or anti-cheat system.

The workspace is a local Git repository on branch `main`. Generated screenshots/reports/logs, Vercel metadata, and the user reference image are ignored; source, audit runners, documentation, licenses, and runtime assets are versioned. Future agents should make focused commits and never rewrite user history with a destructive reset.

## Boot and state lifecycle

Boot performs this order:

1. Parse launch flags and safely read active-run/realm envelopes.
2. Select a biome and seed.
3. Build the 11-branch skill UI.
4. Initialize WebGL, fog, lights, camera, adaptive quality, and audio facade.
5. Load local terrain materials, castle pieces, Warden, warg, and the active biome's two monster files.
6. Generate terrain, water, sky, roads, forts, ascent structures, settlements, landmarks, runes, relic chests, signature props, vegetation, player, dragons, and ambient encounters.
7. Enter `title` and offer Continue if an active run matches the current layout version.

Runtime states are `loading`, `title`, `playing`, `paused`, `skills`, `resolving`, and `ended`. `#game[data-state]` mirrors the state for presentation. The update loop separates full gameplay from the reduced title/pause animation pass.

## Procedural realm system

Constants:

- `WORLD_SIZE = 1800`
- `HALF_WORLD = WORLD_SIZE / 2 - 18`
- `WORLD_LAYOUT_VERSION = 5`
- Realm session key: `ashenhold-realm-v1`
- Query overrides: `biome=<id>` and `seed=<nonzero number>`

The six profiles are deliberately different terrain functions, not recolors:

| Biome | Geometry family | Animated light enemy | Animated heavy enemy |
| --- | --- | --- | --- |
| snowy | glacial shelves and ice cuts | Yeti | Birb/Frost Roc |
| jungle | karst mounds and wet basins | Tribal | Orc |
| desert | directional dune fields and mesas | Cactoro | Demon |
| shore | archipelago shelves and tidal channels | Fish | Frog |
| mountains | alpine ridge networks and passes | Monkroose | Orc Skull |
| moon | overlapping craters and ejecta ridges | Alien | Blue Demon |

`generateWorldLayout()` derives seed-varied forts, routes, road phase, rotations, and scales from the active profile. `buildTerrainFeatures()` creates different seeded feature fields. `terrainHeight()` selects the geometry algorithm and then applies safe foundation blending at the start, keep, rune hollow, and every generated fort.

Every victory or death calls `prepareNextRealm()`. It advances a deterministic escalation ladder—jungle → shore → desert → snowy → mountains → moon, then loops—with a fresh seed each death/victory. The title label reads "BIOME N OF 6", end screens name the next biome and ladder position, and the HUD quest panel shows a biome tag (biome name plus realm depth). The ladder is deliberately not level-gated: gating would break the seeded-roguelite contract that any realm is fully playable from a fresh save. A normal Play Again reload rebuilds all geometry and active assets. The active-run save takes priority only when its biome, seed, and layout version match.

### Geometry safety

- Water and excessive slopes are rejected by `canPlayerOccupy()`.
- `hitsCollider(x,z,radius,footY,topY)` transforms the query into oriented collider space and checks vertical overlap.
- `lastSafePosition` recovers the player from invalid water/collision states.
- Fort colliders use the same generated foundation altitude as their meshes.
- Enemy spawns try 30 seeded candidates and then deterministic ring/center fallbacks; failure is counted instead of stalling the director.

### Ascent structures and platforms

Each realm builds two seed-varied ascent structures—the old floating-slab vertical routes are gone. Both route definitions keep their per-biome names:

- Route A "Spire": a masonry watchtower anchored in the terrain. Four switchback stair flights of eight steps each (rise .75—walkable, no jumping), corner landings on full-height masonry pillars, a summit deck at roughly +24 with parapet rims (height-banded colliders block walking off the edge; a jump clears them), a crown piece, and an entrance arch with torches. Kenney kit tower/towerTop/doorway dressing.
- Route B "Scaffold ruin": a broken Kenney wall face carrying three wooden scaffold decks (+4.5/+9/+13.5) on visible support posts, plank step-runs between decks, open-edge rails, and broken sky-bridge dressing on the top deck.

Every step, landing, and deck is a registered platform, walkable through `surfaceHeightAt()`. Colliders are height-banded and orientation-aware; a world→local rotation bug in `surfaceHeightAt()`/`hitsCollider()` was fixed (the query is now inverse-transformed into collider space), so elongated rotated pieces behave.

Route validation is measured from the built platforms, not a smoothed design sequence. The per-route contract is:

- minimum terrain clearance: 1.2 units
- maximum adjacent rise: .85 units (no jumps needed)
- maximum center gap: 3.5 units

`world.routeReports` keeps its snapshot shape (now also recording each route's `start` coordinates) and the audit fails if a route is invalid. The height-banded collider still prevents the former infinite-wall problem. Runes and summit troves at route summits reward the climb.

Layout version 4 added per-route foundation zones alongside the new structures; layout version 5 extends the same treatment to settlement sites. Stale active runs are rejected, never wiped.

### Settlements and points of interest

Each realm scatters five to seven seeded settlement POIs decided in the `generateWorldLayout()` pass (their foundation zones are baked into the terrain alongside the forts and routes) and built by `createSettlements()` from four newly vendored CC0 packs—KayKit Medieval Hexagon (complete buildings: tavern, market, homes, blacksmith, church, well, towers), Kenney Fantasy Town (stalls, fountains, banners, cart), Kenney Nature (statues, campfire, trees), and KayKit Dungeon (broken walls). The moon biome swaps the shrine recipe for Kenney Graveyard pieces. All are CC0; provenance and license copies are indexed in `ATTRIBUTIONS.md`. A procedural rock-and-campfire fallback stands in when a pack model fails to load.

Three builder kinds exist:

- Hamlets (2–3): three to five buildings ringed around a central well or market, dressed with town props and a campfire, plus one chest. Two to four camp guards (biome light enemies or wargs) are seeded on a ring and named `"<POI> <TYPE>"`.
- Watchposts (1–2): a medieval tower with walkable interior wood tiers (+.75/+.8 rises) up to a top chest (100–140 XP), with tent, weapon rack, and banner dressing outside.
- Ruin shrines (1–2): nature statues, broken dungeon walls, and an altar around a chest (90–120 XP). In the moon biome the same slot builds a graveyard instead: crypt, gravestone rows, a fence ring with a gate gap, a crooked pine, and a lightpost.

Every imported building gets segmented colliders derived from its measured bounding box, with a deliberate door gap so interiors stay enterable; watchpost decks register as platforms with the same height-banded semantics as ascent structures. Camp guards are leashed to their camp (`radius: 24`): when the player crosses the leash line they clear their telegraph, disengage, and walk home at reduced speed. Guards spawn outside the wave director and never count toward assault-wave targets.

POI chest spots extend the existing chest definitions as `chest-poi-N` entries and serialize in `world.chests` identically to fort and route chests—claimed POI caches survive Continue with no new save fields. POIs also register as discovery landmarks, so they participate in exploration reveal and render as mint house icons on the minimap once discovered.

The snapshot exposes the seeded layout as `world.pois` (kind, name, rounded position). Test-mode `poiDebug()` reports per-POI chest, guard, and collider counts for the current realm, and `objectiveInfo()` returns the live `currentObjective()` result.

### Biome identity

Each biome renders its own canvas-generated gradient sky (zenith/horizon/glow palette per biome: cold-bright snowy, teal-misty jungle, hot amber desert, seafoam shore, slate alpine, violet moon), replacing the single shared storm panorama, which is kept as a fallback. The PMREM environment is baked from the active sky, the halo is tinted per biome, and the moon biome keeps its starfield.

Signature prop sets are seeded scatter with slope/water/road/structure rejection, instanced to at most two draw calls each and halved on mobile: snowy snow-pines plus emissive ice shards; jungle broadleaf trees plus mossy boulders; desert segmented cacti plus sandstone obelisks; shore leaning palms plus driftwood; mountains dark pines plus cairn stacks; moon unlit violet/teal glow-crystal clusters plus rim rocks. The snapshot reports `world.props = { kind, total, byKind }`.

`BIOMES` entries also carry a `stoneTint` multiplied into the imported castle model's cloned materials (sandstone desert, icy snowy, mossy jungle, grey-teal shore, granite mountains, pale moon); shared materials are untouched. Palette and atmosphere separate per biome as well: snowy runs brighter (exposure 1.1), moon dimmer and violet (.88), shore water is brightened, ash particles vary in size/opacity/fall speed (snowflakes, sand motes, spores, mist, embers), and pebbles are tinted per biome.

## Rendering and performance

- WebGL renderer with sRGB output, ACES filmic tone mapping, warm profile sunlight, hemispheric fill, fog, shadows, and PMREM environment lighting.
- Custom terrain shader blends local PBR material response using slope, height, road masks, and frost rules.
- Each biome loads only its active 1K color, OpenGL-normal, and roughness textures.
- Wind-blown grass uses one instanced draw call; prop density and shadows are reduced for coarse/mobile devices.
- Fires, projectiles, shockwaves, markers, and impact effects are emissive or additive where appropriate.
- Average FPS is sampled every five seconds. Adaptive quality changes pixel ratio between 62% and 100% of the device cap.
- HUD refresh is approximately 13 Hz; target scanning and minimap work are throttled instead of running fully every frame.
- A pooled `#combatText` DOM layer (24 recycled spans, zero per-frame allocation) floats damage numbers (hit/heavy/crit), player damage, heals, and XP gains. It projects world→screen once at spawn, skips off-screen or behind-camera spawns, animates via CSS rise/fade, and fades in place under `prefers-reduced-motion`.
- `prefers-reduced-motion` suppresses camera trauma.

The Kenney castle GLBs previously contained redundant `KHR_texture_transform { texCoord: 0 }` entries that generated 13 warnings in Three r128. `tools/strip-gltf-noop.js` removed only those no-op entries and refuses transforms that change UV behavior. Do not run a generic destructive asset rewrite without comparing the visual result.

## Models and animation

`loadAssets()` loads common models plus only the current biome's light/heavy monster pair. Quaternius Ultimate Monsters provides 14 embedded clips per file. Enemy instances clone materials and use independent `AnimationMixer` objects. State mapping selects idle, walk/run, attack, hit reaction, jump/roll where available, and death.

The player uses the Quaternius RPG Warden model and action state changes for locomotion, super sprint, attacks, roll, hit, and death. Procedural geometry remains as a guarded fallback when a model cannot load.

Super sprint layers an anime-style overlay onto the Warden rig. After the mixer writes its pose each frame, `updateSprintPose()` applies additive world-axis bone rotations on top (torso/abdomen lean −.32/−.10 about the world-right axis, neck/head gaze up +.26/+.14, both upper arms swept back +.45 with a ±.15 world-up flare, lower-arm flex −.15), so the overlay is self-resetting—the mixer's next write replaces it. A `sprintPoseWeight` lerps toward 1 on super sprint (.65 on normal sprint) and drops to 0 during dodge, hit reaction, attack, airborne, idle, or non-playing states, keeping the pose out of combat silhouettes. Because the pose is now the speed cue, the super-sprint clip timescale was reduced from 1.48 to 1.25. Four additive speed-streak quads also trail the player at 12 Hz during grounded super sprint, skipped on mobile and under `prefers-reduced-motion`. The snapshot exposes the current weight as `combat.sprintPose`.

Ground enemies must be disposed through `disposeGroundEnemy()` so their mixers are stopped/uncached and cloned materials/geometries do not accumulate. Projectiles likewise remove and dispose their geometry/material when their life ends.

## Camera and controls

The camera is non-inverted, can orbit 360 degrees, and frames the Warden off shoulder. `C` swaps the shoulder. Wheel input changes distance. Optional target lock (`Tab` or middle click) keeps a valid enemy framed but releases if it dies or exceeds range.

Keyboard/mouse:

- move: `WASD` or arrows
- sprint: `Shift`
- super sprint: `Control`
- jump: `Space`
- attack: left click or `F`
- dodge: `Alt` or right click
- lock: `Tab` or middle click
- weapons: `1`–`4`
- rune interaction: `E`
- shout: `Q`
- shoulder: `C`
- skills: `K`
- pause: `Escape` or `P`

Touch has separate move/look zones and visible attack, jump, dodge, lock, shout/interact, and weapon buttons. Pushing the joystick to its outer edge enables sprint/super sprint. The compact release gate is 844×390 landscape.

## Minimap and objectives

The canvas minimap redraws at roughly 10 Hz and takes every marker color from a single `MARKER_STYLES` table—the on-map legend swatches hand-match it. A ten-entry legend chip (`#mapLegend`) identifies objective, rune, chest, soul, dragon, enemy, boss, fort, town, and keep; it renders on desktop only and is hidden below 1000 px wide, on coarse pointers, and on short viewports.

`currentObjective()` is the single source of guidance targets. It returns `{ position, label, kind }`—never the player—or `null`. Quest stage 0 points at Ashenhold Keep, stage 1 at the nearest living dragon (falling back to the keep), and stage 2 at the boss (falling back to the keep). At stage 3 the boss is dead, so the objective points at the live wave assault as "SURVIVE THE ASSAULT" during combat and returns `null` otherwise, hiding the needle entirely.

The compass needle carries an objective-name label (`#objectiveName`) beside the distance readout. On the map itself an in-range objective draws as a pulsing fire diamond with a white core; an off-range objective clamps to a chevron at the map rim pointing outward instead of disappearing. Marker shapes: souls are orange dots, dragons red triangles, the boss an orange ring, discovered POI towns mint house icons, and the player arrow white-gold.

## Combat model

Weapons:

| Weapon | Role | Base behavior |
| --- | --- | --- |
| Ashen Blade | close-range tempo | 34 melee, fast 0.42-second cooldown |
| Frostfang Bow | long range | 28 projectile, gravity, no melee |
| Wyrmcleaver Axe | heavy hybrid | 42 melee plus thrown splash and strong knockback |
| Stormcaller Staff | arcane control | fast splash bolts plus short melee |

`attack()` begins an animation and creates `pendingAttack`. `releasePlayerAttack()` performs damage/projectile release at 55% of the animation window; never reintroduce immediate duplicate damage. Mastery, permanent nodes, run nodes, combo state, and situational effects feed the final multiplier. A weapon key pressed mid-swing is buffered in `player.queuedWeapon` and equipped when the swing ends instead of being dropped.

The 0.58-second dodge costs 22 stamina. Its damage immunity window is approximately 0.10–0.36 seconds. Attack collisions use the last safe position and cannot pass through geometry. Melee hit detection uses horizontal distance within `weapon.range + min(hitRadius, 3) × .5` inside a vertical window (|dy| < 3.4 on the ground, < 5 against dragons) with a facing dot above .08, matching projectile generosity and letting melee connect with dragons on low swoops. Axe strikes impart stronger impulse; impact time includes 60–85 ms of hit-stop and camera trauma.

Enemy attacks are state timed:

- ground enemies show a rising telegraph ring before the strike frame
- dragons mark the velocity-led impact point during fire wind-up
- enemies snap their facing to the player at telegraph start; at the damage frame they recompute distance and require a facing dot above .15
- damage occurs only after the readable wind-up
- dodge immunity is checked inside `damagePlayer()`

Dragons were overhauled in 5.1:

| Stat | Normal dragon | Vharok (boss) |
| --- | --- | --- |
| Base health | 150 | 520 |
| Fireball damage | 22 | 30 |
| Fireball speed | 27 | 33 |
| Fireball cooldown | 2.2 s + rng·1.4 s | 1.4 s + rng·0.9 s |
| Fire wind-up | 0.72 s | 0.55 s |
| Engage range | 115 | 160 |
| Kill XP | 320 | 950 |

Dragon health scales at 1.075 per threat and damage at 1.045 per threat. Fireballs aim with velocity lead: the telegraph targets player position plus velocity times the wind-up, and at launch the shot re-aims at a fresh player position plus full flight-time lead (distance ÷ projectile speed, capped at 1.2 s), so holding one direction no longer guarantees a miss — juking or dodge i-frames are the counters. The boss casts a three-fireball volley with ±0.09 radian spread and enrages below 35% health (cooldown × 0.75). Engaged dragons may swoop down to altitude 3 so melee connects on low passes, and fireball hits report the source "DRAGON FIRE".

Dragon kills also scatter soul orbs from the deterministic `encounterRandom` stream—three near the crash site, five for the boss. Absorb one with `E` within 11 units (the hint reads "Absorb Dragon Soul · +N XP") for Warden XP (normal: `round(38 + threat × 2.2)`; boss: `round(85 + threat × 3.5)`), run XP at × 0.72, and +6 shout. Souls expire after 50 seconds unclaimed.

Difficulty is a continuous threat value clamped from 1 to 32. It combines Warden level, strongest mastery, spent skill ranks, permanent realm depth, and current wave. Health rises faster than damage (roughly 7.5% versus 4.5% per threat step before archetype modifiers), avoiding unavoidable one-shot scaling. Heavy monsters are elites but do not replace the realm boss.

## Five-wave director and victory

`enemyDirector` is the only wave authority. Its phases are `intermission`, `combat`, and `complete`.

- initial timer: 4 seconds
- inter-wave timer: 8 seconds
- targets: 4, 6, 8, 10, 12
- maximum wave: 5
- completion heal: 20% health and full stamina
- resolving state grants temporary invulnerability while the end screen is prepared

Wave five does not start wave six. Full victory requires `enemyDirector.completed` and `questStage === 3`. Killing Vharok first instructs the player to finish the assault; finishing the waves first leaves the boss objective. On full victory, realm depth and prestige increase before the next realm is forged.

Runes are exploration pickups. They award Warden XP and run XP, scale with Runekeeper/Lore Hunger, checkpoint immediately, and never mutate the wave director.

Relic chests mirror that contract. Each realm spawns five—three fort courtyard chests (XP 70/90/110) and two summit troves (XP 130/160)—built as a procedural wood chest with a hinged lid, an emissive gold lock, and a gold ground ring. Opening one with `E` within 11 units animates the lid and awards Warden XP plus run XP at × 0.72, +25 health, and +20 shout charge, with a gold shockwave, combat text, and a banner. Claimed chests serialize as an id list in `world.chests` and restore on Continue; unopened chests show as gold squares on the minimap. Like runes, they never mutate the wave director.

## Progression and skill graph

The graph contains 60 nodes in 11 branches:

Permanent:

1. Warden — health, stamina, mitigation, lethal protection
2. Warmaster — global weapon tempo, combos, multi-mastery capstone
3. Voice — shout charging, force, armor, lightning
4. Wayfarer — super sprint, jumping, runes, exploration, realm starts
5. Duelist — blade specialization, riposte, bleed, dance
6. Ranger — bow damage, handling, penetration, split arrow
7. Reaver — axe focus, knockback, sundering, mutually exclusive Blood Pact/Stoneguard
8. Arcanist — staff efficiency, chaining, slow, overcharge, storm fields

Temporary per run:

9. Run: Fury — damage, haste, critical chance, rampage
10. Run: Resolve — health, stamina, guard, rebirth
11. Run: Hunt — XP, biome slaying, recovery, boss hunting

Nodes use integer ranks, costs, maximum ranks, required ranks, all/any prerequisites, exclusions, required Warden level, and weapon-specific `any`/`all`/named mastery gates. Legacy boolean values migrate to rank one.

Warden level caps at 50. XP earned beyond the cap feeds prestige instead of becoming trapped. Weapon mastery caps at 10 independently for each weapon. Run level caps at 25 and resets on victory/death; every run level awards a temporary point. Permanent points and run points are intentionally separate.

Primary tuning functions are `levelXpTarget()`, `runXpTarget()`, `weaponXpTarget()`, `weaponDamageMultiplier()`, `attackSpeedMultiplier()`, `attackStaminaCost()`, and the `skillTree` data.

## Save contracts

### Permanent progression

Local-storage key: `ashenhold-progression-v3`. Current payload version: 5.

```json
{
  "version": 5,
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
  "skills": {}
}
```

Compatibility fields `weaponLevel` and `weaponXp` are still written. `loadProgression()` migrates legacy single-weapon saves and boolean skill maps, and refuses payloads with `version` above 5: it warns and leaves the save untouched instead of blindly parsing unknown fields.

### Active run

Local-storage key: `ashenhold-active-run-v1`. Current payload version: 1. Saves debounce at 1.2 seconds, with immediate checkpoints at material transitions and `pagehide`.

The envelope stores:

- layout version, run ID, timestamp, biome, seed, realm depth
- player position/rotation, health/stamina/shout, kills/distance, weapon
- run level/XP/points/talents
- quest and boss state
- exploration cells, landmarks, claimed runes, claimed relic chest ids (`world.chests`), dead dragons
- director phase/wave/timer/target/defeated/completed/threat
- deterministic encounter RNG and spawn failure count

Restore clamps every numeric value, filters skill IDs/ranks, limits exploration arrays, rejects invalid biome/seed/layout data, validates collision/water at the saved position, and reconstructs boss/rune/landmark state. `world.chests` is a structural addition handled by migration: envelopes saved before it existed load with an empty claimed list instead of failing validation. Ambient live enemies are not serialized; a combat wave resumes from its defeated count and safely respawns the remainder. Dragon soul orbs follow the same policy: they are transient runtime actors, never written into the active-run envelope, and are disposed on collect, expiry, or `resetActors()`—unclaimed souls simply do not survive a reload.

`?test` disables persistence by default. Add `test-save` only for save migration/restore tests. Starting a fresh game clears the active envelope; ending a run also clears it before preparing the next realm.

## Assets and legal provenance

All runtime files are local:

- Kenney Castle Kit — CC0
- KayKit Medieval Hexagon Pack — CC0 (`.gltf`+`.bin`+shared `hexagons_medieval.png` atlas trios, `assets/models/kaykit-medieval/`)
- KayKit Dungeon Remastered — CC0 (self-contained GLBs, `assets/models/kaykit-dungeon/`)
- Kenney Fantasy Town Kit — CC0 (`assets/models/kenney-town/`; GLBs require the sibling `Textures/colormap.png`)
- Kenney Nature Kit — CC0 (self-contained GLBs, `assets/models/kenney-nature/`)
- Kenney Graveyard Kit — CC0 (`assets/models/kenney-graveyard/`; GLBs require the sibling `Textures/colormap.png`)
- Quaternius RPG Characters — CC0
- Quaternius Ultimate Monsters — CC0
- Quaternius animated animal/warg — CC0
- ambientCG biome PBR materials — CC0
- project-created/generated sky, terrain, interface, shaders, and audio

The source URLs and exact local license notices are indexed in `ATTRIBUTIONS.md`. The user-provided `assets/dragons.png` is design reference only and is excluded from production. Do not copy recognizable Skyrim UI, names, logos, characters, or copyrighted game assets into the release.

## Debug and audit interface

Normal pages expose read-only `window.ashenholdGame.snapshot()`. It reports state, player/progression, mastery, permanent/run ranks, realm, director, per-route reports (`world.routeReports`, each with `start` coordinates), settlement POIs (`world.pois`), model/material flags, quality, camera, combat (including the sprint-overlay weight `combat.sprintPose`), renderer draw/memory counts, spawn failures, signature prop counts (`world.props`), relic chest progress (`chestsOpened`/`totalChests`), and unclaimed dragon souls (`souls`).

Only `?test` exposes `window.__ASHENHOLD_TEST__` with mutation helpers for:

- start, movement, camera/lookAt, shoulder, jump, dodge, lock, attack, shout
- player/enemy placement and deterministic stepping
- wave completion and quest completion
- XP/mastery/skill resources and purchases
- terrain signatures and platform probes
- active-run write/read
- dragon soul and relic chest positions via `soulPositions()` and `chestPositions()`
- settlement POI composition via `poiDebug()` and the live objective contract via `objectiveInfo()`

Do not expose mutating helpers on the normal production URL.

### Fast smoke

Start the local server, then:

```powershell
$env:NODE_PATH='C:\Users\baile\.cache\ashenhold-e2e\node_modules'
node test-results\e2e-smoke.cjs
```

The reproducible alternative that needs no `NODE_PATH` cache is the pinned harness in `test-results/`: run `cd test-results && npm install` once, then `npm run smoke` (also `npm run audit`, `a11y`, `payload`, and `live`; see `test-results/README.md`). If port 4173 is occupied by another process, serve on another port and point the suites at it with `ASHENHOLD_BASE=http://127.0.0.1:<port>/`.

The smoke gate runs 40 checks covering boot, deterministic realm, PBR/model loading, platforms, 60-node skills, camera, weapon roles, runes, automatic waves/timer, high jump, super sprint and the sprint-pose overlay, dragon orientation, settlement POIs and their chests, the minimap legend, next-realm generation, and clean browser diagnostics.

### Full production audit

```powershell
$env:NODE_PATH='C:\Users\baile\.cache\ashenhold-e2e\node_modules'
node test-results\production-audit.cjs
```

The full audit boots two seeds for each biome (12 realm boots), verifies geometry divergence, six distinct model rosters, actually rendered/animated biome enemies, PBR assets, platform collision/route contracts, boolean save migration, weapon-specific gates, ranked purchases, active-run continuation, dodge immunity, target lock, telegraphs, hit-stop, axe knockback, exact five-wave completion, unified victory, 844×390 touch layout, and zero console/warning/HTTP failures.

The suite writes `test-results/production-audit.json` and screenshots. Headless WebGL may use software rendering, so a release still deserves a real-hardware FPS/thermal check and a longer memory soak.

Run `test-results/accessibility-audit.cjs` with the same `NODE_PATH` to scan desktop title/gameplay/skills and 844×390 touch gameplay. It requires `axe-core` in the external test cache and blocks serious/critical violations. Run `test-results/payload-audit.cjs` to record initial transfer, boot time, largest resources, renderer counts, diagnostics, and same-origin-only loading. The release budget is under 18 MB for a cold active-biome boot; the July 18 local result is 14.03 MB, while the production CDN result is 9.20 MB and 1.09 seconds across 45 requests.

## Deployment and live verification

The Vercel project is already linked locally. Deploy only after both suites pass:

```powershell
Set-Location C:\Users\baile\dragon-browser
vercel --prod --yes
```

`vercel.json` applies same-origin CSP, clickjacking denial, MIME sniffing protection, a restrictive Permissions Policy, opener/resource isolation, and differentiated cache rules. `.vercelignore` excludes local metadata, tests, tools, documentation, launcher, logs, and reference art.

After deployment verify both the returned immutable URL and stable alias:

1. Root returns 200 and reaches title with no errors/warnings.
2. `app.js` contains `WORLD_LAYOUT_VERSION = 5`.
3. An active Quaternius monster and biome normal map return 200.
4. CSP, `X-Content-Type-Options`, `X-Frame-Options`, and cache headers are present.
5. `/AGENTS.md`, `/GAME-DEVELOPER-GUIDE.md`, `/test-results/production-audit.cjs`, `/tools/strip-gltf-noop.js`, and `/assets/dragons.png` return 404.
6. Continue restores a locally created run on the stable alias.

Automate the HTTP/header/exclusion portion with `node test-results\live-deployment-audit.cjs`. Set `ASHENHOLD_BASE` to audit an immutable deployment URL; without it the script checks the stable production alias and writes `test-results/live-deployment-audit.json`.

Vercel may protect the generated immutable team URL with an authentication redirect even when the production alias is public. In that case, use the authenticated Vercel CLI for the immutable deployment and run the unauthenticated public audit against the stable alias.

## Safe extension patterns

Adding a biome requires a `BIOMES` material/light entry with sky palette and `stoneTint`, a `WORLD_PROFILES` geometry/road/fort/route/model roster, three local PBR maps, a signature prop set, licensed model files, attribution, snapshot coverage, and two-seed audit coverage.

Adding a skill requires a unique ID, data-defined rank/cost/prerequisites, an implemented gameplay effect, save compatibility, clear description, and audit of its weapon gate or exclusion. A displayed but nonfunctional node is a release bug.

Adding an enemy requires a readable wind-up, threat-based health/damage, safe seeded spawning, model fallback, animation state mapping, cleanup, minimap identity, XP/mastery rewards, and a platform/range strategy that prevents trivial terrain exploits.

Changing terrain/platforms requires validating start/keep/fort and per-route foundation zones, water/slope rejection, every `routeReport.valid`, under-platform traversal, safe run restoration, spawn failure counts, and two seeds per biome.

## Honest remaining limits

This release is a polished static browser game, not a large-studio native production. Current technical limits:

- Three.js r128 is stable but old; an upgrade needs a separate import/render regression pass.
- Ground enemies steer with two whisker probes (±0.55 rad, 3.5 u) against the height-bounded collider set, which routes them around static obstacles such as fort walls, but there is still no full navmesh or real pathfinding.
- Dragons are procedural rather than fully skeletal.
- Saves are local to the browser/device and can be edited by the player.
- No gamepad remapping, localization pipeline, cloud backend, leaderboard, or multiplayer exists.
- Automated WebGL coverage cannot replace real GPU, thermal, controller, accessibility-reader, and long-session QA.

Highest-value future work is a Three.js upgrade, navmesh/pathfinding with ranged platform counters, skeletal dragons, mesh LODs, gamepad/accessibility settings, a real CC0 music/ambient mix, and an opt-in authenticated cloud-save service only when backend scope is authorized.
