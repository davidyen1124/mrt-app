# Repository Guidelines

## Project Structure & Module Organization
- `frontend/` – Vite + React + Tailwind UI (mobile‑first).
  - `src/ui/` components (e.g., `App.tsx`, `styles.css`).
- `worker/` – Cloudflare Worker serving API and static assets.
  - `src/index.ts` entry; `wrangler.toml` config (serves `../frontend/dist`).
- `data/` – extracted datasets (e.g., `metro_taipei_stations_zh.json`).
- `README.md` – quick start; `AGENTS.md` – this guide.

## Build, Test, and Development Commands
- Frontend
  - `cd frontend && npm i && npm run dev` – local dev server.
  - `cd frontend && npm run build` – build to `frontend/dist`.
- Worker
  - `cd worker && npm i && npx wrangler dev` – local Worker (serves API + SPA).
  - `cd worker && npx wrangler deploy` – deploy to Cloudflare.
- Health checks
  - `curl $URL/api/health` – confirms Worker is up.

## Coding Style & Naming Conventions
- TypeScript, ES modules, 2‑space indentation.
- React function components; file names:
  - Components: `PascalCase` (e.g., `App.tsx`).
  - Utilities/hooks: `camelCase.ts`.
- Tailwind for styling; prefer utility classes in JSX over custom CSS.
- Keep modules small and colocate UI, hooks, and types per feature in `src/ui/feature/*` when it grows.

## Testing Guidelines
- No test suite yet. If adding tests:
  - Frontend: Vitest + React Testing Library (`frontend/src/__tests__/*.test.tsx`).
  - Worker: Vitest or Miniflare (`worker/test/*.test.ts`).
  - Keep tests fast and deterministic; add basic API and rendering smoke tests.

## Commit & Pull Request Guidelines
- Use Conventional Commits where possible:
  - `feat(frontend): …`, `fix(worker): …`, `chore(data): …`.
- PRs should include:
  - Summary of change, scope (frontend/worker/data), before/after screenshots for UI, and any deployment steps.
  - Link related issues; keep PRs small and focused.

## Security & Configuration Tips
- Do not commit secrets. Configure env in `wrangler.toml` (e.g., `TAIPEI_ETA_BASE`).
- Static assets are served from `frontend/dist`; dataset JSONs are bundled via static import in the Worker—update `data/` then redeploy.
