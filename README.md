# Taipei MRT ETA Rebuild

This repository rebuilds key pieces of the Bus+ Android APK as a web-friendly stack. The goal is to surface Taipei MRT station data and ETA lookups through a Cloudflare Worker API and a lightweight Vite + React frontend.

## Repository Layout
- `frontend/` – mobile-first React UI, built with Vite and Tailwind.
- `worker/` – Cloudflare Worker that proxies ETA data and serves the built SPA.
- `data/` – extracted station datasets sourced from the original APK.
- `.gitignore`, `AGENTS.md`, `README.md` – repo defaults and working agreements.

## Prerequisites
- Node.js 18+ and npm (or pnpm/yarn if you prefer).
- Wrangler CLI authenticated with the target Cloudflare account (`npm i -g wrangler`).
- GitHub CLI (`gh`) if you plan to manage the remote repository from the command line.

## Getting Started
1. Install dependencies for both projects:
   ```bash
   cd frontend && npm install
   cd ../worker && npm install
   ```
2. Build the frontend bundle that the Worker will serve:
   ```bash
   cd frontend
   npm run build
   ```
3. Launch the Worker locally (serves both API + SPA):
   ```bash
   cd worker
   npm run dev
   ```

Visit <http://localhost:8787> while the Worker is running. It will proxy `/api/mrt/taipei/eta?stationId=<ID>` to the Bus+ upstream defined in `worker/wrangler.toml` and serve the SPA for other routes.

## Development Workflow
### Frontend (`frontend/`)
- `npm run dev` – start Vite in development mode (hot reload).
- `npm run build` – produce static assets in `frontend/dist/` for deployment.
- `npm run preview` – serve the production build locally via Vite.

### Worker (`worker/`)
- `npm run dev` – run the Worker with Wrangler in local mode.
- `npm run deploy` – publish to Cloudflare (requires authenticated Wrangler session).

Environment variables such as `TAIPEI_ETA_BASE` are configured in `worker/wrangler.toml`. Do not commit secrets; use Wrangler secrets for sensitive values.

## Data Maintenance
- `data/metro_taipei_stations_zh.json` is currently the authoritative dataset for MRT station metadata (Chinese names).
- When datasets change, double-check JSON structure and field names before deploying updates.

When datasets change, rebuild the frontend so the Worker serves the latest static bundle.

## Testing
Playwright is available in the frontend for smoke tests stored in `frontend/tests/`. Trigger them with:
```bash
cd frontend
npx playwright test
```
Add more targeted tests as the UI and API expand. Keep tests deterministic and fast.

## Conventions
- Follow the coding style and branching guidance in `AGENTS.md`.
- Use Conventional Commits where possible (`feat(frontend): add search modal`, etc.).
- Avoid committing `node_modules`, local `.env` files, or Wrangler state—`.gitignore` is configured accordingly.

## CI/CD
- GitHub Actions workflow `Deploy to Cloudflare` builds the frontend and runs `npm run deploy` in `worker/` for pushes to `main` or manual triggers.
- Add the following repository secrets before enabling deployments:
  - `CLOUDFLARE_ACCOUNT_ID` – Cloudflare account identifier (available in the Workers dashboard).
  - `CLOUDFLARE_API_TOKEN` – API token with at least the *Account.Workers Scripts:Edit* and *Account.Workers Scripts:Read* permissions.
- Optional: scope the token to the specific account and restrict IPs if your Cloudflare plan allows.

Questions or future work items? Capture them in the issue tracker of the GitHub remote (`davidyen1124/bus-app-repo`) or inline TODO comments in the relevant modules.
