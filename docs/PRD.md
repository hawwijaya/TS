# HotTyre Sense — Product Requirements Document

**Product**: HotTyre Sense (Temperature-Focused Fleet Monitoring)  
**Version**: 3.1  
**Date**: 2026-03-26  
**Author**: Product Owner / Senior Tech Lead  
**Client**: Hancock Iron Ore (Roy Hill Mine)

---

## 1. Executive Summary

A real-time web dashboard for monitoring tyre **temperature** across Roy Hill Mine's haul truck fleet. Connects to the TyreSense Datastore API (`australia.tyresense.com`) to display live temperature data for all 95 haul trucks simultaneously — enabling mine operations to detect overheating tyres before they cause downtime or safety incidents. Rebranded from "TyreSense Dashboard" to "HotTyre Sense" in v3.0.

## 2. Problem Statement

Roy Hill's fleet of 95 haul trucks (Cat 793F, Hitachi EH4000, EH5000) operates 24/7 in extreme Pilbara conditions. Each truck has 6 monitored tyre positions. Manual tyre inspection is time-consuming and reactive. The TyreSense TPMS sensors transmit real-time data, but there is no single-page overview showing all trucks at a glance with criticality status.

## 3. Target Users

| Role | Need |
|------|------|
| Mine Dispatch / Control Room | At-a-glance fleet tyre health; spot critical trucks immediately |
| Tyre Maintenance Crew | Prioritise which trucks need attention |
| Mine Operations Manager | Historical trends, fleet-wide health metrics |

## 4. API Foundation — TyreSense Datastore v1.0.0

**Base URL**: `https://{subdomain}.tyresense.com/`  
**Auth**: Bearer JWT token (clientId=26, Hancock Iron Ore)  
**Vendor**: RIMEX Supply Ltd (info@rimex.com)

### 4.1 Core Endpoints

| Endpoint | Purpose | Key Params |
|----------|---------|------------|
| `GET /da/clients` | List clients | — |
| `GET /da/areas` | List mine areas | `clientId` (optional) |
| `GET /da/vehicles/area/{areaId}` | List vehicles in area | — |
| `GET /da/wheeldata/{vehicleIds}` | Tyre sensor data | `startTime`, `endTime`, `wheelValues[]` |
| `GET /da/vehicledata/{vehicleIds}` | Vehicle telemetry | `startTime`, `endTime`, `vehicleValues[]` |
| `GET /da/assets/get/area/{areaId}` | Asset details | — |
| `GET /da/assets/models/area/{areaId}` | Asset models | — |
| `GET /da/assets/locations` | Asset locations | — |
| `GET /da/assets/metadata/{assetIds}` | Asset metadata | — |

### 4.2 Wheel Value Types

| Value | Description | Unit |
|-------|-------------|------|
| `MinGaugePressure` | Minimum gauge pressure reading | PSI |
| `MaxGaugePressure` | Maximum gauge pressure reading | PSI |
| `Temperature` | Tyre temperature | °C |
| `ColdPressure` | Cold inflation pressure | PSI |
| `MaxPressureAlertStatus` | Over-pressure alert level | None/Level1/Level2 |
| `MinPressureAlertStatus` | Under-pressure alert level | None/Level1/Level2 |
| `MaxTemperatureAlertStatus` | Over-temperature alert level | None/Level1/Level2 |
| `SensorId` | Sensor serial number | — |
| `SensorVoltage` | Sensor battery voltage | V |
| `SensorLowBattery` | Low battery flag | true/false |

### 4.3 Vehicle Value Types

`Connected`, `GpsPosition`, `Power`, `Ignition`

### 4.4 Data Characteristics (Observed)

- **Update interval**: ~15-30 minutes per sensor
- **Data returned**: Only value types with actual data are included
- **Vehicle IDs**: Comma-separated list supported in path (but see Known API Bugs below)
- **Time format**: ISO 8601 without timezone (server is UTC)
- **Area timezone**: `australia/perth` (AWST, UTC+8)

### 4.5 API Audit — Swagger Spec vs Implementation (2026-03-26)

Full audit performed against [Swagger spec v1.0.0](https://app.swaggerhub.com/apis/tyresense/datastore/1.0.0).

#### Authentication

The spec supports two auth methods:
1. **BearerAuth** — `Authorization: Bearer <JWT>` header (used by our app — **preferred**, avoids token leaking in URLs/logs)
2. **AccessToken** — `?access_token=<JWT>` query parameter (not used — **correct decision**)

#### Known API Bugs (documented via testing)

| Bug | Impact | Workaround |
|-----|--------|------------|
| Multi-vehicle `wheeldata` returns only 1st vehicle's data | Data loss for 94 of 95 trucks when batched | `FLEET_BATCH_SIZE = 1` — individual requests per truck |
| `wheelValues` array param only honors 1st entry | Can't fetch Temperature + Pressure in one call | Separate request per value type (moot — we only use Temperature) |

#### Rate Limit

- **Limit**: 4,000 requests per hour (discovered via 503 responses)
- **Smart refresh strategy** (v3.1):
  - Vehicle list (1 lightweight request) determines total rows + online/offline status
  - Only **online trucks** (lastContact within 1h) are queried — offline trucks skipped
  - **Full refresh every 3 minutes**: vehicle list + online wheeldata + online GPS
  - **Hot truck fast refresh every 1 minute**: only trucks ≥80°C get re-queried (temp only, no GPS)
  - Estimated: ~3,400 requests/hour (under 4,000 limit)

#### Unused Endpoints — Potential Future Value

| Endpoint | What it provides | Potential use |
|----------|-----------------|---------------|
| `/da/assets/get/area/{areaId}?type=5` | Sensor assets with lifetime high-temp hours, error counts, battery health | Sensor health dashboard without polling wheeldata |
| `/da/assets/metadata/{assetIds}?keys=maximumTireTempratureAboveEqual90` | Historical sensor metadata | Track sensor degradation over time |
| `WheelValueType: SensorVoltage, SensorError, SensorLowBattery` | Sensor health data | Proactive maintenance alerts |
| `VehicleValueType: Power, Ignition` | Vehicle on/off state | Could skip powered-off trucks to further reduce requests |

#### Parameter Usage Audit

| Parameter | Spec | Our Usage | Status |
|-----------|------|-----------|--------|
| `wheelValues` | Array (multiple types per request) | Single value per request | Correct (API bug workaround) |
| `vehicleValues` | Array | `URLSearchParams.append()` for each | Correct |
| `positions` | Optional array (filter wheel positions) | Not used (fetches all 6) | OK — we display all positions |
| `startTime`/`endTime` | ISO 8601 date-time | `new Date().toISOString()` | Correct |
| `clientId` | Optional on `/da/areas` | Not sent (JWT implies client) | Correct |

## 5. Fleet Inventory (Roy Hill Mine, areaId=32)

| Type | Count | Models | Positions |
|------|-------|--------|-----------|
| Haul Truck | 95 | Cat 793F, Hitachi EH4000, Hitachi EH5000 | 6 tyres each |
| Loader | 7 | Cat 994H, Cat 994K | 4 tyres each |
| Water Cart | 6 | Various | 6 tyres each |
| **Total** | **115** | | **690 tyres monitored** |

## 6. Feature Requirements

### 6.1 Fleet Overview Page (P0 — Must Have)

**Goal**: Show all 95 haul trucks on one page with latest tyre health.

| Requirement | Detail |
|-------------|--------|
| All haul trucks visible | Single scrollable page, no pagination |
| Per-truck card | Truck name, model, 6 tyre positions |
| Per-position data | Latest pressure (PSI), temperature (°C) |
| Criticality indicator | Color-coded: Green (OK), Yellow (Level1), Red (Level2), Grey (No data) |
| Overall truck status | Worst alert across all positions determines card border color |
| Last contact time | Show when truck last reported data |
| Auto-refresh | Refresh all data every 60 seconds |
| Refresh indicator | Show countdown timer and last-refresh timestamp |
| Sort options | By name, by criticality (worst first), by last contact |

### 6.2 Individual Vehicle Drill-down (P1 — Existing)

- Time-series charts for pressure, temperature
- Alert table per position
- Vehicle telemetry (power, ignition, GPS, connected)
- Configurable date range

### 6.3 Settings & Diagnostics (P2 — Existing)

- Configurable API host + JWT token
- Connection diagnostics (DNS, TCP, TLS, HTTP)
- Demo/sample data mode (clearly labelled)

## 7. Technical Architecture

```
┌──────────────────┐     HTTPS     ┌──────────────────────┐
│  Browser (SPA)   │───────────────│  Node.js Proxy       │
│  HTML/CSS/JS     │  localhost    │  server.js :3001      │
│  Chart.js        │               │  ┌─────────────────┐ │
└──────────────────┘               │  │ /api/* → HTTPS   │ │ ──► australia.tyresense.com
                                   │  │ /api-check diag  │ │
                                   │  │ Static files     │ │
                                   │  └─────────────────┘ │
                                   └──────────────────────┘
```

### 7.1 Smart Refresh Strategy (v3.1)

The API's multi-vehicle endpoint is broken (returns only 1 vehicle's data), so we use individual requests:

- **Batch size**: 1 truck per request (workaround for API bug)
- **Parallel requests**: 3 concurrent (keeps below rate limit)
- **Time window**: Last 1 hour (rolling)
- **Value types**: Temperature only (HotTyre Sense focus)
- **Online filter**: Only trucks with `lastContact` within 1h are queried
- **Two-tier refresh**:
  - **Full cycle (180s)**: Vehicle list + online trucks wheeldata + GPS
  - **Hot cycle (60s)**: Only trucks ≥80°C get re-queried (temperature only)
- **Request budget**: ~3,400/hr out of 4,000/hr limit

## 8. Temperature Criticality Matrix

| Condition | Level | Color | Action |
|-----------|-------|-------|--------|
| All temps < 80°C | OK | 🟢 Green | Normal operation |
| Any tyre ≥ 80°C | Hot | 🟡 Amber | Monitor closely (1-min refresh) |
| Any tyre ≥ 85°C | Overheating | 🔴 Flashing Red | Immediate attention (1-min refresh) |
| No data / stale (>1h) | Offline | ⚪ Grey | Check sensor/comms |

## 9. Non-Functional Requirements

- **Performance**: Initial load < 10s for full fleet data
- **Refresh**: 60-second auto-refresh cycle
- **Browser**: Chrome 90+, Edge 90+
- **Dependencies**: Chart.js (CDN), no build tools required
- **Security**: JWT token stored client-side, proxied through Node server, never exposed to browser network tab as query param

## 10. Out of Scope (v3.1)

- Historical reporting / export to CSV
- Push notifications / alerting
- Multi-area or multi-client support
- Mobile responsive layout (desktop-first)
- User authentication / login page
- Pressure / Cold Pressure / Alert Status monitoring (removed in v3.0)
- Sensor health dashboard (potential future — see section 4.5)

## 11. Security Notes

- JWT token via Bearer header (never in query string)
- `rejectUnauthorized: false` in proxy — acceptable for dev/demo; should be `true` for production
- Server subdomain is configurable via UI settings (default: `australia.tyresense.com`)
