'use strict';

const { getApiHost, getAuthHeader, proxyHttpsRequest, sendJson } = require('./_lib/proxy');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Api-Host');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const authHeader = getAuthHeader(req);
  if (!authHeader) {
    sendJson(res, 500, {
      error: 'Missing API token',
      details: 'Set TYRESENSE_JWT_TOKEN in Vercel environment variables.'
    });
    return;
  }

  const host = getApiHost(req);

  // Path comes from vercel.json rewrite: /api/(.*) -> /api/proxy?__proxy_path=$1
  const proxyPath = req.query.__proxy_path || '';
  const query = { ...req.query };
  delete query.__proxy_path;

  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item));
    } else if (value != null) {
      search.append(key, value);
    }
  });

  const upstreamPath = `/${proxyPath}${search.toString() ? `?${search.toString()}` : ''}`;

  try {
    const response = await proxyHttpsRequest({
      host,
      path: upstreamPath,
      headers: {
        Authorization: authHeader,
        Accept: 'application/json'
      }
    });

    res.status(response.statusCode);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/json');
    res.send(response.body);
  } catch (error) {
    sendJson(res, 502, {
      error: 'API unreachable',
      details: error.message,
      host
    });
  }
};
