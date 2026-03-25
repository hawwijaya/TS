# TyreSense Fleet Dashboard — Product Requirements Document

**Product**: TyreSense Fleet Dashboard  
**Version**: 2.0  
**Date**: 2026-03-25  
**Author**: Product Owner / Senior Tech Lead  
**Client**: Hancock Iron Ore (Roy Hill Mine)

---

## 1. Executive Summary

A real-time web dashboard for monitoring tyre health across Roy Hill Mine's haul truck fleet. Connects to the TyreSense Datastore API (`australia.tyresense.com`) to display live pressure, temperature, and alert criticality for all 95 haul trucks simultaneously — enabling mine operations to detect tyre issues before they cause downtime or safety incidents.

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
- **Vehicle IDs**: Comma-separated list supported in path
- **Time format**: ISO 8601 without timezone (server is UTC)
- **Area timezone**: `australia/perth` (AWST, UTC+8)

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

### 7.1 Batch Data Strategy

The API supports comma-separated vehicleIds. To fetch data for 95 trucks:
- **Batch size**: 10-15 trucks per request (avoid URL length limits)
- **Parallel batches**: 3-4 concurrent requests
- **Time window**: Last 1 hour (rolling)
- **Value types**: MinGaugePressure, Temperature, MaxPressureAlertStatus, MinPressureAlertStatus, MaxTemperatureAlertStatus

## 8. Criticality Matrix

| Condition | Level | Color | Action |
|-----------|-------|-------|--------|
| All readings normal | OK | 🟢 Green | Normal operation |
| Any Level1 alert | Warning | 🟡 Yellow | Monitor closely |
| Any Level2 alert | Critical | 🔴 Red | Immediate attention |
| No data / stale (>1h) | Offline | ⚪ Grey | Check sensor/comms |

## 9. Non-Functional Requirements

- **Performance**: Initial load < 10s for full fleet data
- **Refresh**: 60-second auto-refresh cycle
- **Browser**: Chrome 90+, Edge 90+
- **Dependencies**: Chart.js (CDN), no build tools required
- **Security**: JWT token stored client-side, proxied through Node server, never exposed to browser network tab as query param

## 10. Out of Scope (v2.0)

- Historical reporting / export to CSV
- GPS map visualisation
- Push notifications / alerting
- Multi-area or multi-client support
- Mobile responsive layout (desktop-first)
- User authentication / login page
