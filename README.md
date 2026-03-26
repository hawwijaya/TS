# TyreSense Dashboard

Real-time tyre monitoring dashboard for the TyreSense API (RIMEX Supply Ltd).

## Quick Start

### Prerequisites
- **Node.js** (v18 or later)
- Network access to `australia.tyresense.com` over HTTPS (port 443)
- Valid JWT API token from TyreSense Client Settings
- **Do NOT use VPN** — VPN may block the connection to the API server

### Run the Dashboard

```bash
cd tyresense
set TYRESENSE_JWT_TOKEN=your_token_here
node server.js
```

Open your browser to **http://localhost:3001**

## Vercel Deployment

This project is designed to run on Vercel using serverless API routes in `api/`.

Required Vercel environment variables:

- `TYRESENSE_JWT_TOKEN` — your TyreSense bearer token
- `TYRESENSE_API_HOST` — optional, defaults to `australia.tyresense.com`

Important deployment notes:

- The frontend calls same-origin `/api/*` routes
- Vercel must provide the proxy through the `api/` folder
- Do not expose the JWT in client-side JavaScript

### Usage

1. Click **Connect to API** in the sidebar
2. If needed for local testing, paste your JWT token in **API Settings**
3. Select an area, then a vehicle
4. Set the date range and click **Fetch Data** to view tyre data charts

### Diagnostics

If the connection fails, click **Run Diagnostics** to check:
- DNS resolution for the API host
- TCP connectivity to port 443
- TLS handshake status
- HTTP port 80 availability

### Files

| File         | Purpose                                      |
|-------------|----------------------------------------------|
| `server.js` | Node.js proxy server + static file server    |
| `index.html`| Dashboard HTML                               |
| `style.css` | Dark theme styling                           |
| `app.js`    | Application logic, API calls, Chart.js charts|

### Configuration

Edit API settings via the sidebar panel, or configure server environment variables:
- `API_HOST` — default: `australia.tyresense.com`
- `TYRESENSE_JWT_TOKEN` — recommended for local server and Vercel
- `TYRESENSE_API_HOST` — optional override for the upstream TyreSense host

### API Reference

Based on [TyreSense Datastore API v1.0.0](https://app.swaggerhub.com/apis/tyresense/datastore/1.0.0)

- `GET /da/clients` — list clients
- `GET /da/areas?clientId=26` — list areas for a client
- `GET /da/vehicles/area/{areaId}` — vehicles in an area
- `GET /da/wheeldata/{vehicleIds}?startTime=&endTime=&wheelValues=` — tyre sensor data
- `GET /da/vehicledata/{vehicleIds}?startTime=&endTime=&vehicleValues=` — vehicle data

### Support

Contact: info@rimex.com (RIMEX Supply Ltd, Vancouver, BC)

### Security

- Do not commit live TyreSense tokens to the repository
- Rotate any token that was previously committed to Git history
