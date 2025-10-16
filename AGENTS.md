# Agent Operating Guide

## Mission
Rebuild the Bus+ Taipei MRT experience for the web. Preserve accurate datasets, keep the Cloudflare Worker lean, and ensure the React UI feels responsive on mobile and desktop.

## Daily Workflow
1. Install dependencies for both packages before coding (`frontend`, `worker`).
2. Build the frontend (`npm run build`) whenever assets or data change so the Worker serves fresh files.
3. Run the Worker locally with `npm run dev` in `worker/` to exercise API routes and the bundled SPA.
4. Capture open questions as TODOs or GitHub issues—never leave ambiguous code comments.

## Coding Standards
- TypeScript + ES modules everywhere; prefer small, focused files.
- React components in `PascalCase`, hooks/utilities in `camelCase`. Colocate component-specific types with their implementation.
- Tailwind classes in JSX are the default; reserve `styles.css` for shared tokens and resets.
- Worker handlers stay pure: parse the request, call helpers, return a response. Avoid side effects outside the fetch lifecycle.

## Testing
- Frontend smoke checks live in `frontend/tests/`. Run with `npx playwright test` after `npx playwright install`.
- Add Vitest/Miniflare coverage in `worker/` when API logic changes (ETA normalization, dataset wiring, routing).
- Keep tests deterministic; avoid reaching out to live upstreams in automated runs.

## Data & API Care
- `data/taipei_stations_combined.json` is bundled at build time. Validate schema and provenance before committing updates.
- Document dataset refreshes in PR descriptions and verify the frontend search flow after changes.
- `TAIPEI_ETA_BASE` (see `worker/wrangler.toml`) is the single override knob for upstream ETAs. Update the Worker env and related docs together.

## Security & Collaboration
- Never commit secrets, Wrangler state, Playwright artifacts, or `node_modules`.
- Use Conventional Commits with scope prefixes (`feat(frontend): …`, `chore(data): …`).
- Branch from `main`, rebase frequently, and attach screenshots or recordings for UI-facing pull requests.
- Treat APK-derived assets as read-only IP; keep redistribution inside this repository only.
