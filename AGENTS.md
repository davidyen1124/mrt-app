# Agent Operating Guide

## Mission & Context
This workspace reproduces portions of the Bus+ APK as a Cloudflare Worker + Vite/React application. Keep the developer experience sharp, avoid reintroducing mobile-specific artifacts, and ensure datasets stay trustworthy. The repository root is `/home/pi/bus/repo_root`.

## Project Map
- `frontend/` – mobile-first React SPA using Tailwind classes. Treat `src/ui/` as the main composition area.
- `worker/` – serves the SPA and proxies API calls. Wrangler config in `wrangler.toml`.
- `data/` – JSON datasets sourced from the APK. Regenerate via `scripts/`.
- `scripts/` – node utilities for dataset validation.
- `bus_xapk/`, `bus.xapk`, `apktool`, `apktool.jar` – reference extraction assets; leave untouched unless a new APK drop is being reverse engineered.

## Workflow Expectations
1. Install dependencies per package (`frontend`, `worker`) before running builds or tests.
2. Build the frontend (`npm run build`) prior to deploying/previewing via the Worker.
3. Prefer editing within feature-focused modules; keep files small and colocated.
4. Never commit `node_modules`, local `.env` files, Wrangler state, or Playwright artifacts—`.gitignore` is configured, but stay vigilant.

## Coding Standards
- TypeScript + ES modules everywhere; 2-space indentation.
- React: function components, hooks, and colocated types. Components in `PascalCase`, hooks/utilities in `camelCase`.
- Tailwind utility classes in JSX where possible; use `styles.css` only for cross-cutting tokens.
- Use descriptive names for Cloudflare Worker handlers; keep route handlers pure and isolated.

## Testing
- Frontend: Playwright smoke tests live in `frontend/tests/`. Run with `npx playwright test`.
- Worker: add Vitest/Miniflare coverage in `worker/` when HTTP behaviour needs assertions.
- Keep tests deterministic and fast; update datasets before relying on them in assertions.

## Git & Collaboration
- Branch from `main`; use Conventional Commits (`feat(frontend): add station search`).
- Reference scope (frontend/worker/data/scripts) in PR summaries. Include screenshots for UI-facing changes.
- Run relevant checks (builds, validation scripts, smoke tests) before pushing.
- Document future tasks in issues or TODO comments rather than leaving ambiguous code.

## Security & Config
- Secrets belong in Wrangler KV/secrets, not in source. `TAIPEI_ETA_BASE` is the current override knob.
- When switching upstream APIs, update both the Worker env and any dependent documentation.
- Treat extracted APK assets as read-only IP; do not re-distribute outside the repo without clearance.
- GitHub Actions deployment uses `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` repository secrets; ensure they exist (token needs Workers Scripts read/write).
