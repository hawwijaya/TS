// =====================================================
// TyreSense Dashboard — app.js
// =====================================================

(function () {
  'use strict';

  // ---- Configuration (mutable — updated via Settings panel) ----
  let API_HOST = 'australia.tyresense.com';
  let JWT_TOKEN = '';
  let API_BASE = window.location.origin + '/api';
  const SETTINGS_KEY = 'tyresense-settings';

  const WHEEL_VALUE_TYPES = [
    'MinGaugePressure', 'MaxGaugePressure', 'Temperature', 'ColdPressure',
    'MaxPressureAlertStatus', 'MinPressureAlertStatus', 'MaxTemperatureAlertStatus',
    'SensorId', 'SensorVoltage', 'SensorLowBattery'
  ];

  const VEHICLE_VALUE_TYPES = ['Connected', 'GpsPosition', 'Power', 'Ignition'];

  const CHART_COLORS = ['#00b4d8', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c',
    '#e879f9', '#22d3ee', '#f87171', '#4ade80', '#facc15', '#818cf8'];

  const VEHICLE_TYPE_ICONS = {
    haultruck: '🚛', loader: '🏗️', articulated: '🚜', auger: '⚙️',
    bellydumper: '🚚', coalhauler: '⛏️', containerhandler: '📦', float: '🚢',
    grader: '🛤️', roller: '🛞', scraper: '🔧', sleipner: '🛷', watercart: '💧'
  };

  // ---- State ----
  let state = {
    demoMode: false,
    liveConnected: false,
    areas: [],
    vehicles: [],
    selectedArea: null,
    selectedVehicle: null,
    wheelData: {},
    vehicleData: {},
    charts: {},
    _demoVehicles: {},
    // Fleet overview state
    fleetData: {},       // vehicleId -> { pressure: {pos: val}, temp: {pos: val}, cold: {pos: val}, alerts: {pos: level}, lastSampleTime: isoString|null }
    fleetVehicles: [],   // haul trucks only
    fleetTimer: null,    // auto-refresh interval
    fleetCountdown: 60,  // seconds until next refresh
    fleetCountdownTimer: null,
    fleetLastUpdate: null,
    fleetMap: null,       // Leaflet map instance
    fleetMarkers: [],     // Leaflet marker references
    fleetGps: {}          // vehicleId -> { lat, lng }
  };

  // ---- DOM References ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    connectBtn: $('#btn-connect'),
    fleetBtn: $('#btn-fleet'),
    demoBtn: $('#btn-demo'),
    diagnoseBtn: $('#btn-diagnose'),
    saveSettingsBtn: $('#btn-save-settings'),
    settingHost: $('#setting-host'),
    settingToken: $('#setting-token'),
    demoBanner: $('#demo-banner'),
    dismissBannerBtn: $('#btn-dismiss-banner'),
    diagModal: $('#diagnostics-modal'),
    diagResults: $('#diagnostics-results'),
    closeDiagBtn: $('#btn-close-diag'),
    connectionStatus: $('#connection-status'),
    sectionAreas: $('#section-areas'),
    areasList: $('#areas-list'),
    sectionVehicles: $('#section-vehicles'),
    vehiclesList: $('#vehicles-list'),
    vehicleSearch: $('#vehicle-search'),
    welcomeScreen: $('#welcome-screen'),
    fleetScreen: $('#fleet-screen'),
    dashboardScreen: $('#dashboard-screen'),
    loadingOverlay: $('#loading-overlay'),
    loadingMessage: $('#loading-message'),
    breadcrumb: $('#breadcrumb'),
    startTime: $('#start-time'),
    endTime: $('#end-time'),
    fetchDataBtn: $('#btn-fetch-data'),
    vehicleStatusRow: $('#vehicle-status-row'),
    alertSection: $('#alert-section'),
    alertTableBody: $('#alert-table-body'),
    wheelVisualSection: $('#wheel-visual-section'),
    wheelVisual: $('#wheel-visual'),
    noDataMessage: $('#no-data-message'),
    toastContainer: $('#toast-container'),
    // Fleet
    fleetTable: $('#fleet-table'),
    fleetTbody: $('#fleet-tbody'),
    fleetSort: $('#fleet-sort'),
    fleetRefreshBtn: $('#btn-fleet-refresh'),
    fleetLastUpdate: $('#fleet-last-update'),
    fleetCountdown: $('#fleet-countdown'),
    fleetCount: $('#fleet-count'),
    fleetStatTotal: $('#fleet-stat-total'),
    fleetStatOk: $('#fleet-stat-ok'),
    fleetStatWarn: $('#fleet-stat-warn'),
    fleetStatCritical: $('#fleet-stat-critical'),
    fleetStatOffline: $('#fleet-stat-offline'),
    fleetAlertsSection: $('#fleet-alerts-section'),
    fleetAlertsTbody: $('#fleet-alerts-tbody'),
    fleetMapContainer: $('#fleet-map')
  };

  // ===================================================================
  //  DEMO DATA — Roy Hill Mine Fleet
  // ===================================================================
  function generateDemoData() {
    const areas = [
      { areaId: 1, name: 'Roy Hill Mine Site', timezone: 'Australia/Perth' },
      { areaId: 2, name: 'Roy Hill Processing', timezone: 'Australia/Perth' },
      { areaId: 3, name: 'Port Hedland Facility', timezone: 'Australia/Perth' }
    ];
    const vehicles = {
      1: [
        { vehicleId: 101, name: 'HT-001', type: 'haultruck', controllerSn: '3093BF26', positions: 6, lastContact: new Date(Date.now() - 300000).toISOString() },
        { vehicleId: 102, name: 'HT-002', type: 'haultruck', controllerSn: '3093BF27', positions: 6, lastContact: new Date(Date.now() - 120000).toISOString() },
        { vehicleId: 103, name: 'HT-003', type: 'haultruck', controllerSn: '3093BF28', positions: 6, lastContact: new Date(Date.now() - 600000).toISOString() },
        { vehicleId: 104, name: 'HT-004', type: 'haultruck', controllerSn: '3093BF29', positions: 6, lastContact: new Date(Date.now() - 45000).toISOString() },
        { vehicleId: 105, name: 'HT-005', type: 'haultruck', controllerSn: '3093BF30', positions: 6, lastContact: new Date(Date.now() - 900000).toISOString() },
        { vehicleId: 106, name: 'HT-006', type: 'haultruck', controllerSn: '3093BF31', positions: 6, lastContact: new Date(Date.now() - 1800000).toISOString() },
        { vehicleId: 107, name: 'HT-007', type: 'haultruck', controllerSn: '3093BF32', positions: 6, lastContact: new Date(Date.now() - 7200000).toISOString() },
        { vehicleId: 108, name: 'HT-008', type: 'haultruck', controllerSn: '3093BF33', positions: 6, lastContact: new Date(Date.now() - 60000).toISOString() },
        { vehicleId: 110, name: 'LD-001', type: 'loader', controllerSn: '40A1CC11', positions: 4, lastContact: new Date(Date.now() - 180000).toISOString() },
        { vehicleId: 111, name: 'LD-002', type: 'loader', controllerSn: '40A1CC12', positions: 4, lastContact: new Date(Date.now() - 240000).toISOString() },
        { vehicleId: 115, name: 'WC-001', type: 'watercart', controllerSn: '55D3EE05', positions: 6, lastContact: new Date(Date.now() - 3600000).toISOString() },
        { vehicleId: 116, name: 'WC-002', type: 'watercart', controllerSn: '55D3EE06', positions: 6, lastContact: new Date(Date.now() - 500000).toISOString() },
        { vehicleId: 120, name: 'GR-001', type: 'grader', controllerSn: '60F2AA01', positions: 6, lastContact: new Date(Date.now() - 420000).toISOString() },
        { vehicleId: 121, name: 'GR-002', type: 'grader', controllerSn: '60F2AA02', positions: 6, lastContact: new Date(Date.now() - 150000).toISOString() }
      ],
      2: [
        { vehicleId: 201, name: 'HT-101', type: 'haultruck', controllerSn: '70B4DD01', positions: 6, lastContact: new Date(Date.now() - 200000).toISOString() },
        { vehicleId: 202, name: 'HT-102', type: 'haultruck', controllerSn: '70B4DD02', positions: 6, lastContact: new Date(Date.now() - 350000).toISOString() },
        { vehicleId: 210, name: 'LD-101', type: 'loader', controllerSn: '80C5EE01', positions: 4, lastContact: new Date(Date.now() - 90000).toISOString() },
        { vehicleId: 215, name: 'SC-001', type: 'scraper', controllerSn: '90D6FF01', positions: 4, lastContact: new Date(Date.now() - 500000).toISOString() }
      ],
      3: [
        { vehicleId: 301, name: 'HT-201', type: 'haultruck', controllerSn: 'A1E7AA01', positions: 6, lastContact: new Date(Date.now() - 100000).toISOString() },
        { vehicleId: 302, name: 'CH-001', type: 'containerhandler', controllerSn: 'B2F8BB01', positions: 4, lastContact: new Date(Date.now() - 600000).toISOString() }
      ]
    };
    return { areas, vehicles };
  }

  function generateWheelTimeSeries(positions, basePSI, tempBase, startTime, endTime) {
    const result = [];
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const interval = 10 * 60 * 1000;
    const points = Math.min(Math.floor((end - start) / interval), 144);
    for (let pos = 1; pos <= positions; pos++) {
      const posBasePSI = basePSI + (Math.random() - 0.5) * 8;
      const posTempBase = tempBase + (Math.random() - 0.5) * 5;
      const sensorId = 'SN' + (1000 + pos * 10 + Math.floor(Math.random() * 9));
      const minPressure = [], maxPressure = [], temperature = [], coldPressure = [];
      const maxPAlert = [], minPAlert = [], maxTAlert = [];
      const sensorIds = [], sensorVoltage = [], sensorBattery = [];
      for (let i = 0; i < points; i++) {
        const t = new Date(start + i * interval).toISOString();
        const tEnd = new Date(start + (i + 1) * interval).toISOString();
        const hourOfDay = new Date(start + i * interval).getHours();
        const thermalFactor = Math.sin((hourOfDay - 6) * Math.PI / 12) * 0.5 + 0.5;
        const loadFactor = (hourOfDay >= 6 && hourOfDay <= 18) ? 1.1 : 0.95;
        const noise = () => (Math.random() - 0.5) * 3;
        const currentPSI = posBasePSI * loadFactor + noise();
        const currentTemp = posTempBase + thermalFactor * 15 + noise();
        const currentCold = posBasePSI * 0.95 + noise() * 0.5;
        minPressure.push({ start: t, end: tEnd, value: String((currentPSI - 2 + noise()).toFixed(1)) });
        maxPressure.push({ start: t, end: tEnd, value: String((currentPSI + 2 + noise()).toFixed(1)) });
        temperature.push({ start: t, end: tEnd, value: String(currentTemp.toFixed(1)) });
        coldPressure.push({ start: t, end: tEnd, value: String(currentCold.toFixed(1)) });
        let maxPAlertVal = 'None', minPAlertVal = 'None', maxTAlertVal = 'None';
        if (currentPSI > posBasePSI * 1.15) maxPAlertVal = 'Level1';
        if (currentPSI > posBasePSI * 1.25) maxPAlertVal = 'Level2';
        if (currentPSI < posBasePSI * 0.8) minPAlertVal = 'Level1';
        if (currentPSI < posBasePSI * 0.7) minPAlertVal = 'Level2';
        if (currentTemp > 80) maxTAlertVal = 'Level1';
        if (currentTemp > 90) maxTAlertVal = 'Level2';
        maxPAlert.push({ start: t, end: tEnd, value: maxPAlertVal });
        minPAlert.push({ start: t, end: tEnd, value: minPAlertVal });
        maxTAlert.push({ start: t, end: tEnd, value: maxTAlertVal });
        sensorIds.push({ start: t, end: tEnd, value: sensorId });
        sensorVoltage.push({ start: t, value: String((3.1 + Math.random() * 0.2).toFixed(2)) });
        sensorBattery.push({ start: t, end: tEnd, value: 'false' });
      }
      result.push({ vehicleId: 0, position: pos, valueType: 'MinGaugePressure', values: minPressure });
      result.push({ vehicleId: 0, position: pos, valueType: 'MaxGaugePressure', values: maxPressure });
      result.push({ vehicleId: 0, position: pos, valueType: 'Temperature', values: temperature });
      result.push({ vehicleId: 0, position: pos, valueType: 'ColdPressure', values: coldPressure });
      result.push({ vehicleId: 0, position: pos, valueType: 'MaxPressureAlertStatus', values: maxPAlert });
      result.push({ vehicleId: 0, position: pos, valueType: 'MinPressureAlertStatus', values: minPAlert });
      result.push({ vehicleId: 0, position: pos, valueType: 'MaxTemperatureAlertStatus', values: maxTAlert });
      result.push({ vehicleId: 0, position: pos, valueType: 'SensorId', values: sensorIds });
      result.push({ vehicleId: 0, position: pos, valueType: 'SensorVoltage', values: sensorVoltage });
      result.push({ vehicleId: 0, position: pos, valueType: 'SensorLowBattery', values: sensorBattery });
    }
    return result;
  }

  function generateVehicleTimeSeries(startTime, endTime) {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const interval = 10 * 60 * 1000;
    const points = Math.min(Math.floor((end - start) / interval), 144);
    const connected = [], gps = [], power = [], ignition = [];
    const baseLat = -22.43, baseLng = 119.95;
    for (let i = 0; i < points; i++) {
      const t = new Date(start + i * interval).toISOString();
      const tEnd = new Date(start + (i + 1) * interval).toISOString();
      const hourOfDay = new Date(start + i * interval).getHours();
      const isShift = hourOfDay >= 6 && hourOfDay <= 18;
      connected.push({ start: t, end: tEnd, value: 'true' });
      power.push({ start: t, end: tEnd, value: isShift ? 'true' : (Math.random() > 0.3 ? 'true' : 'false') });
      ignition.push({ start: t, end: tEnd, value: isShift ? 'true' : (Math.random() > 0.5 ? 'true' : 'false') });
      gps.push({ start: t, value: (baseLat + (Math.random() - 0.5) * 0.05).toFixed(5) + ', ' + (baseLng + (Math.random() - 0.5) * 0.05).toFixed(5) });
    }
    return [
      { vehicleId: 0, valueType: 'Connected', values: connected },
      { vehicleId: 0, valueType: 'GpsPosition', values: gps },
      { vehicleId: 0, valueType: 'Power', values: power },
      { vehicleId: 0, valueType: 'Ignition', values: ignition }
    ];
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ---- API helpers ----
  async function apiGet(path) {
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const fullUrl = API_BASE + cleanPath;
    const headers = {
      'X-Api-Host': API_HOST
    };
    if (JWT_TOKEN) {
      headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
    }
    const resp = await fetch(fullUrl, {
      headers
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API ${resp.status}: ${text || resp.statusText}`);
    }
    return resp.json();
  }

  // ---- UI helpers ----
  function showLoading(msg) {
    dom.loadingMessage.textContent = msg || 'Loading...';
    dom.loadingOverlay.style.display = 'flex';
  }

  function hideLoading() {
    dom.loadingOverlay.style.display = 'none';
  }

  function showScreen(screen) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    dom.toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  function formatDate(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function setDefaultDateRange() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    dom.endTime.value = toLocalISO(now);
    dom.startTime.value = toLocalISO(dayAgo);
  }

  function toLocalISO(d) {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  }

  // ---- Connect flow ----
  async function connect() {
    const isReconnect = state.liveConnected;
    setConnectBusy(true, isReconnect ? 'Refreshing...' : 'Connecting...');
    showLoading(isReconnect ? 'Refreshing live fleet data...' : 'Connecting to TyreSense API...');
    try {
      const areas = await apiGet('/da/areas');
      state.areas = areas;
      state.demoMode = false;
      state.liveConnected = true;
      hideDemoBanner();
      setConnected('Live API');
      if (isReconnect) {
        await openFleetOverview({ forceReload: true });
        toast('Fleet overview refreshed', 'success');
      } else {
        toast('Connected to TyreSense API!', 'success');
      }
    } catch (err) {
      let detail = err.message || 'Unknown error';
      // Strip HTML from nginx error pages
      detail = detail.replace(/<[^>]+>/g, '').replace(/<!--.*?-->/g, '').replace(/\s{2,}/g, ' ').trim();
      if (detail.length > 120) detail = detail.substring(0, 120) + '...';
      state.liveConnected = false;
      toast('Connection failed. Check API settings and network access.', 'error');
      setDisconnected('Connection Failed');
    } finally {
      setConnectBusy(false);
      hideLoading();
    }
  }

  function startDemoMode() {
    state.demoMode = true;
    const demo = generateDemoData();
    state.areas = demo.areas;
    state._demoVehicles = demo.vehicles;
    showDemoBanner();
    setConnected('Sample Data');
  }

  function showDemoBanner() {
    dom.demoBanner.style.display = '';
    document.body.classList.add('demo-active');
  }

  function hideDemoBanner() {
    dom.demoBanner.style.display = 'none';
    document.body.classList.remove('demo-active');
  }

  function setConnected(label) {
    dom.connectionStatus.className = 'status-badge connected';
    dom.connectionStatus.innerHTML = '<span class="status-dot"></span> ' + escapeHtml(label);
    dom.connectBtn.textContent = 'Reconnect';
    dom.fleetBtn.disabled = false;
    renderAreas();
    dom.sectionAreas.style.display = 'block';
  }

  function setDisconnected(label = 'Not Connected') {
    dom.connectionStatus.className = 'status-badge disconnected';
    dom.connectionStatus.innerHTML = '<span class="status-dot"></span> ' + escapeHtml(label);
    dom.fleetBtn.disabled = true;
  }

  function setConnectBusy(isBusy, label) {
    dom.connectBtn.disabled = isBusy;
    dom.connectBtn.classList.toggle('is-loading', isBusy);
    if (isBusy) {
      dom.connectBtn.textContent = label;
      dom.fleetBtn.disabled = true;
      return;
    }
    dom.connectBtn.textContent = state.liveConnected ? 'Reconnect' : 'Connect to API';
    dom.fleetBtn.disabled = !state.liveConnected;
  }

  // ---- Render areas ----
  function renderAreas() {
    dom.areasList.innerHTML = '';
    state.areas.forEach(area => {
      const el = document.createElement('div');
      el.className = 'nav-item';
      el.dataset.areaId = area.areaId;
      el.innerHTML = `<span>📍</span> ${escapeHtml(area.name)} <span class="item-badge">${area.timezone || ''}</span>`;
      el.addEventListener('click', () => selectArea(area));
      dom.areasList.appendChild(el);
    });
  }

  // ---- Select area ----
  async function selectArea(area) {
    state.selectedArea = area;
    state.selectedVehicle = null;

    // Highlight
    dom.areasList.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', Number(el.dataset.areaId) === area.areaId);
    });

    showLoading(`Loading vehicles for ${area.name}...`);
    try {
      let vehicles;
      if (state.demoMode) {
        await delay(300);
        vehicles = state._demoVehicles[area.areaId] || [];
      } else {
        vehicles = await apiGet(`/da/vehicles/area/${area.areaId}`);
      }
      state.vehicles = vehicles;
      renderVehicles();
      dom.sectionVehicles.style.display = 'block';
      toast(`${vehicles.length} vehicle(s) found in ${area.name}`, 'info');
    } catch (err) {
      toast(`Failed to load vehicles: ${err.message}`, 'error');
    } finally {
      hideLoading();
    }
  }

  // ---- Render vehicles ----
  function renderVehicles(filter = '') {
    dom.vehiclesList.innerHTML = '';
    const lf = filter.toLowerCase();
    const filtered = state.vehicles.filter(v =>
      v.name.toLowerCase().includes(lf) || (v.type || '').toLowerCase().includes(lf)
    );
    filtered.forEach(vehicle => {
      const el = document.createElement('div');
      el.className = 'nav-item';
      el.dataset.vehicleId = vehicle.vehicleId;
      const icon = VEHICLE_TYPE_ICONS[vehicle.type] || '🚛';
      el.innerHTML = `<span>${icon}</span> ${escapeHtml(vehicle.name)} <span class="item-badge">${vehicle.positions || 0} pos</span>`;
      el.addEventListener('click', () => selectVehicle(vehicle));
      dom.vehiclesList.appendChild(el);
    });
    if (filtered.length === 0) {
      dom.vehiclesList.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.8rem;">No vehicles found.</div>';
    }
  }

  // ---- Select vehicle ----
  async function selectVehicle(vehicle) {
    state.selectedVehicle = vehicle;

    // Highlight
    dom.vehiclesList.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', Number(el.dataset.vehicleId) === vehicle.vehicleId);
    });

    // Show dashboard
    showScreen(dom.dashboardScreen);
    updateVehicleInfo(vehicle);
    setDefaultDateRange();

    // Auto-fetch data
    await fetchVehicleData();
  }

  // ---- Update vehicle info panel ----
  function updateVehicleInfo(v) {
    const icon = VEHICLE_TYPE_ICONS[v.type] || '🚛';
    $('#info-vehicle-name').textContent = v.name;
    $('#info-vehicle-type').textContent = `${icon} ${v.type || 'Unknown'}`;
    $('#info-vehicle-positions').textContent = v.positions || '—';
    $('#info-vehicle-controller').textContent = v.controllerSn || '—';
    $('#info-vehicle-lastcontact').textContent = formatDate(v.lastContact);
    dom.breadcrumb.innerHTML = `${escapeHtml(state.selectedArea.name)} / <span>${escapeHtml(v.name)}</span>`;
  }

  // ---- Fetch data ----
  async function fetchVehicleData() {
    const v = state.selectedVehicle;
    if (!v) return;

    const startTime = new Date(dom.startTime.value).toISOString();
    const endTime = new Date(dom.endTime.value).toISOString();

    showLoading(`Fetching sensor data for ${v.name}...`);

    try {
      let wheelResp, vehResp;

      if (state.demoMode) {
        await delay(400);
        const basePSI = v.type === 'haultruck' ? 100 : v.type === 'loader' ? 85 : 90;
        const tempBase = 45;
        wheelResp = generateWheelTimeSeries(v.positions, basePSI, tempBase, startTime, endTime);
        vehResp = generateVehicleTimeSeries(startTime, endTime);
      } else {
        const vehicleParams = new URLSearchParams();
        vehicleParams.set('startTime', startTime);
        vehicleParams.set('endTime', endTime);
        VEHICLE_VALUE_TYPES.forEach(vv => vehicleParams.append('vehicleValues', vv));

        // The upstream API only honors the first wheelValues entry per request.
        const wheelRequests = WHEEL_VALUE_TYPES.map(valueType => {
          const wheelParams = new URLSearchParams();
          wheelParams.set('startTime', startTime);
          wheelParams.set('endTime', endTime);
          wheelParams.set('wheelValues', valueType);
          return apiGet(`/da/wheeldata/${v.vehicleId}?${wheelParams.toString()}`);
        });

        const [wheelResults, vehicleResult] = await Promise.all([
          Promise.all(wheelRequests),
          apiGet(`/da/vehicledata/${v.vehicleId}?${vehicleParams.toString()}`)
        ]);

        wheelResp = wheelResults.flat();
        vehResp = vehicleResult;
      }

      state.wheelData = groupWheelData(wheelResp);
      state.vehicleData = groupVehicleData(vehResp);

      renderDashboard();
      dom.noDataMessage.style.display = 'none';
      toast('Data loaded successfully', 'success');
    } catch (err) {
      toast(`Failed to load data: ${err.message}`, 'error');
      dom.noDataMessage.style.display = 'block';
    } finally {
      hideLoading();
    }
  }

  // ---- Group wheel data by value type and position ----
  function groupWheelData(items) {
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.valueType]) grouped[item.valueType] = {};
      grouped[item.valueType][item.position] = item.values || [];
    });
    return grouped;
  }

  // ---- Group vehicle data by value type ----
  function groupVehicleData(items) {
    const grouped = {};
    items.forEach(item => {
      grouped[item.valueType] = item.values || [];
    });
    return grouped;
  }

  // ---- Render full dashboard ----
  function renderDashboard() {
    renderVehicleStatus();
    renderPressureChart();
    renderTemperatureChart();
    renderColdPressureChart();
    renderAlertTable();
    renderWheelVisual();
  }

  // ---- Vehicle Status Cards ----
  function renderVehicleStatus() {
    const vd = state.vehicleData;
    dom.vehicleStatusRow.style.display = 'flex';

    setStatusCard('status-power', vd.Power);
    setStatusCard('status-ignition', vd.Ignition);
    setStatusCard('status-connected', vd.Connected);

    // GPS
    const gpsCard = $('#status-gps');
    if (vd.GpsPosition && vd.GpsPosition.length > 0) {
      const last = vd.GpsPosition[vd.GpsPosition.length - 1];
      gpsCard.querySelector('.status-value').textContent = last.value || '—';
      gpsCard.classList.add('on');
      gpsCard.classList.remove('off');
    } else {
      gpsCard.querySelector('.status-value').textContent = 'No data';
      gpsCard.classList.remove('on');
      gpsCard.classList.add('off');
    }
  }

  function setStatusCard(id, values) {
    const card = $(`#${id}`);
    if (values && values.length > 0) {
      const last = values[values.length - 1];
      const isOn = last.value === 'true' || last.value === 'True';
      card.querySelector('.status-value').textContent = isOn ? 'ON' : 'OFF';
      card.className = `status-card ${isOn ? 'on' : 'off'}`;
    } else {
      card.querySelector('.status-value').textContent = 'No data';
      card.className = 'status-card';
    }
  }

  // ---- Chart: Tyre Pressure ----
  function renderPressureChart() {
    const data = state.wheelData;
    const minP = data.MinGaugePressure || {};
    const maxP = data.MaxGaugePressure || {};
    const positions = [...new Set([...Object.keys(minP), ...Object.keys(maxP)])].sort((a, b) => a - b);

    const datasets = [];
    positions.forEach((pos, idx) => {
      const color = CHART_COLORS[idx % CHART_COLORS.length];
      if (maxP[pos]) {
        datasets.push({
          label: `Pos ${pos} Max`,
          data: maxP[pos].map(v => ({ x: new Date(v.start), y: parseFloat(v.value) })),
          borderColor: color,
          backgroundColor: color + '22',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: false
        });
      }
      if (minP[pos]) {
        datasets.push({
          label: `Pos ${pos} Min`,
          data: minP[pos].map(v => ({ x: new Date(v.start), y: parseFloat(v.value) })),
          borderColor: color,
          backgroundColor: color + '22',
          borderWidth: 1.5,
          borderDash: [4, 3],
          pointRadius: 0,
          tension: 0.3,
          fill: false
        });
      }
    });

    createOrUpdateChart('chart-pressure', 'pressure', {
      type: 'line',
      data: { datasets },
      options: chartOptions('PSI')
    });
  }

  // ---- Chart: Temperature ----
  function renderTemperatureChart() {
    const temp = state.wheelData.Temperature || {};
    const positions = Object.keys(temp).sort((a, b) => a - b);

    const datasets = positions.map((pos, idx) => ({
      label: `Position ${pos}`,
      data: temp[pos].map(v => ({ x: new Date(v.start), y: parseFloat(v.value) })),
      borderColor: CHART_COLORS[idx % CHART_COLORS.length],
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
      fill: false
    }));

    createOrUpdateChart('chart-temperature', 'temperature', {
      type: 'line',
      data: { datasets },
      options: chartOptions('°C')
    });
  }

  // ---- Chart: Cold Pressure ----
  function renderColdPressureChart() {
    const cp = state.wheelData.ColdPressure || {};
    const positions = Object.keys(cp).sort((a, b) => a - b);

    const datasets = positions.map((pos, idx) => ({
      label: `Position ${pos}`,
      data: cp[pos].map(v => ({ x: new Date(v.start), y: parseFloat(v.value) })),
      borderColor: CHART_COLORS[idx % CHART_COLORS.length],
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
      fill: false
    }));

    createOrUpdateChart('chart-cold-pressure', 'coldPressure', {
      type: 'line',
      data: { datasets },
      options: chartOptions('PSI')
    });
  }

  function chartOptions(unit) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#8a9bb0', font: { size: 11 }, boxWidth: 14, padding: 12 }
        },
        tooltip: {
          backgroundColor: '#1e2d3d',
          titleColor: '#e8edf2',
          bodyColor: '#8a9bb0',
          borderColor: '#2a3f52',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} ${unit}`
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          grid: { color: 'rgba(42,63,82,0.3)' },
          ticks: { color: '#5a6f82', font: { size: 10 }, maxTicksLimit: 10 }
        },
        y: {
          grid: { color: 'rgba(42,63,82,0.3)' },
          ticks: { color: '#5a6f82', font: { size: 10 } },
          title: { display: true, text: unit, color: '#5a6f82', font: { size: 11 } }
        }
      }
    };
  }

  function createOrUpdateChart(canvasId, key, config) {
    if (state.charts[key]) {
      state.charts[key].destroy();
    }
    const ctx = document.getElementById(canvasId).getContext('2d');
    state.charts[key] = new Chart(ctx, config);
  }

  // ---- Alert Table ----
  function renderAlertTable() {
    const wd = state.wheelData;
    const maxPA = wd.MaxPressureAlertStatus || {};
    const minPA = wd.MinPressureAlertStatus || {};
    const maxTA = wd.MaxTemperatureAlertStatus || {};
    const sensorId = wd.SensorId || {};
    const sensorV = wd.SensorVoltage || {};
    const sensorBat = wd.SensorLowBattery || {};

    const allPositions = new Set();
    [maxPA, minPA, maxTA, sensorId, sensorV, sensorBat].forEach(obj => {
      Object.keys(obj).forEach(p => allPositions.add(p));
    });

    const positions = [...allPositions].sort((a, b) => a - b);

    if (positions.length === 0) {
      dom.alertSection.style.display = 'none';
      return;
    }

    dom.alertSection.style.display = 'block';
    dom.alertTableBody.innerHTML = '';

    positions.forEach(pos => {
      const row = document.createElement('tr');

      const lastVal = (arr) => arr && arr.length > 0 ? arr[arr.length - 1].value : '—';
      const alertClass = (val) => {
        if (!val || val === '—' || val === 'None') return 'alert-none';
        if (val === 'Level1') return 'alert-level1';
        if (val === 'Level2') return 'alert-level2';
        return '';
      };

      const maxPVal = lastVal(maxPA[pos]);
      const minPVal = lastVal(minPA[pos]);
      const maxTVal = lastVal(maxTA[pos]);
      const sIdVal = lastVal(sensorId[pos]);
      const sVVal = lastVal(sensorV[pos]);
      const sBatVal = lastVal(sensorBat[pos]);

      row.innerHTML = `
        <td><strong>Pos ${pos}</strong></td>
        <td class="${alertClass(maxPVal)}">${escapeHtml(maxPVal)}</td>
        <td class="${alertClass(minPVal)}">${escapeHtml(minPVal)}</td>
        <td class="${alertClass(maxTVal)}">${escapeHtml(maxTVal)}</td>
        <td>${escapeHtml(sIdVal)}</td>
        <td>${escapeHtml(sVVal)}${sVVal !== '—' ? 'V' : ''}</td>
        <td>${sBatVal === 'true' || sBatVal === 'True' ? '⚠️ Low' : sBatVal === '—' ? '—' : '✅ OK'}</td>
      `;
      dom.alertTableBody.appendChild(row);
    });
  }

  // ---- Wheel Visual ----
  function renderWheelVisual() {
    const wd = state.wheelData;
    const maxP = wd.MaxGaugePressure || {};
    const temp = wd.Temperature || {};
    const maxPA = wd.MaxPressureAlertStatus || {};
    const minPA = wd.MinPressureAlertStatus || {};
    const maxTA = wd.MaxTemperatureAlertStatus || {};
    const cp = wd.ColdPressure || {};

    const allPositions = new Set();
    [maxP, temp, maxPA, minPA, maxTA, cp].forEach(obj => {
      Object.keys(obj).forEach(p => allPositions.add(p));
    });

    const positions = [...allPositions].sort((a, b) => a - b);

    if (positions.length === 0) {
      dom.wheelVisualSection.style.display = 'none';
      return;
    }

    dom.wheelVisualSection.style.display = 'block';
    dom.wheelVisual.innerHTML = '';

    positions.forEach(pos => {
      const card = document.createElement('div');
      card.className = 'wheel-card';

      const lastVal = (arr) => arr && arr.length > 0 ? arr[arr.length - 1].value : null;

      const pressure = lastVal(maxP[pos]);
      const temperature = lastVal(temp[pos]);
      const coldP = lastVal(cp[pos]);
      const alertCandidates = [lastVal(maxPA[pos]), lastVal(minPA[pos]), lastVal(maxTA[pos])].filter(Boolean);
      const alert = alertCandidates.reduce((worst, current) => {
        return alertSeverity(current) > alertSeverity(worst) ? current : worst;
      }, 'None');

      // Determine status
      if (alert === 'Level2') card.classList.add('critical');
      else if (alert === 'Level1') card.classList.add('warn');
      else card.classList.add('ok');

      card.innerHTML = `
        <div class="wheel-position-number">P${pos}</div>
        <div class="wheel-stat"><span>Pressure</span> <span class="val">${pressure !== null ? parseFloat(pressure).toFixed(1) + ' PSI' : '—'}</span></div>
        <div class="wheel-stat"><span>Temp</span> <span class="val">${temperature !== null ? parseFloat(temperature).toFixed(1) + ' °C' : '—'}</span></div>
        <div class="wheel-stat"><span>Cold PSI</span> <span class="val">${coldP !== null ? parseFloat(coldP).toFixed(1) : '—'}</span></div>
        <div class="wheel-stat"><span>Alert</span> <span class="val ${alert === 'Level2' ? 'alert-level2' : alert === 'Level1' ? 'alert-level1' : 'alert-none'}">${alert || 'None'}</span></div>
      `;
      dom.wheelVisual.appendChild(card);
    });
  }

  // ===================================================================
  //  FLEET OVERVIEW — All Haul Trucks on One Page
  // ===================================================================

  const FLEET_REFRESH_INTERVAL = 60; // seconds
  const FLEET_BATCH_SIZE = 10;       // trucks per API call
  const FLEET_CONCURRENCY = 6;       // parallel API calls
  const FLEET_DATA_LOOKBACK_HOURS = 24;
  const FLEET_GPS_LOOKBACK_HOURS = 24;

  async function openFleetOverview(options = {}) {
    const { deferScreen = false, forceReload = false } = options;
    // Load vehicles for Roy Hill Mine (areaId 32) if not already loaded
    if (forceReload || state.fleetVehicles.length === 0) {
      if (!deferScreen) showLoading('Loading fleet vehicles...');
      try {
        const area = state.areas.find(a => a.areaId === 32) || state.areas[0];
        if (!area) {
          toast('No area found', 'error');
          if (!deferScreen) hideLoading();
          return;
        }
        state.selectedArea = area;
        const vehicles = await apiGet(`/da/vehicles/area/${area.areaId}`);
        state.vehicles = vehicles;
        state.fleetVehicles = vehicles.filter(v => v.type === 'haultruck');
        renderAreas();
        renderVehicles();
        dom.sectionAreas.style.display = 'block';
        dom.sectionVehicles.style.display = 'block';
      } catch (err) {
        toast('Failed to load vehicles: ' + err.message, 'error');
        if (!deferScreen) hideLoading();
        return;
      }
      if (!deferScreen) hideLoading();
    }

    if (!deferScreen) {
      showScreen(dom.fleetScreen);
    }
    dom.fleetCount.textContent = state.fleetVehicles.length + ' haul trucks';
    initFleetMap();
    await refreshFleetOverview();
    startFleetAutoRefresh();
    if (deferScreen) {
      showScreen(dom.fleetScreen);
    }
  }

  async function refreshFleetOverview() {
    if (state.fleetVehicles.length === 0) return;
    dom.fleetTable.classList.add('loading');
    await Promise.all([
      fetchFleetData(),
      fetchFleetGpsData()
    ]);
    dom.fleetTable.classList.remove('loading');
    renderFleetGrid();
  }

  async function fetchFleetData() {
    const trucks = state.fleetVehicles;
    if (trucks.length === 0) return;

    const now = new Date();
    const hourAgo = new Date(now.getTime() - FLEET_DATA_LOOKBACK_HOURS * 3600000);
    const endT = now.toISOString();
    const startT = hourAgo.toISOString();

    // IMPORTANT: The TyreSense API only returns data for the FIRST wheelValues
    // parameter per request, so we must make separate calls per value type.
    const valueTypes = ['MinGaugePressure', 'Temperature', 'ColdPressure', 'MaxPressureAlertStatus', 'MinPressureAlertStatus', 'MaxTemperatureAlertStatus'];

    // Split trucks into batches
    const batchIds = [];
    for (let i = 0; i < trucks.length; i += FLEET_BATCH_SIZE) {
      const batch = trucks.slice(i, i + FLEET_BATCH_SIZE);
      batchIds.push(batch.map(t => t.vehicleId).join(','));
    }

    const requests = [];
    valueTypes.forEach(vt => {
      const qs = `startTime=${encodeURIComponent(startT)}&endTime=${encodeURIComponent(endT)}&wheelValues=${encodeURIComponent(vt)}`;
      batchIds.forEach(ids => {
        requests.push(() => apiGet(`/da/wheeldata/${ids}?${qs}`));
      });
    });

    const settled = await runRequestPool(requests, FLEET_CONCURRENCY);
    const allResults = [];
    settled.forEach(r => {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        allResults.push(...r.value);
      }
    });

    // Process results into per-vehicle data
    const fleetData = {};
    allResults.forEach(item => {
      const vid = item.vehicleId;
      if (!fleetData[vid]) fleetData[vid] = { pressure: {}, temp: {}, cold: {}, alerts: {}, lastSampleTime: null };
      const lastEntry = item.values && item.values.length > 0 ? item.values[item.values.length - 1] : null;
      const lastVal = lastEntry ? lastEntry.value : null;
      if (lastVal === null) return;
      const pos = item.position;
      const sampleTime = lastEntry && (lastEntry.start || lastEntry.timestamp || lastEntry.time);
      if (sampleTime && (!fleetData[vid].lastSampleTime || new Date(sampleTime) > new Date(fleetData[vid].lastSampleTime))) {
        fleetData[vid].lastSampleTime = sampleTime;
      }
      switch (item.valueType) {
        case 'MinGaugePressure':
          fleetData[vid].pressure[pos] = parseFloat(lastVal);
          break;
        case 'Temperature':
          fleetData[vid].temp[pos] = parseFloat(lastVal);
          break;
        case 'ColdPressure':
          fleetData[vid].cold[pos] = parseFloat(lastVal);
          break;
        case 'MaxPressureAlertStatus':
        case 'MinPressureAlertStatus':
        case 'MaxTemperatureAlertStatus': {
          const current = fleetData[vid].alerts[pos] || 'None';
          const incoming = lastVal;
          // Keep the worst alert level
          if (alertSeverity(incoming) > alertSeverity(current)) {
            fleetData[vid].alerts[pos] = incoming;
          }
          break;
        }
      }
    });

    state.fleetData = fleetData;
    state.fleetLastUpdate = new Date();
  }

  async function fetchFleetGpsData() {
    if (!state.fleetMap || state.fleetVehicles.length === 0) return;

    const vehicleIds = state.fleetVehicles.map(t => t.vehicleId);
    const now = new Date();
    const hourAgo = new Date(now.getTime() - FLEET_GPS_LOOKBACK_HOURS * 3600000);
    const qs = `startTime=${encodeURIComponent(hourAgo.toISOString())}&endTime=${encodeURIComponent(now.toISOString())}&vehicleValues=GpsPosition`;

    const batches = [];
    for (let i = 0; i < vehicleIds.length; i += FLEET_BATCH_SIZE) {
      batches.push(vehicleIds.slice(i, i + FLEET_BATCH_SIZE).join(','));
    }

    const results = await runRequestPool(
      batches.map(ids => () => apiGet(`/da/vehicledata/${ids}?${qs}`)),
      FLEET_CONCURRENCY
    );

    const gpsPoints = {};
    results.forEach(r => {
      if (r.status !== 'fulfilled' || !Array.isArray(r.value)) return;
      r.value.forEach(item => {
        if (item.valueType !== 'GpsPosition') return;
        const vals = item.values;
        if (!vals || vals.length === 0) return;
        const lastGps = vals[vals.length - 1].value;
        if (!lastGps) return;

        let lat, lng;
        try {
          if (typeof lastGps === 'string') {
            const parts = lastGps.trim().split(/[\s,]+/);
            if (parts.length >= 2) {
              lat = parseFloat(parts[0]);
              lng = parseFloat(parts[1]);
            }
          } else if (typeof lastGps === 'object') {
            lat = parseFloat(lastGps.latitude || lastGps.lat);
            lng = parseFloat(lastGps.longitude || lastGps.lng || lastGps.lon);
          }
        } catch (_) {
          return;
        }

        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;
        gpsPoints[item.vehicleId] = { lat, lng };
      });
    });

    state.fleetGps = gpsPoints;
  }

  function alertSeverity(level) {
    if (level === 'Level2') return 2;
    if (level === 'Level1') return 1;
    return 0;
  }

  function getTruckStatus(vid) {
    const data = state.fleetData[vid];
    if (!data || (Object.keys(data.pressure).length === 0 && Object.keys(data.temp).length === 0)) {
      return 'offline';
    }
    let worst = 0;
    Object.values(data.alerts).forEach(level => {
      worst = Math.max(worst, alertSeverity(level));
    });
    if (worst >= 2) return 'critical';
    if (worst >= 1) return 'warn';
    return 'ok';
  }

  function sortFleetVehicles(trucks) {
    const sortBy = dom.fleetSort.value;
    const sorted = [...trucks];
    if (sortBy === 'criticality') {
      const order = { critical: 0, warn: 1, ok: 2, offline: 3 };
      sorted.sort((a, b) => {
        const sa = order[getTruckStatus(a.vehicleId)] ?? 4;
        const sb = order[getTruckStatus(b.vehicleId)] ?? 4;
        return sa - sb || a.name.localeCompare(b.name);
      });
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'lastcontact') {
      sorted.sort((a, b) => new Date(b.lastContact) - new Date(a.lastContact));
    }
    return sorted;
  }

  function renderFleetGrid() {
    const trucks = sortFleetVehicles(state.fleetVehicles);
    dom.fleetTbody.innerHTML = '';
    const alerts = []; // collect active alerts

    let counts = { total: trucks.length, ok: 0, warn: 0, critical: 0, offline: 0 };

    trucks.forEach(truck => {
      const vid = truck.vehicleId;
      const status = getTruckStatus(vid);
      counts[status]++;
      const data = state.fleetData[vid] || { pressure: {}, temp: {}, cold: {}, alerts: {}, lastSampleTime: null };

      // Name parts: e.g. "DT034 793F" → id="DT034", model="793F"
      const parts = truck.name.trim().split(/\s+/);
      const truckId = parts[0];
      const model = parts.length > 1 ? parts.slice(1).join(' ') : '';

      // Compute data age
      const ageStr = getDataAge(data.lastSampleTime || truck.lastContact);

      // Collect active alerts for alert table
      for (let pos = 1; pos <= 6; pos++) {
        const al = data.alerts[pos];
        if (al && al !== 'None') {
          alerts.push({
            type: alertSeverity(al) >= 2 ? 'Pressure Alert' : 'Low Pressure Alert',
            severity: al,
            vehicle: truck.name,
            position: pos,
            psi: data.pressure[pos],
            temp: data.temp[pos]
          });
        }
      }

      // ── Row 1: Pressure (P) ──
      const rowP = document.createElement('tr');
      rowP.className = `ft-row-p truck-${status}`;
      rowP.dataset.vehicleId = vid;

      // Vehicle name cell (spans 3 rows)
      const cellVehicle = document.createElement('td');
      cellVehicle.className = 'ft-cell-vehicle';
      cellVehicle.rowSpan = 3;
      cellVehicle.innerHTML = `<div class="ft-truck-name">${escapeHtml(truckId)}</div><div class="ft-truck-model">${escapeHtml(model)}</div>`;
      cellVehicle.style.cursor = 'pointer';
      cellVehicle.addEventListener('click', () => drillDown(truck));
      rowP.appendChild(cellVehicle);

      // Meta cell (spans 3 rows)
      const cellMeta = document.createElement('td');
      cellMeta.className = 'ft-cell-meta';
      cellMeta.rowSpan = 3;
      const contactTime = truck.lastContact ? formatDate(truck.lastContact) : '—';
      cellMeta.innerHTML = `<span style="font-size:0.68rem;color:var(--text-muted)">${escapeHtml(contactTime)}</span>`;
      rowP.appendChild(cellMeta);

      // Type indicator: P
      const cellTypeP = document.createElement('td');
      cellTypeP.innerHTML = `<span class="ft-type-indicator ft-type-p">P</span>`;
      rowP.appendChild(cellTypeP);

      // Pressure values for positions 1-6
      for (let pos = 1; pos <= 6; pos++) {
        const td = document.createElement('td');
        const psi = data.pressure[pos];
        const alert = data.alerts[pos] || 'None';
        if (psi != null) {
          const cls = alertSeverity(alert) >= 2 ? 'val-critical' : alertSeverity(alert) >= 1 ? 'val-warn' : 'val-ok';
          td.innerHTML = `<span class="ft-val ${cls}">${psi.toFixed(0)}</span>`;
        } else {
          td.innerHTML = `<span class="ft-val val-nodata">--</span>`;
        }
        rowP.appendChild(td);
      }

      // Age cell (spans 3 rows)
      const cellAge = document.createElement('td');
      cellAge.rowSpan = 3;
      const ageClass = ageStr === 'offline' ? 'age-offline' : (parseInt(ageStr) > 15 ? 'age-stale' : '');
      cellAge.innerHTML = `<span class="ft-age-val ${ageClass}">${ageStr}</span>`;
      rowP.appendChild(cellAge);

      dom.fleetTbody.appendChild(rowP);

      // ── Row 2: Temperature (T) ──
      const rowT = document.createElement('tr');
      rowT.className = 'ft-row-t';
      rowT.dataset.vehicleId = vid;

      const cellTypeT = document.createElement('td');
      cellTypeT.innerHTML = `<span class="ft-type-indicator ft-type-t">T</span>`;
      rowT.appendChild(cellTypeT);

      for (let pos = 1; pos <= 6; pos++) {
        const td = document.createElement('td');
        const temp = data.temp[pos];
        if (temp != null) {
          td.innerHTML = `<span class="ft-val val-ok">${temp.toFixed(0)}</span>`;
        } else {
          td.innerHTML = `<span class="ft-val val-nodata">--</span>`;
        }
        rowT.appendChild(td);
      }
      dom.fleetTbody.appendChild(rowT);

      // ── Row 3: Cold pressure (C) ──
      const rowC = document.createElement('tr');
      rowC.className = 'ft-row-c';
      rowC.dataset.vehicleId = vid;

      const cellTypeC = document.createElement('td');
      cellTypeC.innerHTML = `<span class="ft-type-indicator ft-type-c">C</span>`;
      rowC.appendChild(cellTypeC);

      for (let pos = 1; pos <= 6; pos++) {
        const td = document.createElement('td');
        const cold = data.cold[pos];
        const alert = data.alerts[pos] || 'None';
        if (cold != null) {
          const cls = alertSeverity(alert) >= 2 ? 'val-critical' : alertSeverity(alert) >= 1 ? 'val-warn' : 'val-ok';
          td.innerHTML = `<span class="ft-val ${cls}">${cold.toFixed(0)}</span>`;
        } else {
          td.innerHTML = `<span class="ft-val val-nodata">--</span>`;
        }
        rowC.appendChild(td);
      }
      dom.fleetTbody.appendChild(rowC);
    });

    // Update summary stats
    dom.fleetStatTotal.querySelector('.fs-num').textContent = counts.total;
    dom.fleetStatOk.querySelector('.fs-num').textContent = counts.ok;
    dom.fleetStatWarn.querySelector('.fs-num').textContent = counts.warn;
    dom.fleetStatCritical.querySelector('.fs-num').textContent = counts.critical;
    dom.fleetStatOffline.querySelector('.fs-num').textContent = counts.offline;

    // Update refresh timestamp
    if (state.fleetLastUpdate) {
      dom.fleetLastUpdate.textContent = 'Updated: ' + state.fleetLastUpdate.toLocaleTimeString();
    }

    // Render active alerts table
    renderFleetAlerts(alerts);

    // Update map markers
    renderFleetMap();
  }

  function getDataAge(lastContact) {
    if (!lastContact) return 'offline';
    const now = new Date();
    const last = new Date(lastContact);
    const diffMs = now - last;
    if (diffMs < 0 || isNaN(diffMs)) return '—';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return '<1m';
    if (mins < 60) return mins + 'm';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h';
    return Math.floor(hrs / 24) + 'd';
  }

  function renderFleetAlerts(alerts) {
    if (alerts.length === 0) {
      dom.fleetAlertsSection.style.display = 'none';
      return;
    }
    dom.fleetAlertsSection.style.display = '';
    dom.fleetAlertsTbody.innerHTML = '';
    // Sort: Level2 first, then Level1
    alerts.sort((a, b) => alertSeverity(b.severity) - alertSeverity(a.severity));
    alerts.forEach(al => {
      const tr = document.createElement('tr');
      const sevClass = al.severity === 'Level2' ? 'sev-critical' : 'sev-warn';
      const sevLabel = al.severity === 'Level2' ? 'Critical' : 'Warning';
      tr.innerHTML = `
        <td>${escapeHtml(al.type)}</td>
        <td class="${sevClass}">${sevLabel}</td>
        <td>${escapeHtml(al.vehicle)} / P${al.position}</td>
        <td>${al.psi != null ? al.psi.toFixed(0) + ' PSI' : '—'}${al.temp != null ? ' / ' + al.temp.toFixed(0) + '°C' : ''}</td>
      `;
      dom.fleetAlertsTbody.appendChild(tr);
    });
  }

  function drillDown(truck) {
    stopFleetAutoRefresh();
    state.selectedVehicle = truck;
    dom.vehiclesList.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', Number(el.dataset.vehicleId) === truck.vehicleId);
    });
    showScreen(dom.dashboardScreen);
    updateVehicleInfo(truck);
    setDefaultDateRange();
    fetchVehicleData();
  }

  // ===================================================================
  //  FLEET MAP — Leaflet-based truck location map
  // ===================================================================

  function initFleetMap() {
    if (state.fleetMap) return; // already initialised
    if (typeof L === 'undefined') return; // Leaflet not loaded

    state.fleetMap = L.map(dom.fleetMapContainer, {
      center: [-22.72, 119.95], // Roy Hill Mine, Pilbara WA
      zoom: 12,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.fleetMap);

    // Force a size recalculation after the container becomes visible
    setTimeout(() => { state.fleetMap.invalidateSize(); }, 200);
  }

  function renderFleetMap() {
    if (!state.fleetMap) return;

    // Clear old markers
    state.fleetMarkers.forEach(m => m.remove());
    state.fleetMarkers = [];
    const bounds = [];
    Object.entries(state.fleetGps).forEach(([vehicleId, point]) => {
      const vid = Number(vehicleId);
      const truck = state.fleetVehicles.find(t => t.vehicleId === vid);
      if (!truck || !point) return;

      const status = getTruckStatus(vid);
      const truckName = truck.name.trim().split(/\s+/)[0];

      const icon = L.divIcon({
        className: '',
        html: `<div class="truck-marker marker-${status}">${escapeHtml(truckName)}</div>`,
        iconSize: [46, 18],
        iconAnchor: [23, 9]
      });

      const marker = L.marker([point.lat, point.lng], { icon }).addTo(state.fleetMap);

      const data = state.fleetData[vid] || { pressure: {}, temp: {}, alerts: {} };
      const pressures = Object.values(data.pressure).map(v => v.toFixed(0) + ' PSI').join(', ') || '—';
      const temps = Object.values(data.temp).map(v => v.toFixed(0) + '°C').join(', ') || '—';
      const statusLabel = status === 'ok' ? '✅ OK' : status === 'warn' ? '⚠️ Warning' : status === 'critical' ? '🔴 Critical' : '⚪ Offline';

      marker.bindPopup(`
        <div class="popup-truck-name">${escapeHtml(truck.name)}</div>
        <div class="popup-status">${statusLabel}</div>
        <div style="margin-top:4px"><strong>P:</strong> ${pressures}</div>
        <div><strong>T:</strong> ${temps}</div>
      `, { maxWidth: 250 });

      marker.on('click', () => drillDown(truck));
      state.fleetMarkers.push(marker);
      bounds.push([point.lat, point.lng]);
    });

    if (bounds.length > 0) {
      state.fleetMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
  }

  function startFleetAutoRefresh() {
    stopFleetAutoRefresh();
    state.fleetCountdown = FLEET_REFRESH_INTERVAL;
    dom.fleetCountdown.textContent = state.fleetCountdown + 's';

    state.fleetCountdownTimer = setInterval(() => {
      state.fleetCountdown--;
      dom.fleetCountdown.textContent = state.fleetCountdown + 's';
      if (state.fleetCountdown <= 0) {
        state.fleetCountdown = FLEET_REFRESH_INTERVAL;
        refreshFleetOverview().catch(() => {});
      }
    }, 1000);
  }

  function stopFleetAutoRefresh() {
    if (state.fleetCountdownTimer) {
      clearInterval(state.fleetCountdownTimer);
      state.fleetCountdownTimer = null;
    }
  }

  async function runRequestPool(tasks, concurrency) {
    const results = new Array(tasks.length);
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < tasks.length) {
        const currentIndex = nextIndex++;
        try {
          results[currentIndex] = { status: 'fulfilled', value: await tasks[currentIndex]() };
        } catch (error) {
          results[currentIndex] = { status: 'rejected', reason: error };
        }
      }
    }

    const workerCount = Math.min(concurrency, tasks.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
  }

  // ---- Escape HTML ----
  function escapeHtml(str) {
    if (str == null) return '';
    const text = String(str);
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  // ---- Diagnostics ----
  async function runDiagnostics() {
    dom.diagModal.style.display = 'flex';
    dom.diagResults.innerHTML = '<p style="color:var(--text-muted)">Running diagnostics for <strong>' + escapeHtml(API_HOST) + '</strong>...</p>';
    try {
      const headers = {};
      if (JWT_TOKEN) {
        headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
      }
      const resp = await fetch('/api/check?host=' + encodeURIComponent(API_HOST), { headers });
      const data = await resp.json();
      let html = '';

      (data.checks || []).forEach(c => {
        const icon = c.status === 'OK' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
        html += `<div class="diag-check">
          <span class="diag-icon">${icon}</span>
          <div>
            <div class="diag-label">${escapeHtml(c.test)}</div>
            <div class="diag-detail">${escapeHtml(c.detail || '')}</div>
            ${c.hint ? '<div class="diag-hint">' + escapeHtml(c.hint) + '</div>' : ''}
          </div>
        </div>`;
      });

      if (data.summary) {
        html += '<div class="diag-summary">' + escapeHtml(data.summary) + '</div>';
      }

      dom.diagResults.innerHTML = html || '<p>No diagnostic results returned.</p>';
    } catch (err) {
      dom.diagResults.innerHTML = '<p style="color:var(--danger)">Diagnostics request failed: ' + escapeHtml(err.message) + '</p>';
    }
  }

  // ---- Save Settings ----
  function saveSettings() {
    const host = dom.settingHost.value.trim();
    const token = dom.settingToken.value.trim();
    if (host) API_HOST = host;
    JWT_TOKEN = token;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ host: API_HOST, token: JWT_TOKEN }));
    toast('Settings saved. Click Connect to API to use new settings.', 'success');
  }

  // ---- Load persisted settings ----
  try {
    const saved = window.localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.host) API_HOST = parsed.host;
      if (parsed.token) JWT_TOKEN = parsed.token;
    }
  } catch (_) { /* ignore invalid stored settings */ }

  // ---- Populate settings fields ----
  dom.settingHost.value = API_HOST;
  dom.settingToken.value = JWT_TOKEN;

  // ---- Event Listeners ----
  dom.connectBtn.addEventListener('click', connect);
  if (dom.diagnoseBtn) {
    dom.diagnoseBtn.addEventListener('click', runDiagnostics);
  }
  dom.saveSettingsBtn.addEventListener('click', saveSettings);
  dom.closeDiagBtn.addEventListener('click', () => { dom.diagModal.style.display = 'none'; });
  dom.diagModal.addEventListener('click', (e) => { if (e.target === dom.diagModal) dom.diagModal.style.display = 'none'; });
  dom.dismissBannerBtn.addEventListener('click', hideDemoBanner);
  if (dom.demoBtn) {
    dom.demoBtn.addEventListener('click', () => {
      showLoading('Loading sample data for preview...');
      setTimeout(() => {
        startDemoMode();
        hideLoading();
        toast('Sample data loaded — this is NOT real truck data', 'info');
      }, 300);
    });
  }
  dom.fetchDataBtn.addEventListener('click', fetchVehicleData);
  dom.vehicleSearch.addEventListener('input', (e) => {
    renderVehicles(e.target.value);
  });

  // Fleet event listeners
  dom.fleetBtn.addEventListener('click', openFleetOverview);
  dom.fleetRefreshBtn.addEventListener('click', () => refreshFleetOverview());
  dom.fleetSort.addEventListener('change', () => renderFleetGrid());

  // Initialize default dates
  setDefaultDateRange();

})();
