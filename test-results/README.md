# Ashenhold test harness

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

- `npm run smoke` - deterministic gameplay regression, including world scale, forest LOD/culling, capture flags, strongholds, relic power, taming, collision, sprint, and victory
- `npm run ai` - deterministic living-garrison roles, patrols, perception, state, navigation, separation, and recovery audit
- `npm run audit` - multi-biome/seed sky, ecology, infrastructure, progression, combat, save, scaling, and mobile audit
- `npm run a11y` - axe-core scan of title, gameplay, skills, and mobile states
- `npm run payload` - boot timing, transfer budget, renderer, diagnostics, and same-origin gate
- `npm run live` - post-deployment HTTP/artifact audit against GitHub Pages

`ASHENHOLD_BASE` overrides the target. Reports and screenshots are written beside the runners and ignored by Git. Any false top-level check blocks release.

## Existing workstation cache

The original workstation can run without installing locally:

```powershell
$env:NODE_PATH='C:\Users\baile\.cache\ashenhold-e2e\node_modules'
node e2e-smoke.cjs
```

`npm install` remains the reproducible setup for other machines.
