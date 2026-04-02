# HotTyre Sense — Project Progress & Status

**Last Updated**: 2026-04-02  
**Sprint**: v3.0 — HotTyre Sense Rebrand (Temperature-Only Fleet Monitoring)  
**Server**: `australia.tyresense.com` (Azure, 23.101.230.162)

---

## Milestone Tracker

| # | Milestone | Status | Date |
|---|-----------|--------|------|
| 1 | Initial dashboard scaffold (HTML/CSS/JS) | ✅ Done | 2026-03-24 |
| 2 | Node.js proxy server with HTTPS→HTTP fallback | ✅ Done | 2026-03-24 |
| 3 | API connectivity debugging (TLS/SSL investigation) | ✅ Done | 2026-03-24 |
| 4 | Correct server discovery (`australia.tyresense.com`) | ✅ Done | 2026-03-25 |
| 5 | Live API data verified — 115 vehicles, 95 haul trucks | ✅ Done | 2026-03-25 |
| 6 | Individual vehicle drill-down with charts | ✅ Done | 2026-03-25 |
| 7 | PRD document created | ✅ Done | 2026-03-25 |
| 8 | Fleet Overview — production-style table (P/T/C rows) | ✅ Done | 2026-03-25 |
| 9 | Realtime auto-refresh (60s cycle) | ✅ Done | 2026-03-25 |
| 10 | Design learned from production UI (australia.tyresense.com/royhill) | ✅ Done | 2026-03-25 |
| 11 | Active alerts table in fleet view | ✅ Done | 2026-03-25 |
| 12 | Drill-down from fleet → vehicle detail | ✅ Done | 2026-03-25 |
| 13 | Separate wheel data API fetches to get temperatures correctly | ✅ Done | 2026-03-25 |
| 14 | Leaflet map integration with color-coded full-ID markers | ✅ Done | 2026-03-26 |
| 15 | Vehicle detail fixed to fetch all wheel value types correctly | ✅ Done | 2026-03-26 |
| 16 | Sidebar simplified for live-only operation | ✅ Done | 2026-03-26 |
| 17 | Reconnect refresh now opens Fleet Overview after live data loads | ✅ Done | 2026-03-26 |
| 18 | Proxy fallback race fixed to prevent local server crashes | ✅ Done | 2026-03-26 |
| 19 | Reconnect now transitions visibly into Fleet Overview during refresh | ✅ Done | 2026-03-26 |
| 20 | Fleet map GPS load synchronised with fleet refresh | ✅ Done | 2026-03-26 |
| 21 | Proxy keep-alive enabled for heavy fleet refresh traffic | ✅ Done | 2026-03-26 |
| 22 | TyreSense timezone-less timestamps normalised to UTC for correct age display | ✅ Done | 2026-03-26 |
| 23 | **HotTyre Sense rebrand** — UI renamed, welcome page updated, pressure/cold/alerts removed | ✅ Done | 2026-03-26 |
| 24 | Temperature-only data fetch — reduced from 6 value types to 1 (Temperature) | ✅ Done | 2026-03-26 |
| 25 | Lookback reduced from 24h to 1h to cut API data volume | ✅ Done | 2026-03-26 |
| 26 | Temperature thresholds: >=80°C amber highlight, >=85°C flashing red | ✅ Done | 2026-03-26 |
| 27 | Auto-open Fleet Overview on first connect (not just reconnect) | ✅ Done | 2026-03-26 |
| 28 | API batch size fix: 1 vehicle per request (API drops multi-vehicle data silently) | ✅ Done | 2026-03-26 |
| 29 | Fleet data: 71 trucks with data (up from 10 with old batch-of-10 approach) | ✅ Done | 2026-03-26 |
| 30 | Age display fixed: use vehicle `lastContact` instead of wheeldata `start` time | ✅ Done | 2026-03-26 |
| 31 | Smart refresh: only query online trucks, 3-min full cycle, 1-min hot-truck cycle | ✅ Done | 2026-03-26 |
| 32 | API audit vs Swagger spec: documented bugs, rate limit strategy, unused endpoints | ✅ Done | 2026-03-26 |
| 33 | Temperature sort fix: sort by actual max °C descending (was bucket-then-name) | ✅ Done | 2026-03-26 |
| 34 | Trend arrows (↑↓→) in fleet grid — ±0.5°C threshold, compares across refresh cycles | ✅ Done | 2026-03-26 |
| 35 | Map z-order: hot/overheating truck markers render on top of OK/offline markers | ✅ Done | 2026-03-26 |
| 36 | Fleet lookback reduced from 1h to 30min — halves bandwidth, same truck count (72) | ✅ Done | 2026-03-26 |
| 37 | Drill-down cache: revisiting a truck loads instantly from cache, Fetch Data refreshes | ✅ Done | 2026-03-26 |
| 38 | Localhost startup now auto-loads `.env.local`, matching Vercel token behaviour | ✅ Done | 2026-04-02 |
| 39 | Multi-vehicle wheeldata batching restored after upstream API fix | ✅ Done | 2026-04-02 |

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Vanilla JS (no framework) | Minimal dependencies, fast load, easy to deploy |
| Node.js proxy server | CORS bypass, HTTPS handling, static file serving |
| Chart.js for visualisation | Lightweight, no build step, time-series support |
| Batch API calls (up to 50 trucks/request) | Upstream multi-vehicle wheeldata support is fixed again; batched IDs reduce request volume while keeping request URLs manageable |
| 3-min full refresh + 1-min hot refresh | Trade freshness for staying under 4000 req/hr; hot trucks get priority monitoring |
| Drill-down cache per vehicleId | Revisiting a truck loads instantly from in-memory cache; Fetch Data always refreshes |
| Trend arrow ±0.5°C threshold | Sensitive enough to catch real changes; compares current vs previous refresh cycle |
| Fleet 30-min lookback window | Sensors report every 15–30 min; 30 min catches latest reading while halving data vs 1h |
| Map z-order by status | Critical markers (zIndexOffset 300) always visible on top of OK/offline markers |
| Online-only truck filtering | Skip trucks with no `lastContact` in past 1h — saves ~10 unnecessary API requests per cycle |
| Temperature-only monitoring | Reduces API volume from ~5,700 MB/hr to ~660 MB/hr (under 1000 MB limit) |
| 1-hour lookback window | Minimise data re-fetch; sensors update every ~15-30 min so 1h captures latest |
| Reconnect opens fleet after refresh | Prioritise the production-like fleet workflow over manual navigation |
| Live-only sidebar actions | Reduce operator confusion and remove non-production entry points |
| Fleet table and map refresh together | Prevent the map from lagging behind the table and looking empty during a completed refresh |
| Keep-alive upstream proxying | Reduce handshake churn and stabilise multi-request fleet refreshes |
| Treat timezone-less TyreSense timestamps as UTC | Prevent false 8-hour staleness in AWST and align age with production |
| Auto-load `.env.local` in local Node server | Make localhost consume the same token file consistently without manual shell env setup |

## API Connectivity Log

| Date | Event |
|------|-------|
| 2026-03-24 | `app.tyresense.com` — TLS handshake fails (alert 80). SSL cert broken server-side. |
| 2026-03-24 | Verified with Node.js, Python, .NET, Chrome, SwaggerHub — all fail. |
| 2026-03-24 | Discovered per-customer subdomain architecture (bhpio, bma, fmg). |
| 2026-03-25 | `royhill.tyresense.com` → ENOTFOUND. `hio.tyresense.com` → ENOTFOUND. |
| 2026-03-25 | `australia.tyresense.com` → 23.101.230.162 (Azure). **SSL works. API responds.** |
| 2026-03-25 | Confirmed: clientId=26 (Hancock Iron Ore), areaId=32 (Roy Hill Mine), 95 haul trucks. |
| 2026-04-02 | Reverified `/da/wheeldata` with multi-vehicle IDs; fleet fetch path switched back from single-vehicle requests to batched requests. |
| 2026-04-02 | Localhost-only connection failure traced to missing `.env.local` loading in `server.js`; fixed and verified against `/api/da/areas`. |

## Live Fleet Data Summary

- **Client**: Hancock Iron Ore (clientId: 26)
- **Area**: Roy Hill Mine (areaId: 32), timezone: australia/perth (AWST, UTC+8)
- **Haul trucks**: 95 units (Cat 793F, Hitachi EH4000, EH5000)
- **Loaders**: 7 units (Cat 994H, Cat 994K)
- **Water carts**: 6 units
- **Total tyres monitored**: ~690
- **Active trucks** (last 1h): ~71 trucks reporting temperature data
- **Update frequency**: ~15-30 min intervals per sensor

## Known Issues

| Issue | Severity | Status |
|-------|----------|--------|
| `app.tyresense.com` SSL broken | N/A | Bypassed — using `australia.tyresense.com` |
| Temperature data sparse on some trucks | Low | API returns only value types with data |
| Alert status data sparse | Low | Not all trucks have alert threshold config |
| VPN blocks API connection | Info | Documented — do not use VPN |
| Proxy fallback could write headers twice under retry load | High | Fixed 2026-03-26 |
| Historical upstream multi-vehicle wheeldata bug | Info | Resolved upstream on 2026-04-02; fleet fetch now batches multiple vehicle IDs per request |
| API rate limit 4000 requests/hour | High | Fixed — smart refresh: 3-min cycle, online-only trucks, 1-min hot-truck cycle (~3,400 req/hr) |
| API timestamps omit timezone information | Medium | Fixed in app parsing on 2026-03-26 |
| Age display uses wheeldata start (too old) | Medium | Fixed — now uses vehicle `lastContact` (controller heartbeat) |
| Localhost did not read `.env.local` | Medium | Fixed in `server.js` on 2026-04-02 |
| `rejectUnauthorized: false` in proxy | Low (dev) | Acceptable for demo; document for production hardening |

## File Inventory

| File | Purpose | Lines |
|------|---------|-------|
| `index.html` | Dashboard HTML — sidebar, fleet view, vehicle drill-down | ~225 |
| `style.css` | Dark theme styling, fleet grid, cards | ~920 |
| `app.js` | Application logic — API calls, rendering, charts | ~850 |
| `server.js` | Node.js proxy + static server + diagnostics | ~255 |
| `README.md` | Setup & deployment guide | ~55 |
| `docs/PRD.md` | Product Requirements Document | — |
| `docs/PROGRESS.md` | This file | — |

## Latest UX Changes

- Removed sidebar actions for sample-data preview and manual diagnostics
- Fleet Overview button now appears disabled until the first successful live connection
- Reconnect now switches into Fleet Overview with visible refresh/loading feedback and restores live controls when the refresh completes
- Development/testing banner added below the TyreSense title for local and test environments
- Fleet map markers are now populated from the same refresh cycle as the fleet table instead of lagging behind on a later async step
- Fleet grid shows trend arrows (↑↓→) next to each temperature reading (±0.5°C threshold) — compares current vs previous refresh cycle
- Clicking a previously viewed truck loads instantly from drill-down cache (toast: "click Fetch Data to refresh")
- Map markers for hot/overheating trucks render on top of other markers
- Fleet lookback reduced from 1h to 30min — halves API data volume while maintaining 72 trucks with data
- Fleet age and last-contact values now match live TyreSense freshness because timezone-less API timestamps are normalised correctly
- **v3.0 HotTyre Sense**: Rebranded from TyreSense to HotTyre Sense — temperature-focused fleet monitoring
- Removed Pressure, Cold Pressure, and Alert Status from fleet grid, charts, and wheel visual
- Welcome page simplified: describes app as a demo to explore TyreSense API for HotTyre management
- Temperature thresholds: >=80°C amber highlight, >=85°C flashing red animation
- Fleet summary labels changed: Warning→Hot, Critical→Overheating
- Connect to API now auto-opens Fleet Overview immediately
- Age column now shows vehicle `lastContact` (controller heartbeat) instead of wheeldata `start` time — matches official TyreSense app
- Smart two-tier auto-refresh: 3-minute full cycle for all online trucks, 1-minute fast cycle for hot trucks (≥80°C)
- Countdown timer shows 🔥 when hot trucks exist and a fast refresh is coming
- Only online trucks (lastContact within 1h) are queried — offline trucks skipped to save API quota
- Batch size changed from 10 to 1 per API call — fixed silent data loss affecting 61 trucks
- Localhost now uses `.env.local` automatically, so Connect to API succeeds without manually exporting the token in the shell
- LR* vehicles now render with the loader icon in the vehicle list and detail panel
- Fleet wheeldata refreshes now batch multiple vehicle IDs per request instead of issuing one request per truck
