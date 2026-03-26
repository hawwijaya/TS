const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3001;
let apiHost = 'australia.tyresense.com';
let apiProtocol = 'https';
let apiPort = 443;
const STATIC_DIR = __dirname;
const envToken = process.env.TYRESENSE_JWT_TOKEN || process.env.JWT_SECRET || '';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type, X-Api-Host, X-Api-Protocol, X-Api-Port',
  'access-control-allow-methods': 'GET, POST, OPTIONS'
};

// Proxy an API request, trying HTTPS first, then HTTP fallback
function proxyRequest(targetHost, targetPath, reqHeaders, res) {
  const headers = { ...reqHeaders, host: targetHost };
  delete headers['origin'];
  delete headers['referer'];
  if (!headers.authorization && envToken) {
    headers.authorization = envToken.startsWith('Bearer ') ? envToken : `Bearer ${envToken}`;
  }

  function tryHttps() {
    const opts = {
      hostname: targetHost,
      port: 443,
      path: targetPath,
      method: 'GET',
      headers,
      rejectUnauthorized: false,
      timeout: 12000
    };
    const proxy = https.request(opts, (apiRes) => {
      const respHeaders = { ...apiRes.headers, ...CORS_HEADERS };
      res.writeHead(apiRes.statusCode, respHeaders);
      apiRes.pipe(res, { end: true });
    });
    proxy.on('error', (err) => {
      console.error('HTTPS proxy error:', err.message);
      tryHttp();
    });
    proxy.on('timeout', () => {
      proxy.destroy();
      tryHttp();
    });
    proxy.end();
  }

  function tryHttp() {
    const opts = {
      hostname: targetHost,
      port: 80,
      path: targetPath,
      method: 'GET',
      headers,
      timeout: 10000
    };
    const proxy = http.request(opts, (apiRes) => {
      const respHeaders = { ...apiRes.headers, ...CORS_HEADERS };
      res.writeHead(apiRes.statusCode, respHeaders);
      apiRes.pipe(res, { end: true });
    });
    proxy.on('error', (err) => {
      console.error('HTTP proxy error:', err.message);
      res.writeHead(502, { 'content-type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({
        error: 'API unreachable',
        details: `Could not connect to ${targetHost} via HTTPS or HTTP.`,
        host: targetHost,
        troubleshooting: [
          'Ensure you are NOT connected to a VPN — VPN may block the API.',
          'Verify the API host URL is correct in Settings.',
          'Check that your network allows HTTPS to australia.tyresense.com.',
          'Contact RIMEX TyreSense support: info@rimex.com'
        ]
      }));
    });
    proxy.on('timeout', () => {
      proxy.destroy();
      res.writeHead(504, { 'content-type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ error: 'Connection timeout', host: targetHost }));
    });
    proxy.end();
  }

  tryHttps();
}

// Diagnostics endpoint — checks connectivity to API host
function runDiagnostics(targetHost, callback) {
  const results = { host: targetHost, timestamp: new Date().toISOString(), checks: [] };
  const net = require('net');
  const dns = require('dns');

  // DNS check
  dns.resolve4(targetHost, (err, addrs) => {
    results.checks.push({
      test: 'DNS Resolution',
      status: err ? 'FAIL' : 'OK',
      detail: err ? err.code : addrs.join(', ')
    });

    if (err) return callback(results);

    let remaining = 2;
    function done() { if (--remaining === 0) callback(results); }

    // TCP port 443 check
    const sock443 = new net.Socket();
    sock443.setTimeout(5000);
    sock443.connect(443, targetHost, () => {
      results.checks.push({ test: 'TCP Port 443', status: 'OK', detail: 'Port open' });
      sock443.destroy();

      // TLS check
      const tls = require('tls');
      const tlsSock = tls.connect({
        host: targetHost, port: 443,
        rejectUnauthorized: false,
        timeout: 5000
      });
      tlsSock.on('secureConnect', () => {
        results.checks.push({ test: 'TLS Handshake', status: 'OK', detail: tlsSock.getProtocol() });
        tlsSock.destroy();
        done();
      });
      tlsSock.on('error', (e) => {
        results.checks.push({
          test: 'TLS Handshake',
          status: 'FAIL',
          detail: e.message.split('\n')[0],
          hint: 'TLS connection failed. Ensure VPN is disconnected — VPN may block this server.'
        });
        done();
      });
      tlsSock.on('timeout', () => {
        tlsSock.destroy();
        results.checks.push({ test: 'TLS Handshake', status: 'FAIL', detail: 'Timeout' });
        done();
      });
    });
    sock443.on('error', (e) => {
      results.checks.push({ test: 'TCP Port 443', status: 'FAIL', detail: e.code });
      done();
    });
    sock443.on('timeout', () => {
      sock443.destroy();
      results.checks.push({ test: 'TCP Port 443', status: 'FAIL', detail: 'Timeout' });
      done();
    });

    // TCP port 80 + HTTP check
    const req80 = http.request({
      hostname: targetHost, port: 80, path: '/da/areas',
      method: 'GET', timeout: 5000
    }, (r) => {
      let body = '';
      r.on('data', c => body += c);
      r.on('end', () => {
        const isApi = r.statusCode === 200 || r.statusCode === 401;
        results.checks.push({
          test: 'HTTP Port 80 API',
          status: isApi ? 'OK' : 'FAIL',
          detail: `Status ${r.statusCode} (${isApi ? 'API responds' : 'nginx default page'})`
        });
        done();
      });
    });
    req80.on('error', (e) => {
      results.checks.push({ test: 'HTTP Port 80', status: 'FAIL', detail: e.code });
      done();
    });
    req80.on('timeout', () => {
      req80.destroy();
      results.checks.push({ test: 'HTTP Port 80', status: 'FAIL', detail: 'Timeout' });
      done();
    });
    req80.end();
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // --- Diagnostics: /api-check ---
  if (parsed.pathname === '/api-check' || parsed.pathname === '/api/check') {
    const host = parsed.query.host || apiHost;
    runDiagnostics(host, (results) => {
      res.writeHead(200, { 'content-type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify(results, null, 2));
    });
    return;
  }

  // --- API proxy: /api/* ---
  if (parsed.pathname.startsWith('/api/')) {
    const targetHost = req.headers['x-api-host'] || apiHost;
    const apiPath = parsed.pathname.replace(/^\/api/, '');
    const search = parsed.search || '';
    proxyRequest(targetHost, apiPath + search, req.headers, res);
    return;
  }

  // --- Static file serving ---
  let filePath = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(STATIC_DIR, filePath);

  if (!fullPath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'content-type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  TyreSense Dashboard Server`);
  console.log(`  ─────────────────────────`);
  console.log(`  Local:  http://localhost:${PORT}`);
  console.log(`  API proxy: /api/* → ${apiHost} (HTTPS→HTTP fallback)`);
  console.log(`  Diagnostics: http://localhost:${PORT}/api/check\n`);
});
