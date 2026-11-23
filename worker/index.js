const emojiNames = ['fire', 'heart', 'eyes', 'melt'];
const textEncoder = new TextEncoder();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((item) => item.trim());
  return origin && allowed.includes(origin) ? origin : null;
}

function respond(request, env, data, status = 200) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  });
  const origin = allowedOrigin(request, env);
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(data === null ? null : JSON.stringify(data), { status, headers });
}

function validTrackId(id) {
  return typeof id === 'string' && id.length <= 180 && /^(?:beats\/)?[^/\\\x00-\x1f]{1,160}\.(?:mp3|wav)$/i.test(id);
}

function validToken(token) {
  return typeof token === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(token);
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function tokenHash(trackId, token) {
  return hex(await crypto.subtle.digest('SHA-256', textEncoder.encode(`${trackId}\0${token}`)));
}

async function parseSmallJson(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
    throw new HttpError(415, 'Expected application/json.');
  }
  if (!request.body) throw new HttpError(400, 'A JSON body is required.');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 2048) {
      await reader.cancel();
      throw new HttpError(413, 'Request body is too large.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid object');
    return data;
  } catch {
    throw new HttpError(400, 'Invalid JSON object.');
  }
}

function cleanText(value) {
  return value.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}

async function consumeLimit(request, env, scope, maximum, cooldownSeconds) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || !/^[0-9a-f:.]{3,64}$/i.test(ip) || !env.RATE_LIMIT_SECRET || env.RATE_LIMIT_SECRET.length < 32) {
    throw new HttpError(503, 'Posting is temporarily unavailable.');
  }
  const now = Math.floor(Date.now() / 1000);
  const day = Math.floor(now / 86400) * 86400;
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(env.RATE_LIMIT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bucket = hex(await crypto.subtle.sign('HMAC', key, textEncoder.encode(`${scope}:${day}:${ip}`)));
  // Old daily hashes expire; raw IP addresses are never stored.
  await env.DB.prepare('DELETE FROM rate_limits WHERE day_start < ?').bind(day - 7 * 86400).run();
  const row = await env.DB.prepare(`
    INSERT INTO rate_limits (bucket_key, day_start, attempts, last_at) VALUES (?, ?, 1, ?)
    ON CONFLICT(bucket_key) DO UPDATE SET attempts = attempts + 1, last_at = excluded.last_at
    WHERE attempts < ? AND last_at <= ?
    RETURNING attempts
  `).bind(bucket, day, now, maximum, now - cooldownSeconds).first();
  if (!row) throw new HttpError(429, 'Too many requests. Please try again later.');
}

async function reactionState(env, trackId, token) {
  const rows = await env.DB.prepare('SELECT emoji, COUNT(*) AS total FROM reactions WHERE track_id = ? GROUP BY emoji').bind(trackId).all();
  const counts = Object.fromEntries(emojiNames.map((emoji) => [emoji, 0]));
  for (const row of rows.results ?? []) counts[row.emoji] = row.total;
  const selected = token
    ? (await env.DB.prepare('SELECT emoji FROM reactions WHERE track_id = ? AND token_hash = ?').bind(trackId, await tokenHash(trackId, token)).first())?.emoji ?? null
    : null;
  return { trackId, counts, selected };
}

async function handleRequest(request, env) {
  try {
    const origin = request.headers.get('Origin');
    if (origin && !allowedOrigin(request, env)) throw new HttpError(403, 'Origin is not allowed.');
    const { pathname, searchParams } = new URL(request.url);
    if (!['/api/reactions', '/api/guestbook'].includes(pathname)) throw new HttpError(404, 'Not found.');
    if (request.method === 'OPTIONS') {
      if (!allowedOrigin(request, env)) throw new HttpError(403, 'Origin is not allowed.');
      const response = respond(request, env, null, 204);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Reaction-Token');
      response.headers.set('Access-Control-Max-Age', '600');
      return response;
    }
    if (!env.DB) throw new HttpError(503, 'Radio social features are unavailable.');

    if (pathname === '/api/reactions' && request.method === 'GET') {
      const trackId = searchParams.get('trackId');
      const token = request.headers.get('X-Reaction-Token');
      if (!validTrackId(trackId) || (token && !validToken(token))) throw new HttpError(400, 'Invalid track or token.');
      return respond(request, env, await reactionState(env, trackId, token));
    }
    if (pathname === '/api/reactions' && request.method === 'PUT') {
      if (!allowedOrigin(request, env)) throw new HttpError(403, 'Origin is required.');
      const data = await parseSmallJson(request);
      if (!validTrackId(data.trackId) || !validToken(data.token) || (data.emoji !== null && !emojiNames.includes(data.emoji))) {
        throw new HttpError(400, 'Invalid reaction.');
      }
      await consumeLimit(request, env, 'reactions', 100, 0);
      const hash = await tokenHash(data.trackId, data.token);
      if (data.emoji === null) {
        await env.DB.prepare('DELETE FROM reactions WHERE track_id = ? AND token_hash = ?').bind(data.trackId, hash).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO reactions (track_id, token_hash, emoji, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(track_id, token_hash) DO UPDATE SET emoji = excluded.emoji, updated_at = excluded.updated_at
        `).bind(data.trackId, hash, data.emoji, new Date().toISOString()).run();
      }
      return respond(request, env, await reactionState(env, data.trackId, data.token));
    }
    if (pathname === '/api/guestbook' && request.method === 'GET') {
      const rows = await env.DB.prepare('SELECT id, display_name AS name, message, created_at AS createdAt FROM guestbook ORDER BY id DESC LIMIT 30').all();
      return respond(request, env, { messages: rows.results ?? [] });
    }
    if (pathname === '/api/guestbook' && request.method === 'POST') {
      if (!allowedOrigin(request, env)) throw new HttpError(403, 'Origin is required.');
      const data = await parseSmallJson(request);
      if (data.website !== undefined && typeof data.website !== 'string') throw new HttpError(400, 'Invalid request.');
      if (data.website) return respond(request, env, { ok: true }, 201); // Honeypot for simple bots.
      if (data.name !== undefined && typeof data.name !== 'string' || typeof data.message !== 'string') {
        throw new HttpError(400, 'Name and message must be text.');
      }
      const name = cleanText(data.name ?? '') || 'Anonymous';
      const message = cleanText(data.message);
      if ([...name].length > 30 || !message || [...message].length > 280) throw new HttpError(400, 'Message or name is too long.');
      await consumeLimit(request, env, 'guestbook', 5, 60);
      await env.DB.prepare('INSERT INTO guestbook (display_name, message, created_at) VALUES (?, ?, ?)')
        .bind(name, message, new Date().toISOString()).run();
      return respond(request, env, { ok: true }, 201);
    }
    throw new HttpError(405, 'Method not allowed.');
  } catch (error) {
    if (error instanceof HttpError) return respond(request, env, { error: error.message }, error.status);
    console.error('Radio social API error', error);
    return respond(request, env, { error: 'Service temporarily unavailable.' }, 503);
  }
}

export { handleRequest };
export default { fetch: handleRequest };
