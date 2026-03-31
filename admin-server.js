import http from 'node:http';
import crypto from 'node:crypto';

const API_KEY = process.env.PNM_API_KEY || 'plugnmeet';
const API_SECRET = process.env.PNM_API_SECRET || 'zumyyYWqv7KR2kUqvYdq4z4sXg7XTBD2ljT6';
const PNM_HOST = process.env.PNM_API_HOST || 'http://localhost:8080';
const PORT = process.env.ADMIN_PORT || 3100;

function hmacSign(body) {
  return crypto.createHmac('sha256', API_SECRET).update(body).digest('hex');
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

async function proxyToPlugNmeet(authPath, body) {
  const signature = hmacSign(body);
  const url = `${PNM_HOST}/auth/${authPath}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API-KEY': API_KEY,
      'HASH-SIGNATURE': signature,
    },
    body,
  });

  return await res.json();
}

const routes = {
  'POST /admin-api/room/create': async (req) => {
    const body = await readBody(req);
    return await proxyToPlugNmeet('room/create', body);
  },

  'POST /admin-api/room/list': async () => {
    return await proxyToPlugNmeet('room/getActiveRoomsInfo', '{}');
  },

  'POST /admin-api/room/isActive': async (req) => {
    const body = await readBody(req);
    return await proxyToPlugNmeet('room/isRoomActive', body);
  },

  'POST /admin-api/room/end': async (req) => {
    const body = await readBody(req);
    return await proxyToPlugNmeet('room/endRoom', body);
  },

  'POST /admin-api/room/joinToken': async (req) => {
    const body = await readBody(req);
    return await proxyToPlugNmeet('room/getJoinToken', body);
  },

  'POST /admin-api/room/info': async (req) => {
    const body = await readBody(req);
    return await proxyToPlugNmeet('room/getActiveRoomInfo', body);
  },

  'POST /admin-api/room/pastRooms': async (req) => {
    const body = await readBody(req);
    return await proxyToPlugNmeet('room/fetchPastRooms', body);
  },

  'POST /admin-api/recording/list': async (req) => {
    const body = await readBody(req);
    return await proxyToPlugNmeet('recording/fetch', body);
  },

  'POST /admin-api/recording/delete': async (req) => {
    const body = await readBody(req);
    return await proxyToPlugNmeet('recording/delete', body);
  },
};

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const key = `${req.method} ${req.url.split('?')[0]}`;
  const handler = routes[key];

  if (!handler) {
    sendJson(res, 404, { status: false, msg: 'not found' });
    return;
  }

  try {
    const data = await handler(req);
    sendJson(res, 200, data);
  } catch (err) {
    console.error(`[admin-server] Error: ${err.message}`);
    sendJson(res, 500, { status: false, msg: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[admin-server] Admin API proxy running on http://0.0.0.0:${PORT}`);
  console.log(`[admin-server] Proxying to plugNmeet API at ${PNM_HOST}`);
});
