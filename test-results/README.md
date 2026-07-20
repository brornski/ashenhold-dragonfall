# Ashenhold 5.5 test harness

Dev-only Playwright suites. The GitHub Pages workflow publishes a runtime-only artifact, so nothing in this directory ships with the game.

## Setup

```powershell
Set-Location test-results
npm install
npx playwright install chromium
```

## Run

Serve the repository root first:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then run from `test-results/`:

- `npm run smoke` - deterministic gameplay regression, including layout 7 world scale, forest LOD/culling, capture flags, strongholds, relic power, taming, collision, sprint, and victory
- `npm run ai` - deterministic living-garrison roles/posts, patrols, perception/noise, shared alerts, state, navigation, separation, leashes, culling continuity, and recovery
- `npm run motion` - strict chest interaction, desktop/touch skill access, airborne/landing phases, slope-gated slide, carried jump momentum, collision, and flat/uphill super sprint
- `npm run multiplayer` - two-browser production Host/Join flow on the fixed continent, start gating, bidirectional movement, full-model remote Wardens with stable colors, authoritative combat/stronghold/chest convergence, strict chest range, same-identity reconnect, party HUD, and Solo no-connect audit
- `npm run world` - fixed-map identity, all six geographic biome zones in one document, legacy seed/save migration, tall persistent shrine flags, and sprint-jump momentum retention
- `npm run audit` - six fixed-continent biome zones, sky transitions, ancient forests, infrastructure, progression, combat, save, scale, living AI, motion, co-op packaging, and 844x390 audit
- `npm run a11y` - axe-core scan of title/party, gameplay, skills, and 844x390 states
- `npm run payload` - boot timing, transfer budget, renderer, diagnostics, same-origin asset gate, and exact opt-in WebSocket exception
- `npm run live` - post-deployment GitHub Pages audit for the 5.5 app marker, co-op modules and load order, production WSS declaration, runtime assets, and exclusion of server/development source

`ASHENHOLD_BASE` overrides the target. Reports and screenshots are written beside the runners and ignored by Git. Any false top-level check blocks release.

## Existing workstation cache

The original workstation can run without installing locally:

```powershell
$env:NODE_PATH='C:\Users\baile\.cache\ashenhold-e2e\node_modules'
node e2e-smoke.cjs
```

`npm install` remains the reproducible setup for other machines.

## Multiplayer server gates

The room service is tested from its own package because it has production dependencies:

```powershell
Set-Location ..\multiplayer-server
npm ci
npm test
npm run test:remote -- wss://multiplayer-server-weld.vercel.app/api/ws
```

The current Node suite covers the protocol 2 health contract, four-player ceiling, host-only world/start authority, late boss registration, compressed navigation decoding, enemy damage and stronghold convergence, strict chest range and per-player claims, living AI state, taming/status bounds, supported weapon cadence/range envelopes, maximum-health allowances, and same-identity reconnect state. Adversarial cases reject a missing or incorrect private reconnect credential without disconnecting the victim, ensure the credential never enters shared snapshots, reserve a disconnected identity's room slot during its 60-second grace, immediately promote a connected living successor when a host disconnects or falls, and keep that successor authoritative if the former host returns.

The hit-acknowledgement test verifies that a client can preserve a legitimate dodge/avoidance result and that an unacknowledged intent applies authoritative damage after the short timeout. Action tests cover protocol-level IDs, cadence, status-effect bounds, and projectile envelopes; the browser adapter audit verifies the production scripts and real Host/Join UI rather than a test-only client fixture. The remote smoke creates a host and guest against the deployed protocol 2 endpoint, registers a minimal world, and verifies the shared start event.

These gates do not simulate a full 30-minute room, provider instance migration, the Vercel function's 300-second maximum invocation boundary, sustained load, or cross-instance recovery. The deployment is process-memory only, so those paths cannot be treated as durable even when local and short remote tests pass.

All client assets and ordinary requests must remain same-origin. The sole allowed external runtime request is an explicitly initiated `wss://multiplayer-server-weld.vercel.app/api/ws` connection; its public health endpoint is `https://multiplayer-server-weld.vercel.app/health`, and a Solo title/gameplay pass must open no socket. Rooms are transient and unauthenticated. Reports may identify public player IDs and room codes, but must never contain private reconnect credentials or imply that a room code is a security token.
