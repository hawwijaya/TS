'use strict';

const { DEFAULT_HOST, getAuthHeader, runDiagnostics, sendJson } = require('./_lib/proxy');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const host = req.query.host || DEFAULT_HOST;
  const authHeader = getAuthHeader(req);
  const results = await runDiagnostics(host, authHeader);
  sendJson(res, 200, results);
};