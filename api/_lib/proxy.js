'use strict';

const https = require('https');
const dns = require('dns').promises;

const DEFAULT_HOST = process.env.TYRESENSE_API_HOST || 'australia.tyresense.com';
const DEFAULT_TIMEOUT_MS = 15000;

function getApiHost(req) {
  return req.headers['x-api-host'] || process.env.TYRESENSE_API_HOST || DEFAULT_HOST;
}

function getAuthHeader(req) {
  const incoming = req.headers.authorization;
  if (incoming) return incoming;

  const token = process.env.TYRESENSE_JWT_TOKEN || process.env.JWT_SECRET;
  if (!token) return null;
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

function proxyHttpsRequest({ host, path, headers }) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      port: 443,
      path,
      method: 'GET',
      headers,
      rejectUnauthorized: false,
      timeout: DEFAULT_TIMEOUT_MS
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode || 500, headers: res.headers, body }));
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Upstream timeout')));
    req.end();
  });
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

async function runDiagnostics(host, authorization) {
  const results = { host, timestamp: new Date().toISOString(), checks: [] };

  try {
    const addrs = await dns.resolve4(host);
    results.checks.push({ test: 'DNS Resolution', status: 'OK', detail: addrs.join(', ') });
  } catch (error) {
    results.checks.push({ test: 'DNS Resolution', status: 'FAIL', detail: error.code || error.message });
    return results;
  }

  if (!authorization) {
    results.checks.push({
      test: 'API Authentication',
      status: 'FAIL',
      detail: 'Missing TYRESENSE_JWT_TOKEN / JWT_SECRET server environment variable'
    });
    return results;
  }

  try {
    const response = await proxyHttpsRequest({
      host,
      path: '/da/areas',
      headers: {
        Authorization: authorization,
        Accept: 'application/json'
      }
    });
    const ok = response.statusCode === 200;
    results.checks.push({
      test: 'HTTPS API Request',
      status: ok ? 'OK' : 'FAIL',
      detail: `Status ${response.statusCode}`
    });
  } catch (error) {
    results.checks.push({
      test: 'HTTPS API Request',
      status: 'FAIL',
      detail: error.message,
      hint: 'Check Vercel environment variables and upstream network access.'
    });
  }

  return results;
}

module.exports = {
  DEFAULT_HOST,
  getApiHost,
  getAuthHeader,
  proxyHttpsRequest,
  runDiagnostics,
  sendJson
};