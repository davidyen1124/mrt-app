# Bus+ Taipei MRT Web Rebuild

This repository recreates the Taipei MRT portions of the Bus+ Android application as a web stack. A Cloudflare Worker exposes the API surface area while a Vite + React single-page app renders an interactive station map, search, and ETA sheet.

## Repository Map
- `frontend/` – Vite/Tailwind React app. `src/ui/` contains map, search, and sheet components.
- `worker/` – Cloudflare Worker that serves built assets from KV and normalizes ETA responses.
- `data/` – Extracted MRT datasets bundled with the Worker (`metro_taipei_stations_zh.json`, `taipei_station_coords.json`).

## Prerequisites
- Node.js 18 or newer with npm.
- Wrangler CLI (`npm i -g wrangler`) authenticated against your Cloudflare account before deploying.
- Optional: Playwright browsers installed via `npx playwright install` to run UI smoke tests.

## Quickstart
1. Install dependencies per package:
   ```bash
   cd frontend && npm install
   cd ../worker && npm install
   ```
2. Build the frontend bundle that the Worker will host:
   ```bash
   cd frontend
   npm run build
   ```
3. Serve everything from the Worker in local mode:
   ```bash
   cd ../worker
   npm run dev
   ```
   Wrangler exposes the app at `http://localhost:8787`, proxying `/api/*` requests.

## Core API Routes
- `GET /api/health` – simple liveness check.
- `GET /api/mrt/taipei/stations` – MRT line + station metadata pulled from `data/metro_taipei_stations_zh.json`.
- `GET /api/mrt/taipei/station-locations` – station coordinates map.
- `GET /api/mrt/taipei/eta?stationId=<id>` – upstream ETA proxy, normalized with `etaSeconds`, `arriveAt`, and human-readable labels.

The upstream base URL is defined in `worker/wrangler.toml` as `TAIPEI_ETA_BASE`. Override it through Wrangler environment variables or secrets in production.

## Development Workflow
- Frontend:
  - `npm run dev` – Vite dev server with hot module reload.
  - `npm run build` – generates `frontend/dist/` for Worker assets.
  - `npm run preview` – serves the production build for local smoke checks.
- Worker:
  - `npm run dev` – local Worker with static assets from `frontend/dist`.
  - `npm run deploy` – publishes to Cloudflare (requires authenticated Wrangler session).

Rebuild the frontend after dataset or UI changes so the Worker serves fresh assets.

## Data Maintenance
- Keep JSON schema stable; downstream code expects station objects with `id`, `codes`, and `name_zh`.
- Validate new datasets before commit (linting, manual inspection). Large diffs should mention provenance in the PR description.
- Treat APK-derived assets as read-only IP—do not redistribute outside the repo.

## Testing
- Frontend smoke tests live in `frontend/tests/`. Run them with `npx playwright test` (after installing Playwright browsers).
- Add Worker-level Vitest/Miniflare checks when modifying HTTP handlers or normalization logic.
- Aim for deterministic, fast tests; avoid hitting live upstream services during CI.

## Deployment Notes
- `wrangler.toml` already binds static assets (`__STATIC_CONTENT`) and sets `compatibility_date`.
- Before running `npm run deploy`, ensure the Cloudflare project exists and the following secrets are configured:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN` (needs Workers Scripts read/write scopes)
- GitHub Actions can reuse the same commands; wire them up once secrets are present.

## Collaboration Guidelines
- Follow the working agreements in `AGENTS.md` for branching, commit style, and review expectations.
- Use Conventional Commits with scope prefixes (`feat(frontend): …`, `fix(worker): …`).
- Record follow-up ideas as issues or TODO comments so future agents can pick them up quickly.
