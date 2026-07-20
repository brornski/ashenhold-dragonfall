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
- `npm run multiplayer` - two-browser Host/Join realm alignment, remote Warden, authoritative shared-event, party HUD, reconnect/host transfer, and Solo no-connect audit
- `npm run audit` - multi-biome/seed sky, ancient forests, infrastructure, progression, combat, save, scale, living AI, motion, co-op packaging, and 844x390 audit
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

The current Node suite covers the health/protocol contract, four-player limit, host-only start authority, world registration, enemy damage and stronghold convergence, chest range and per-player claims, AI state updates, and same-client reconnect state. The remote smoke creates a host and guest, registers a minimal world, and verifies the start event against the deployed service. Host succession, expiry, taming, and adversarial rate/bounds cases remain required additions before those paths can be claimed as fully regression-gated.

All client assets and ordinary requests must remain same-origin. The sole allowed external runtime request is an explicitly initiated `wss://multiplayer-server-weld.vercel.app/api/ws` connection; a Solo title/gameplay pass must open no socket. Rooms are transient and unauthenticated, so test output must never contain credentials or imply that room codes are security tokens.
