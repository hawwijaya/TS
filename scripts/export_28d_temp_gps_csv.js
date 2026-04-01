const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const API_PROTOCOL = process.env.TYRESENSE_API_PROTOCOL || 'https';
const API_HOST = process.env.TYRESENSE_API_HOST || 'australia.tyresense.com';
const API_BASE = `${API_PROTOCOL}://${API_HOST}`;
const AREA_ID = 32;
const LOOKBACK_DAYS = 28;
const OUTPUT_DIR = path.join(__dirname, '..', 'exports');
const TARGET_PATTERN = /EH5000|793F|793'F/;
const TRUCK_FRACTION = Number(process.env.TRUCK_FRACTION || '0.5');
const CONCURRENCY = 2;
const GPS_CHUNK_DAYS = 7;
const GPS_BATCH_SIZE = 1;
const GPS_CONCURRENCY = 4;
const MAX_RETRIES = 4;
const RAW_TOKEN = process.env.TYRESENSE_JWT_TOKEN || process.env.JWT_SECRET || '';
const AUTH_TOKEN = RAW_TOKEN && /^Bearer\s/i.test(RAW_TOKEN) ? RAW_TOKEN : (RAW_TOKEN ? `Bearer ${RAW_TOKEN}` : '');

function normaliseModel(name) {
  const match = String(name || '').match(TARGET_PATTERN);
  return match ? match[0].replace("793'F", '793F') : '';
}

function clampFraction(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function selectTruckSubset(trucks, fraction) {
  const safeFraction = clampFraction(fraction);
  const sorted = [...trucks].sort((left, right) => left.vehicleName.localeCompare(right.vehicleName));
  if (safeFraction >= 1) {
    return sorted;
  }

  const desiredTotal = Math.max(1, Math.round(sorted.length * safeFraction));
  const byModel = new Map();
  for (const truck of sorted) {
    if (!byModel.has(truck.model)) {
      byModel.set(truck.model, []);
    }
    byModel.get(truck.model).push(truck);
  }

  const modelEntries = [...byModel.entries()].map(([model, items]) => {
    const raw = items.length * safeFraction;
    const count = Math.min(items.length, Math.floor(raw));
    return { model, items, raw, count, remainder: raw - Math.floor(raw) };
  });

  let assigned = modelEntries.reduce((sum, entry) => sum + entry.count, 0);
  modelEntries
    .sort((left, right) => right.remainder - left.remainder || left.model.localeCompare(right.model));

  for (const entry of modelEntries) {
    if (assigned >= desiredTotal) {
      break;
    }
    if (entry.count < entry.items.length) {
      entry.count += 1;
      assigned += 1;
    }
  }

  while (assigned > desiredTotal) {
    const removable = modelEntries.find((entry) => entry.count > 0);
    if (!removable) {
      break;
    }
    removable.count -= 1;
    assigned -= 1;
  }

  return modelEntries
    .sort((left, right) => left.model.localeCompare(right.model))
    .flatMap((entry) => entry.items.slice(0, entry.count))
    .sort((left, right) => left.vehicleName.localeCompare(right.vehicleName));
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows, headers) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

async function requestText(targetUrl, redirectCount = 0) {
  const transport = targetUrl.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      targetUrl,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(AUTH_TOKEN ? { Authorization: AUTH_TOKEN } : {})
        },
        rejectUnauthorized: false
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
            if (redirectCount >= 5) {
              reject(new Error(`Too many redirects for ${targetUrl}`));
              return;
            }
            const nextUrl = new URL(response.headers.location, targetUrl);
            resolve(requestText(nextUrl, redirectCount + 1));
            return;
          }
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GET ${targetUrl.pathname}${targetUrl.search} failed: ${response.statusCode} ${body.slice(0, 300)}`));
            return;
          }
          resolve(body);
        });
      }
    );

    request.on('error', reject);
    request.end();
  });

}

async function apiGetJson(relativePath) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const targetUrl = new URL(`${API_BASE}${relativePath}`);
      const text = await requestText(targetUrl);
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      const message = String(error && error.message ? error.message : error);
      const retryable = /\b(500|502|503|504)\b/.test(message) || /timed out/i.test(message);
      if (!retryable || attempt === MAX_RETRIES) {
        throw error;
      }
      const delayMs = attempt * 5000;
      console.warn(`Retry ${attempt}/${MAX_RETRIES - 1} for ${relativePath} after ${delayMs}ms`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function consume() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => consume());
  await Promise.all(workers);
  return results;
}

function parseGps(value) {
  if (!value) {
    return { latitude: '', longitude: '' };
  }

  if (typeof value === 'string') {
    const parts = value.split(',').map((part) => part.trim());
    if (parts.length >= 2) {
      return { latitude: parts[0], longitude: parts[1] };
    }
  }

  if (typeof value === 'object') {
    return {
      latitude: value.latitude ?? value.lat ?? '',
      longitude: value.longitude ?? value.lng ?? value.lon ?? ''
    };
  }

  return { latitude: '', longitude: '' };
}

function buildDateChunks(start, end, chunkDays) {
  const chunks = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const next = new Date(Math.min(end.getTime(), cursor.getTime() + chunkDays * 24 * 60 * 60 * 1000));
    chunks.push({ start: new Date(cursor), end: next });
    cursor = next;
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendCsvRows(filePath, rows, headers) {
  if (!rows.length) {
    return;
  }
  const exists = fs.existsSync(filePath);
  const content = toCsv(rows, headers);
  if (!exists) {
    fs.writeFileSync(filePath, content, 'utf8');
    return;
  }
  const lines = content.split('\n');
  lines.shift();
  const body = lines.join('\n');
  if (body.trim()) {
    fs.appendFileSync(filePath, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
  }
}

function getCheckpointPaths() {
  const scopeLabel = `${Math.round(clampFraction(TRUCK_FRACTION) * 100)}pct`;
  const baseName = `eh5000_793f_last_${LOOKBACK_DAYS}d_${scopeLabel}`;
  return {
    tempFile: path.join(OUTPUT_DIR, `${baseName}_temperature.csv`),
    gpsFile: path.join(OUTPUT_DIR, `${baseName}_gps.csv`),
    checkpointFile: path.join(OUTPUT_DIR, `${baseName}.checkpoint.json`)
  };
}

function createCheckpoint(startTime, endTime) {
  return {
    startTime,
    endTime,
    completedTemperatureVehicleIds: [],
    completedGpsChunks: {}
  };
}

function loadCheckpoint(paths, startTime, endTime) {
  if (!fs.existsSync(paths.checkpointFile)) {
    if (fs.existsSync(paths.tempFile)) {
      fs.unlinkSync(paths.tempFile);
    }
    if (fs.existsSync(paths.gpsFile)) {
      fs.unlinkSync(paths.gpsFile);
    }
    return createCheckpoint(startTime, endTime);
  }
  const parsed = JSON.parse(fs.readFileSync(paths.checkpointFile, 'utf8'));
  return {
    startTime: parsed.startTime || startTime,
    endTime: parsed.endTime || endTime,
    completedTemperatureVehicleIds: Array.isArray(parsed.completedTemperatureVehicleIds) ? parsed.completedTemperatureVehicleIds : [],
    completedGpsChunks: parsed.completedGpsChunks && typeof parsed.completedGpsChunks === 'object' ? parsed.completedGpsChunks : {}
  };
}

function saveCheckpoint(paths, checkpoint) {
  fs.writeFileSync(paths.checkpointFile, JSON.stringify(checkpoint, null, 2), 'utf8');
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const now = new Date();
  const start = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const paths = getCheckpointPaths();
  const initialCheckpoint = loadCheckpoint(paths, start.toISOString(), now.toISOString());
  const startTime = initialCheckpoint.startTime;
  const endTime = initialCheckpoint.endTime;
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  const gpsChunks = buildDateChunks(startDate, endDate, GPS_CHUNK_DAYS);
  const checkpoint = initialCheckpoint;

  saveCheckpoint(paths, checkpoint);

  console.log(`Loading vehicles for area ${AREA_ID}...`);
  const vehicles = await apiGetJson(`/da/vehicles/area/${AREA_ID}`);
  const allTargets = vehicles
    .filter((vehicle) => vehicle.type === 'haultruck' && TARGET_PATTERN.test(vehicle.name || ''))
    .map((vehicle) => ({
      vehicleId: vehicle.vehicleId,
      vehicleName: (vehicle.name || '').trim(),
      model: normaliseModel(vehicle.name),
      lastContact: vehicle.lastContact || ''
    }));
  const targets = selectTruckSubset(allTargets, TRUCK_FRACTION);

  console.log(`Found ${allTargets.length} target haul trucks.`);
  console.log(`Export scope reduced to ${targets.length} trucks (${Math.round(clampFraction(TRUCK_FRACTION) * 100)}%).`);
  const trucksById = new Map(targets.map((truck) => [truck.vehicleId, truck]));
  const completedTemperature = new Set(checkpoint.completedTemperatureVehicleIds);

  console.log('Exporting GPS history...');
  const gpsBatches = [];
  for (let index = 0; index < targets.length; index += GPS_BATCH_SIZE) {
    gpsBatches.push(targets.slice(index, index + GPS_BATCH_SIZE));
  }

  await runPool(
    gpsBatches,
    async (batch, batchIndex) => {
      const batchIds = batch.map((truck) => truck.vehicleId).join(',');
      console.log(`GPS batch ${batchIndex + 1}/${gpsBatches.length}: ${batch.length} trucks`);
      for (let chunkIndex = 0; chunkIndex < gpsChunks.length; chunkIndex++) {
        const chunk = gpsChunks[chunkIndex];
        const batchNeedsChunk = batch.some((truck) => {
          const completedChunks = checkpoint.completedGpsChunks[String(truck.vehicleId)] || [];
          return !completedChunks.includes(chunkIndex);
        });

        if (!batchNeedsChunk) {
          continue;
        }

        const gpsItems = await apiGetJson(
          `/da/vehicledata/${batchIds}?${new URLSearchParams({
            startTime: chunk.start.toISOString(),
            endTime: chunk.end.toISOString(),
            vehicleValues: 'GpsPosition'
          }).toString()}`
        );

        const rows = [];

        for (const item of gpsItems) {
          const truck = trucksById.get(item.vehicleId);
          if (!truck) {
            continue;
          }
          const values = Array.isArray(item.values) ? item.values : [];
          for (const sample of values) {
            const gps = parseGps(sample.value);
            rows.push({
              vehicleId: truck.vehicleId,
              vehicleName: truck.vehicleName,
              model: truck.model,
              lastContact: truck.lastContact,
              sampleStart: sample.start ?? sample.timestamp ?? sample.time ?? '',
              sampleEnd: sample.end ?? '',
              gpsRaw: sample.value ?? '',
              latitude: gps.latitude,
              longitude: gps.longitude
            });
          }
        }

        appendCsvRows(paths.gpsFile, rows, [
          'vehicleId',
          'vehicleName',
          'model',
          'lastContact',
          'sampleStart',
          'sampleEnd',
          'gpsRaw',
          'latitude',
          'longitude'
        ]);

        for (const truck of batch) {
          const key = String(truck.vehicleId);
          const completedChunks = checkpoint.completedGpsChunks[key] || [];
          if (!completedChunks.includes(chunkIndex)) {
            completedChunks.push(chunkIndex);
            checkpoint.completedGpsChunks[key] = completedChunks.sort((a, b) => a - b);
          }
        }
        saveCheckpoint(paths, checkpoint);
      }
    },
    GPS_CONCURRENCY
  );

  await runPool(
    targets,
    async (truck, index) => {
      if (completedTemperature.has(truck.vehicleId)) {
        return;
      }

      const progress = `${index + 1}/${targets.length}`;
      console.log(`Exporting ${progress}: ${truck.vehicleName}`);

      const tempPath = `/da/wheeldata/${truck.vehicleId}?${new URLSearchParams({
        startTime,
        endTime,
        wheelValues: 'Temperature'
      }).toString()}`;

      const temperatureItems = await apiGetJson(tempPath);
      const rows = [];

      for (const item of temperatureItems) {
        const values = Array.isArray(item.values) ? item.values : [];
        for (const sample of values) {
          rows.push({
            vehicleId: truck.vehicleId,
            vehicleName: truck.vehicleName,
            model: truck.model,
            lastContact: truck.lastContact,
            position: item.position ?? '',
            sampleStart: sample.start ?? sample.timestamp ?? sample.time ?? '',
            sampleEnd: sample.end ?? '',
            temperatureC: sample.value ?? ''
          });
        }
      }

      appendCsvRows(paths.tempFile, rows, [
        'vehicleId',
        'vehicleName',
        'model',
        'lastContact',
        'position',
        'sampleStart',
        'sampleEnd',
        'temperatureC'
      ]);

      checkpoint.completedTemperatureVehicleIds.push(truck.vehicleId);
      completedTemperature.add(truck.vehicleId);
      saveCheckpoint(paths, checkpoint);
    },
    CONCURRENCY
  );

  fs.unlinkSync(paths.checkpointFile);
  console.log(`Saved: ${paths.tempFile}`);
  console.log(`Saved: ${paths.gpsFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});