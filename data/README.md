# Data

Snapshots bundled into both the Worker and the frontend at build time. Regenerate them with the scripts in
[`scripts/`](../scripts) — never edit the generated files by hand.

| File | What | Source | Refresh |
| --- | --- | --- | --- |
| `taipei_network.json` | 8 lines (incl. the Xinbeitou and Xiaobitan branches) and 119 physical stations: codes, zh/en names, WGS84 coordinates, weekday first/last trains, restrooms, information desks, lockers, bicycle rules | [`apis.bus-plus.tw/v2/mrt/taipei/stations`](https://apis.bus-plus.tw/v2/mrt/taipei/stations) + `station_overrides.json` | `node scripts/refresh-stations.mjs` |
| `taipei_fares.json` | Travel time, adult fare and concession fare between every pair of stations (`minutes,fare,concession`, one row per origin) | same feed | same script |
| `taipei_lines.geo.json` | Track geometry per line, simplified to ~4 m | OpenStreetMap route relations via Overpass — © OpenStreetMap contributors, ODbL 1.0 | `node scripts/refresh-geometry.mjs` |
| `station_overrides.json` | Open stations the Bus+ feed has not picked up yet (currently **R01 廣慈/奉天宮**, opened 2026-08-30) | News coverage, OSM node 4498833449, and the timetable/fare tables bundled in the Bus+ Android app 3.7.0 | Hand-maintained; the refresh script drops an entry once the feed includes it |

## Notes

- The Bus+ feed has one record per line platform (BL12 and R10 for Taipei Main). The refresh script merges them into
  physical stations by name, so 板橋 (BL07 + Y16) is a single station even though the feed lists it twice.
- A station's `id` is its first code in line order (BR, R, G, O, BL, Y). Every code resolves to it, so
  `/station/BL12` and `/station/R10` open the same page.
- `.github/workflows/refresh-data.yml` runs the station refresh weekly and redeploys when anything changed. The
  script only rewrites files when the data itself differs.
- The Sanying line (LB, opened 2026-06-30) is not included: no public feed exposes its stations or arrivals yet.
- APK-derived values stay in this repository; see `AGENTS.md`.
