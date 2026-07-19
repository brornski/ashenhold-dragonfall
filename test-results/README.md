# Ashenhold test harness

Dev-only Playwright suites. Nothing here ships: `test-results/` is excluded from deployment via `.vercelignore`.

## Setup

```sh
cd test-results
npm install
npx playwright install chromium
```

## Run

Serve the game first, from the repo root:

```sh
cd C:\Users\baile\dragon-browser
python -m http.server 4173 --bind 127.0.0.1
```

Then, from `test-results/`:

- `npm run smoke` — fast deterministic gameplay regression (`?test&biome=jungle&seed=424242`)
- `npm run audit` — full production audit (12-realm matrix)
- `npm run a11y` — accessibility audit (axe-core)
- `npm run payload` — startup payload budget (< 18 MB)
- `npm run live` — post-deployment checks against the live Vercel URL (run only after `vercel --prod`)

`ASHENHOLD_BASE` overrides the target origin for the local suites.

Reports and screenshots are written next to the runners (`smoke-output.json`, `production-audit.json`, etc.). Any false top-level check blocks release.

## Legacy invocation

Historically these ran with Playwright resolved from a machine-local cache:

```powershell
$env:NODE_PATH='C:\Users\baile\.cache\ashenhold-e2e\node_modules'; node test-results\e2e-smoke.cjs
```

That still works on machines with the cache, but `npm install` in this folder is the reproducible path.
