# Agent Operating Guide

## Mission
A premium, mobile-first web app for the Taipei Metro: live arrivals, car crowding, first/last trains, fares and
station facilities on one map. Keep datasets accurate, the Cloudflare Worker lean, and the UI pixel-tight on phones
and desktops, in light and dark mode, in Chinese and English.

## Layout
- `frontend/` – Vite + React 19 + Tailwind v4 + MapLibre. `src/data/network.ts` wraps the bundled snapshot;
  `src/components/station/*` is the station sheet; `src/index.css` holds the design tokens.
- `worker/` – Cloudflare Worker. `src/index.ts` routes `/api/*`; static files and SPA routes are served by the
  assets binding (`wrangler.toml`).
- `data/` – generated snapshots (see `data/README.md`).
- `scripts/` – data refresh scripts (`refresh-stations.mjs`, `refresh-geometry.mjs`).

## Daily Workflow
1. `npm ci` in `frontend/` and `worker/`.
2. `npm run build` in `frontend/`, then `npm run dev` in `worker/` (http://localhost:8787, API + SPA).
   For hot reload, also run `npm run dev` in `frontend/` (http://localhost:5173, proxies `/api` to 8787).
3. Capture open questions as TODOs or GitHub issues—never leave ambiguous code comments.

## Coding Standards
- TypeScript + ES modules everywhere; prefer small, focused files.
- React components in `PascalCase`, hooks/utilities in `camelCase`. Colocate component-specific types.
- Tailwind classes in JSX; colours, radii and shadows come from the tokens in `src/index.css` (`bg-surface`,
  `text-ink-2`, `bg-board`, …). Line colours come from data, never hard-coded in components.
- Every user-facing string goes through `src/lib/i18n.ts` (zh + en).
- Worker handlers stay pure: parse the request, call helpers, return a response.

## Testing
- Worker: `npm test` (Vitest) and `npm run typecheck` in `worker/`. Add coverage when arrivals normalisation,
  fares or routing change. Tests are deterministic—no live upstream calls.
- Frontend: `npm run typecheck`, then `npm run test:e2e` (Playwright smoke tests in `frontend/tests/`, using the
  local Chrome; they start the Worker if it is not running and mock live endpoints).
- UI changes: `npm run screenshots -- <baseUrl> <outDir>` renders every key screen for review.

## Data & API Care
- Regenerate data with the scripts; document the source and date of refreshes in the PR.
- `TAIPEI_ETA_BASE` (see `worker/wrangler.toml`) is the single override knob for upstream arrivals.
- Car-load data needs `TAIPEI_CAR_WEIGHT_USERNAME` / `TAIPEI_CAR_WEIGHT_PASSWORD` Worker secrets.

## Security & Collaboration
- Never commit secrets, Wrangler state, Playwright artifacts, or `node_modules`.
- Use Conventional Commits with scope prefixes (`feat(frontend): …`, `chore(data): …`).
- Attach screenshots for UI-facing changes.
- Treat APK-derived assets as read-only IP; keep redistribution inside this repository only.
