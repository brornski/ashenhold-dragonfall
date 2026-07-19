# Ashenhold: Dragonfall

A third-person 3D dark-fantasy action roguelite built for the browser with Three.js.

## Play

- GitHub Pages: https://brornski.github.io/ashenhold-dragonfall/
- Production: https://dragon-browser-nine.vercel.app
- Windows launcher: `open-dragon-browser.cmd`
- Local server: `python -m http.server 4173 --bind 127.0.0.1`

Open `http://127.0.0.1:4173/` after starting the server. Do not use `file://`; browser security rules prevent reliable model and texture loading that way.

## Controls

- `WASD` / arrows: move
- Mouse / touch drag: non-inverted 360-degree camera
- `Shift`: sprint
- `Control`: super sprint
- `Space`: high jump
- Left click / `F`: attack
- `Alt` / right click: dodge roll with invincibility frames
- `Tab` / middle click: toggle target lock
- `1`–`4`: blade, bow, axe, staff
- `E`: absorb a nearby XP rune or dragon soul, or open a relic chest
- `Q`: Dragon Shout
- `C`: swap shoulder camera
- `K`: progression constellations
- Wheel: camera distance
- `Escape` / `P`: pause

Landscape touch layouts include movement, look, attack, jump, dodge, lock, shout/interact, and weapon switching.

## Release 5.3

The realms are inhabited now. Every seed scatters five to seven settlements across the terrain—hamlets, watchposts, and ruin shrines assembled from newly vendored CC0 packs (KayKit Medieval Hexagon, Kenney Fantasy Town, Kenney Nature, KayKit Dungeon, and Kenney Graveyard). Hamlets ring three to five buildings around a well or market with dressed props, a campfire, and a cache chest; watchposts raise a tower with walkable interior wood tiers up to a chest on top; ruin shrines cluster statues, broken walls, and an altar around their trove—and under the violet moon the shrine becomes a fenced graveyard with a crypt and a crooked pine. Camp guards protect each settlement but leash to their post: draw one too far and it breaks off the chase and walks home.

The minimap finally explains itself. A ten-entry legend names every marker, the compass needle speaks the objective's name, and objectives beyond the map's range clamp to a chevron on the rim instead of vanishing. Souls glow as orange dots, dragons cut red triangles, the boss wears an orange ring, and discovered towns show as mint houses—while the objective itself burns as a pulsing fire diamond with a white core. Once the boss falls the needle stops pointing at dragons entirely and simply reads SURVIVE THE ASSAULT.

Super sprint has a new silhouette. An additive anime-style pose laid over the Warden rig leans the torso forward, sweeps the arms back, and lifts the gaze, fading in with speed and snapping off the moment you dodge, strike, or leave the ground. The sprint clip itself runs slower now—the pose is the speed cue—and four speed streaks trail behind at full tilt.

## Release 5.2

The world grew a spine. The old floating-slab vertical routes are gone; each realm now builds two ascent structures. Route A is the Spire, a masonry watchtower anchored in the terrain with four switchback stair flights (eight steps each, rise .75—walkable, no jumping), corner landings on full-height pillars, and a summit deck ringed by parapets that block walking off the edge but let a jump clear. Route B is the Scaffold ruin, a broken castle wall face carrying three wooden decks on visible support posts, linked by plank step-runs with open-edge rails and a broken sky-bridge up top. Every step, landing, and deck is a registered walkable platform, and a rotation-math fix in the collision queries means elongated rotated pieces finally behave.

Relic chests join runes as exploration rewards. Each realm hides five—three fort courtyard chests and two summit troves—procedural wood chests with hinged lids, emissive gold locks, and gold ground rings. Open one with `E` to animate the lid and claim Warden XP plus run XP, +25 health, and +20 shout charge, announced with a gold shockwave, combat text, and a banner. Claimed chests persist in the save like runes, and the minimap marks unopened ones with gold squares.

Biomes are unmistakable now. Each family gets its own canvas-generated gradient sky (cold-bright snowy, teal-misty jungle, hot amber desert, seafoam shore, slate alpine, violet moon) with environment lighting baked from it, signature instanced prop sets (snow-pines and ice shards, broadleaf trees and mossy boulders, cacti and obelisks, palms and driftwood, dark pines and cairns, glow-crystals and rim rocks), stone-tinted castle architecture, and its own exposure, ash particles, and pebble grading.

Realm progression is a deterministic ladder instead of a random next biome: jungle, shore, desert, snowy, mountains, moon, then around again with a fresh seed on every death or victory. The title screen shows where you stand ("BIOME N OF 6"), end screens name the next stop, and the HUD quest panel carries a biome tag.

## Release 5.1

Dragons grew up. Base health is now 150 (boss 520) with steeper threat scaling, and fireballs aim with velocity lead—telegraphed at your predicted position, then re-aimed at launch with flight time—so movement no longer makes you untouchable. Fireballs hit harder, fly faster, and come more often; the boss casts three-shot volleys and enrages below 35% health. Dragon kills award 320 XP (boss 950) and scatter dragon souls—three orbs, five for the boss—that arc to the ground near the crash site. Absorb them with `E` for Warden XP, run XP, and shout charge before they expire.

Combat feedback and fairness tightened. A pooled floating combat-text layer shows damage numbers, crits, heals, and XP gains with zero per-frame allocation. Melee hit detection now matches projectile generosity and connects with dragons on low swoops; enemy telegraphs snap facing and re-verify distance and facing at the damage frame; weapon switches pressed mid-swing are buffered and applied when the swing ends. Ground enemies steer around fort walls and other static obstacles with light whisker probes (still no full navmesh).

Engineering: saves with a payload version above 5 are refused with a warning instead of being misparsed, stone-box materials are cached per tiling key, `manifest.json` is now a real fullscreen web app manifest (the old Chrome-extension manifest moved to `tools/chrome-extension/`), and `test-results/` gained a pinned `package.json` and README so the suites run with `npm install` and `npm run smoke`—no `NODE_PATH` cache required.

## Release 5.0

Every victory or death forges a new seeded realm. The six biome families use different terrain algorithms—glaciers, karst, dunes, archipelagos, alpine ridges, and lunar craters—plus seed-varied bastions, roads, landmarks, and traversable vertical routes. Each biome loads its own animated Quaternius monster pair and local PBR terrain material.

Progression has 60 ranked nodes across eight permanent branches and three per-run branches. Permanent Warden levels, prestige, realm depth, weapon mastery, and skills survive between runs. Run levels, run XP, temporary talents, health, world discoveries, quest state, wave state, encounter RNG, and position are checkpointed so Continue restores the current realm.

Combat includes animation-timed strikes, a stamina dodge with i-frames, telegraphed enemy attacks, optional lock-on, hit-stop, camera trauma, knockback, four distinct weapons, dragons, and five exact assault waves with recovery timers. Victory requires the assault and realm boss; runes award XP and never control waves.

## Source and handoff

This is a dependency-free static client:

- `index.html` — semantic shell, HUD, menus, touch controls, local script order
- `styles.css` — responsive presentation and biome grading
- `app.js` — engine, world generation, combat, progression, saving, audio, and debug API
- `assets/` — local runtime libraries, models, textures, fonts, and licenses
- `vercel.json` / `.vercelignore` — production headers, caching, and deployment exclusions
- `test-results/e2e-smoke.cjs` — fast deterministic gameplay regression
- `test-results/production-audit.cjs` — 12-realm, progression, combat, wave, save, and mobile audit
- `test-results/accessibility-audit.cjs` — four-state WCAG scan (requires the external test cache)
- `test-results/payload-audit.cjs` — startup transfer, boot timing, renderer, and same-origin gate
- `test-results/live-deployment-audit.cjs` — deployed headers, caching, assets, and exclusion gate

Future developers and coding agents must read `AGENTS.md`, `GAME-DEVELOPER-GUIDE.md`, and `ATTRIBUTIONS.md` before modifying or deploying the game. No private credential is embedded in the source.

The working copy is initialized as a Git repository on `main`; generated audit evidence and local deployment metadata are ignored while the reusable test runners remain versioned.
