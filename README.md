Taipei MRT (Bus+ APK) — Web Rebuild

What’s here

- data/metro_taipei_stations_zh.json — extracted Taipei MRT stations (per line) with station IDs and Chinese names, parsed from the decompiled APK’s `TaipeiMetroView.smali`.
- frontend/ — Vite + React + Tailwind, mobile‑first UI (search + bottom sheet + ETA fetch).
- worker/ — Cloudflare Worker that serves both API and the built frontend. It exposes:
  - GET /api/mrt/taipei/stations — the extracted dataset
  - GET /api/mrt/taipei/eta?stationId=R10 — proxies to the Bus+ upstream

Dev quickstart

- Build the frontend: in `frontend/`, run `npm i` then `npm run build` (or `pnpm`/`yarn`).
- Deploy or run the Worker: in `worker/`, run `npm i`, then `npm run dev` for local dev, or `npm run deploy` (requires Wrangler auth). The Worker serves `/` from `frontend/dist` and `/api/*` from Worker code.

Notes

- English station names will be wired up next; the Chinese dataset is authoritative for now.
- You can switch the ETA upstream in `worker/wrangler.toml` via the `TAIPEI_ETA_BASE` var later (e.g. TDX/TRTC).

