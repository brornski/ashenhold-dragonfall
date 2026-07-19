# Ashenhold: Dragonfall

Ashenhold is a third-person 3D dark-fantasy action roguelite that runs entirely in the browser. Hunt dragons, clear location-based garrisons, tame hostile creatures, climb dense ruined settlements, and build a Warden across persistent and per-run skill trees.

## Play

- GitHub Pages: https://brornski.github.io/ashenhold-dragonfall/
- Source: https://github.com/brornski/ashenhold-dragonfall
- Windows launcher: `open-dragon-browser.cmd`

For local play, serve the repository over HTTP:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`. Do not use `file://`; browser security rules prevent reliable model and texture loading from a local file URL.

## Release 5.4: Strongholds

The five-wave arena director has been replaced by a realm-wide conquest system. Every fort, settlement, ascent summit, ruin, camp, and the keep can hold a seeded enemy garrison. Composition and count scale with Warden level, locations keep their own leashed defenders, and clearing one grants a location-specific mix of XP, healing, shout charge, stamina, weapon mastery, or run XP. Victory now requires defeating Vharok and securing every stronghold.

Exploration progression is permanent. Every current and newly generated relic chest contains a deterministic 1-3% permanent increase to one of six stats: damage, maximum health, regeneration, sprint speed, maximum stamina, or critical damage. These bonuses stack, save immediately, migrate from earlier progression files, and remain after victory or death.

Traversal received a full collision and stamina overhaul:

- movement uses substeps at high speed, orientation-aware capsule checks, wall sliding, step-height handling, and automatic depenetration with a last-safe fallback
- castle doorways and settlement entrances maintain walkable clearance
- sprint and super sprint use latched enter/exit thresholds, eliminating low-stamina animation flicker
- the new permanent `THE STRIDE` branch adds six ranked nodes, up to roughly +130% super-sprint speed, reduced drain, sprint regeneration, a launch shockwave, and a damaging lightning trail
- tamed creatures add a Bonded Pace bonus, making traversal faster again

Hostile wargs and biome creatures can now become companions. Stormcaller staff hits slow and build tame progress; critical hits also weaken their will. When a creature is slowed and ready, press `E` to bond it. Up to two companions follow the Warden, attack nearby enemies, count as non-lethal stronghold clears, and persist in an active-run save.

The world is denser and more readable. Realms now generate 8-11 settlement POIs, including raider camps and ruin clusters, with more intricate combinations of the local Kenney, KayKit, and Quaternius model packs. The public `window.ashenholdGame.modelCatalog()` API lists every active model slot and its local asset path for inspection in browser developer tools.

The start screen is a new responsive command deck with an animated realm sigil, current biome/seed/level/stronghold briefing, explicit Continue/New Realm actions, and a compact 844x390 landscape layout.

## Controls

- `WASD` / arrows: move
- Mouse / touch drag: non-inverted 360-degree camera
- `Shift`: sprint
- `Control`: super sprint
- `Space`: high jump
- Left click / `F`: attack
- `Alt` / right click: dodge roll with invincibility frames
- `Tab` / middle click: target lock
- `1`-`4`: blade, bow, axe, staff
- `E`: interact, absorb, open a chest, or tame a ready creature
- `Q`: Dragon Shout
- `C`: swap camera shoulder
- `K`: skill constellations
- Mouse wheel: camera distance
- `Escape` / `P`: pause

Landscape touch layouts include movement, look, attack, jump, dodge, lock, shout/interact, and weapon switching.

## Technical overview

The game has no runtime package manager or build step. It is a static HTML/CSS/JavaScript client using a locally vendored Three.js r128 stack and same-origin models, textures, fonts, and licenses.

- `index.html` - semantic shell, HUD, menus, title deck, touch controls
- `styles.css` - responsive interface, animation, accessibility, biome grading
- `app.js` - renderer, procedural world, collision, AI, combat, progression, saves, audio, debug API
- `assets/` - local runtime libraries, CC0 models, textures, fonts, and license notices
- `.github/workflows/pages.yml` - runtime-only GitHub Pages deployment
- `test-results/` - Playwright smoke, production, accessibility, payload, and live-deployment audits

GitHub Pages receives only the four runtime files plus `assets/`; tests, handoff documents, tools, and workstation metadata are excluded from the deployment artifact.

## Test

Install the dev-only harness once:

```powershell
Set-Location test-results
npm install
npx playwright install chromium
```

With the game served locally, run:

```powershell
npm run smoke
npm run audit
npm run a11y
npm run payload
```

Release 5.4 is gated by a deterministic gameplay smoke, a multi-biome/seed production audit, desktop/mobile WCAG scans, a cold-start payload budget under 18 MB, and a live GitHub Pages audit. The complete contracts and extension notes are in [GAME-DEVELOPER-GUIDE.md](GAME-DEVELOPER-GUIDE.md).

## Assets and saves

Third-party asset provenance is documented in [ATTRIBUTIONS.md](ATTRIBUTIONS.md). Runtime assets are local and no private credential is embedded in the client.

Progress is stored in browser local storage. Permanent Warden progression and relic bonuses survive runs; active-run state restores the current realm, stronghold clears, chest/rune claims, companion bonds, and deterministic encounter state. Saves are device/browser local and can be edited by the player.
