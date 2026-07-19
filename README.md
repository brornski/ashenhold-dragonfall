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

## Release 5.5: Living realms and co-op

The world now uses a measured one-unit-per-metre model registry and layout version 7. Settlement houses, castle walls, gates, towers, colliders, and door clearances share player-readable dimensions instead of pack-specific source scales. Each biome also receives its own generated sky and horizon treatment, 24-32 seeded infrastructure micro-landmarks, and an ancient instanced forest with thousands of trees, rare hero trunks, near/far detail, and chunk culling. Captured shrines and graveyards raise persistent Warden flags and add a matching minimap marker.

Strongholds feel inhabited before combat begins. Gate sentries, courtyard defenders, tower lookouts, reserves, and beast patrols hold seeded posts and routes; vision cones, movement noise, suspicion, ally alerts, local navigation, separation, return-to-post behavior, and stuck recovery replace immediate omniscient pursuit.

Optional co-op supports parties of two to four Wardens. Choose **Host Co-op** or **Join Room** on the title screen, share the six-character code, and let the host start the aligned biome and seed. The WebSocket room service owns shared enemy AI, damage, chest claims, taming, stronghold clears, and host succession; browser clients interpolate remote Wardens and expose room, roster, connection, and latency status. Solo remains the default and opens no network connection.

Traversal now distinguishes grounded sprinting, downhill sliding, airborne rise/fall, momentum-carrying slide jumps, and landing recovery. `Control` starts a slide only on a usable descent and remains super sprint on flat or uphill terrain. The skill constellations are always reachable with `K` or the dedicated desktop/touch control.

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

The start screen is a responsive command deck with an animated realm sigil, current biome/seed/level/stronghold briefing, explicit Continue/New Realm actions, and Solo/Host/Join party states that remain usable at the 844x390 landscape target.

## Controls

- `WASD` / arrows: move
- Mouse / touch drag: non-inverted 360-degree camera
- `Shift`: sprint
- `Control`: slide on a downhill grade; otherwise super sprint
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

Landscape touch layouts include movement, look, attack, jump, downhill slide/super sprint, dodge, lock, shout/interact, weapon switching, and direct skill access.

## Technical overview

The game client has no runtime package manager or build step. It is static HTML/CSS/JavaScript using a locally vendored Three.js r128 stack and same-origin models, textures, fonts, and licenses. Co-op is backed by a separate Node WebSocket room service.

- `index.html` - semantic shell, HUD, menus, title deck, touch controls
- `styles.css` - responsive interface, animation, accessibility, biome grading
- `app.js` - renderer, procedural world, collision, AI, combat, progression, saves, audio, debug API
- `multiplayer-client.js` - protocol client, reconnects, interpolation, and server URL selection
- `multiplayer-avatars.js` - animated remote-Warden presentation
- `multiplayer-game.js` - game-to-room synchronization coordinator
- `multiplayer-ui.js` - title party flow, invite links, roster, status, and in-game party HUD
- `multiplayer-server/` - authoritative in-memory rooms, tests, and Vercel entry points
- `assets/` - local runtime libraries, CC0 models, textures, fonts, and license notices
- `.github/workflows/pages.yml` - runtime-only GitHub Pages deployment
- `test-results/` - Playwright smoke, production, accessibility, payload, and live-deployment audits

GitHub Pages receives the four base runtime files, four multiplayer browser modules, and `assets/`; the Node server, tests, handoff documents, tools, and workstation metadata are excluded from the deployment artifact.

### Co-op service and security

The production client declares `wss://multiplayer-server-weld.vercel.app/api/ws` in a public meta tag. This secure WebSocket is the sole permitted cross-origin runtime request; assets and all non-party requests remain same-origin. The connection is opened only after Host/Join is selected and connected, or when an explicit `?room=CODE&autojoin=1` invite is followed. No credential is embedded in the client. Display name, transient session ID, realm identity, transforms, and gameplay events cross the socket, so room codes are invitations rather than authentication and must not be treated as secrets or access control.

Rooms are memory-only, expire after 30 idle minutes, allow four connected Wardens, and retain a disconnected player record for 60 seconds. There is no account, matchmaking, private-room authorization, durable room state, cloud save, voice/text chat, or anti-cheat guarantee. Permanent progression and active-run saves remain local to each browser. A server restart or serverless instance replacement loses live rooms.

To run and test the room service locally:

```powershell
Set-Location multiplayer-server
npm ci
npm test
npm start
```

The local endpoint is `ws://127.0.0.1:8787/ws`. Because the release meta tag selects the public service, override it in browser storage while developing, then reload:

```js
localStorage.setItem("ashenhold.multiplayer.serverUrl", "ws://127.0.0.1:8787/ws");
```

Clear that key to restore the public endpoint. After deploying a server, run `npm run test:remote -- wss://your-host.example/ws` (the production Vercel path is `/api/ws`).

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
npm run ai
npm run multiplayer
npm run audit
npm run a11y
npm run payload
npm run motion
```

Release 5.5 is gated by deterministic gameplay, garrison-AI, and traversal-motion regressions; a multi-biome/seed production audit; desktop/mobile WCAG scans; a cold-start payload budget under 18 MB; Node room-service tests; a two-client remote socket smoke; and a live GitHub Pages audit. The complete contracts and extension notes are in [GAME-DEVELOPER-GUIDE.md](GAME-DEVELOPER-GUIDE.md).

## Assets and saves

Third-party asset provenance is documented in [ATTRIBUTIONS.md](ATTRIBUTIONS.md). Runtime assets are local and no private credential is embedded in the client.

Progress is stored in browser local storage. Permanent Warden progression and relic bonuses survive runs; active-run state restores the current realm, stronghold clears, chest/rune claims, companion bonds, and deterministic encounter state. Saves are device/browser local and can be edited by the player.
