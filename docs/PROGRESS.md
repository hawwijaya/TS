# TyreSense Dashboard — Project Progress & Status

**Last Updated**: 2026-03-26  
**Sprint**: v2.2 — Fleet Refresh Visibility And Map Sync  
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

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Vanilla JS (no framework) | Minimal dependencies, fast load, easy to deploy |
| Node.js proxy server | CORS bypass, HTTPS handling, static file serving |
| Chart.js for visualisation | Lightweight, no build step, time-series support |
| Batch API calls (10 trucks/request) | Avoid URL length limits, parallel for speed |
| 60-second refresh | Balance between freshness and API load (sensors update every ~15-30 min) |
| Reconnect opens fleet after refresh | Prioritise the production-like fleet workflow over manual navigation |
| Live-only sidebar actions | Reduce operator confusion and remove non-production entry points |
| Fleet table and map refresh together | Prevent the map from lagging behind the table and looking empty during a completed refresh |
| Keep-alive upstream proxying | Reduce handshake churn and stabilise multi-request fleet refreshes |

## API Connectivity Log

| Date | Event |
|------|-------|
| 2026-03-24 | `app.tyresense.com` — TLS handshake fails (alert 80). SSL cert broken server-side. |
| 2026-03-24 | Verified with Node.js, Python, .NET, Chrome, SwaggerHub — all fail. |
| 2026-03-24 | Discovered per-customer subdomain architecture (bhpio, bma, fmg). |
| 2026-03-25 | `royhill.tyresense.com` → ENOTFOUND. `hio.tyresense.com` → ENOTFOUND. |
| 2026-03-25 | `australia.tyresense.com` → 23.101.230.162 (Azure). **SSL works. API responds.** |
| 2026-03-25 | Confirmed: clientId=26 (Hancock Iron Ore), areaId=32 (Roy Hill Mine), 95 haul trucks. |

## Live Fleet Data Summary

- **Client**: Hancock Iron Ore (clientId: 26)
- **Area**: Roy Hill Mine (areaId: 32), timezone: australia/perth (AWST, UTC+8)
- **Haul trucks**: 95 units (Cat 793F, Hitachi EH4000, EH5000)
- **Loaders**: 7 units (Cat 994H, Cat 994K)
- **Water carts**: 6 units
- **Total tyres monitored**: ~690
- **Active trucks** (last 24h): ~85+ trucks reporting data
- **Update frequency**: ~15-30 min intervals per sensor

## Known Issues

| Issue | Severity | Status |
|-------|----------|--------|
| `app.tyresense.com` SSL broken | N/A | Bypassed — using `australia.tyresense.com` |
| Temperature data sparse on some trucks | Low | API returns only value types with data |
| Alert status data sparse | Low | Not all trucks have alert threshold config |
| VPN blocks API connection | Info | Documented — do not use VPN |
| Proxy fallback could write headers twice under retry load | High | Fixed 2026-03-26 |
| Fleet refresh still takes noticeable time for a full 95-truck live load | Medium | Improved 2026-03-26; still bounded by upstream API volume |

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
