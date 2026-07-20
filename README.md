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

## Release 5.6: One continent

Ashenhold is now one permanent, authored 1,800-metre continent instead of a generated realm selected by biome and seed. The Drowned Coast, Verdant Ruins, Ember Dunes, Frostbound Wilds, Sky-Sunder Peaks, and Moonfall Expanse occupy fixed geographic zones in the same live scene. Walking across a border changes terrain materials, fog, lighting, skybox, vegetation, props, enemy roster, and location presentation without a reload. Ember Dunes is deliberately treeless across procedural forests, imported scenery, and POI decoration; cacti and stone obelisks retain its desert density. Regional PBR and creature assets stream ahead near biome boundaries, keeping cold start below budget while hydrating distant defenders in place. Fixed forts, ascents, settlements, shrines, ruins, camps, infrastructure, and thousands of old-growth trees across the other biomes make the layout consistent for exploration, saves, and co-op parties.

Captured shrines and the Moonfall graveyard now raise a 20-22 metre animated Warden standard that persists in the active save and appears on the minimap. Normal sprint and super-sprint jumps retain horizontal takeoff velocity through rise and fall, with limited air steering and a dedicated airborne animation pose. Remote party members use the same full animated Warden GLTF as the local player, with server-stable cape, shoulder, marker, and nameplate colors to distinguish each connected Warden.

Parties now identify only the canonical `ashenhold-continent-v1` world. Invite links carry a room code and auto-join flag but no biome or seed; old links are cleaned in place, old layout-7 saves migrate without regenerating the map, and contradictory world registrations are rejected.

## Release 5.5: Living world and co-op

The world now uses a measured one-unit-per-metre model registry and layout version 7. Settlement houses, castle walls, gates, towers, colliders, and door clearances share player-readable dimensions instead of pack-specific source scales. Each biome also receives its own generated sky and horizon treatment, 24-32 seeded infrastructure micro-landmarks, and an ancient instanced forest with thousands of trees, rare hero trunks, near/far detail, and chunk culling. Captured shrines and graveyards raise persistent Warden flags and add a matching minimap marker.

Strongholds feel inhabited before combat begins. Gate sentries, courtyard defenders, tower lookouts, reserves, and beast patrols hold seeded posts and routes; vision cones, movement noise, suspicion, ally alerts, local navigation, separation, return-to-post behavior, and stuck recovery replace immediate omniscient pursuit.

Optional co-op supports parties of two to four Wardens. Choose **Host Co-op** or **Join Room** on the title screen, share the six-character code, and let the host start the shared continent. The protocol 2 room service owns shared ground-enemy and bonded-companion simulation, damage, chest claims, taming, stronghold clears, and host succession; browser clients interpolate remote Wardens and expose room, roster, connection, and latency status. Multi-target attacks share a server-validated action ID, while incoming enemy strikes use a hit-intent/acknowledgement exchange so the existing dodge, invulnerability, and defensive skill rules still resolve in the player's browser. If the host disconnects or falls, the earliest connected living Warden becomes host immediately. Solo remains the default and opens no network connection.

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

The start screen is a responsive command deck with an animated continent sigil, current biome/level/stronghold briefing, explicit Continue/New Campaign actions, and Solo/Host/Join party states that remain usable at the 844x390 landscape target.

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
- `app.js` - renderer, authored continent, collision, AI, combat, progression, saves, audio, debug API
- `multiplayer-client.js` - protocol 2 client, private session reconnect credentials, interpolation, and server URL selection
- `multiplayer-avatars.js` - animated remote-Warden presentation
- `multiplayer-game.js` - game-to-room synchronization coordinator
- `multiplayer-ui.js` - title party flow, invite links, roster, status, and in-game party HUD
- `multiplayer-server/` - authoritative in-memory rooms, tests, and Vercel entry points
- `assets/` - local runtime libraries, CC0 models, textures, fonts, and license notices
- `.github/workflows/pages.yml` - runtime-only GitHub Pages deployment
- `test-results/` - Playwright smoke, production, accessibility, payload, and live-deployment audits

GitHub Pages receives the four base runtime files, four multiplayer browser modules, and `assets/`; the Node server, tests, handoff documents, tools, and workstation metadata are excluded from the deployment artifact.

### Co-op service and security

Production uses protocol 2 at these public endpoints:

- secure WebSocket: `wss://multiplayer-server-weld.vercel.app/api/ws`
- service health: https://multiplayer-server-weld.vercel.app/health

The WebSocket declared by the public meta tag is the sole permitted cross-origin runtime request; assets and all non-party requests remain same-origin. It opens only after Host/Join is selected and connected, or when an explicit `?room=CODE&autojoin=1` invite is followed.

The service issues each Warden a random public player UUID. Its welcome message also returns a separate, high-entropy private reconnect credential, which the client keeps in `sessionStorage` under that room and presents only when reclaiming the same player identity. The credential is not placed in invite URLs, room codes, rosters, shared snapshots, logs, or the static build. A room code allows someone to join an available room; it is an invitation, not authentication, privacy, or access control. Display name, public player ID, fixed world identity, transforms, combat state, and gameplay events cross the socket.

The service owns hostile ground AI, bonded-companion follow/target/attack behavior, attack cadence/range/target limits, chest and tame claims, and stronghold state. An action ID groups the valid targets of one swing, projectile, shout, chain, trail, or splash instead of charging each target as a separate attack. For damage against a Warden, the server sends a one-use hit intent; the addressed client applies local avoidance and mitigation and acknowledges the resulting health. A short server timeout applies the raw hit if no valid acknowledgement arrives.

Host succession is immediate when the active host disconnects or is defeated: the earliest connected living Warden receives authority. The former host's identity record remains reclaimable for 60 seconds with its private credential, but reconnecting does not displace the current host.

Rooms are unauthenticated and process-memory only, allow four connected Wardens, use a 30-minute idle cleanup, and retain disconnected identities for 60 seconds only while that server instance survives. The Vercel WebSocket function is configured with a maximum 300-second invocation duration, and the provider may end or replace an instance sooner. A reconnect can therefore find that the room no longer exists or was created on another instance; automatic retry is not durable recovery. There is no account, matchmaking, private-room authorization, cross-instance routing, durable room state, cloud save, voice/text chat, or anti-cheat guarantee. Permanent progression and active-run saves remain local to each browser.

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
npm run live
```

Release 5.6 is gated by fixed-continent, deterministic gameplay, garrison-AI, and traversal-motion regressions; a six-zone production audit; desktop/mobile WCAG scans; a cold-start payload budget under 18 MB; Node room-service tests; a two-browser production-adapter audit; a two-client remote protocol 2 socket smoke; and a live GitHub Pages audit. The service suite covers fixed-world validation, private reconnect credential rejection, immediate host succession, reserved reconnect slots, authoritative world/enemy/chest/stronghold state, bounded health and status effects, hit acknowledgements with timeout fallback, and supported weapon cadence/range envelopes. The complete contracts and extension notes are in [GAME-DEVELOPER-GUIDE.md](GAME-DEVELOPER-GUIDE.md).

## Assets and saves

Third-party asset provenance is documented in [ATTRIBUTIONS.md](ATTRIBUTIONS.md). Runtime assets are local and no private credential is embedded in the client.

Release 5.6 maps the user-provided FreeStylized materials to geographic biome zones as follows. Each named runtime triplet contains local WebP color, OpenGL-normal, and roughness maps.

| Realm | Source material | Runtime maps |
| --- | --- | --- |
| Verdant Ruins (`jungle`) | Ground Tiles 13 | `jungle-{color,normal,roughness}.webp` |
| Drowned Coast (`shore`) | Ground Tiles 17 | `shore-{color,normal,roughness}.webp` |
| Ember Dunes (`desert`) | Sand 01 | `desert-{color,normal,roughness}.webp` |
| Frostbound Wilds (`snowy`) | Existing ambientCG snow material | existing snow color/normal/roughness JPGs |
| Sky-Sunder Peaks (`mountains`) | Ground With Rocks 03 | `mountains-{color,normal,roughness}.webp` |
| Moonfall Expanse (`moon`) | Lava Rocks 01 | `moon-{color,normal,roughness}.webp` |

Ancient hero trees use the shared FreeStylized Foliage Kit derivatives `assets/models/freestylized-foliage/F1_Tree1.glb` and `F1_Tree3.glb`. They were converted, welded, and quantized for the browser; the source pack's large texture set is intentionally omitted so the meshes receive Ashenhold's biome palette at runtime. Exact source links, adaptations, and redistribution terms are recorded in [ATTRIBUTIONS.md](ATTRIBUTIONS.md) and the notices beside each asset family.

Progress is stored in browser local storage. Permanent Warden progression and relic bonuses survive runs; active-run state restores the current realm, stronghold clears, chest/rune claims, companion bonds, and deterministic encounter state. Saves are device/browser local and can be edited by the player.
