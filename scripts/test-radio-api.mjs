import assert from 'node:assert/strict';

const base = process.env.RADIO_API_TEST_URL ?? 'http://127.0.0.1:8787';
const origin = 'http://127.0.0.1:4321';
const trackId = `beats/api-check-${crypto.randomUUID()}.mp3`;
const token = crypto.randomUUID();

async function call(path, { method = 'GET', body, headers = {}, ip = '203.0.113.22' } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Origin: origin,
      'CF-Connecting-IP': ip,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json().catch(() => null), headers: response.headers };
}

const initial = await call(`/api/reactions?trackId=${encodeURIComponent(trackId)}`);
assert.equal(initial.status, 200);
assert.equal(initial.data.counts.fire, 0);

const react = (visitor, emoji) => call('/api/reactions', { method: 'PUT', body: { trackId, token: visitor, emoji } });
assert.equal((await react(token, 'fire')).data.counts.fire, 1);
assert.equal((await react(token, 'fire')).data.counts.fire, 1, 'Repeated request must not add another reaction');
const changed = await react(token, 'heart');
assert.equal(changed.data.counts.fire, 0);
assert.equal(changed.data.counts.heart, 1);
assert.equal(changed.data.selected, 'heart');

const others = Array.from({ length: 8 }, () => crypto.randomUUID());
const concurrent = await Promise.all(others.map((visitor) => react(visitor, 'heart')));
assert.ok(concurrent.every((result) => result.status === 200));
const counted = await call(`/api/reactions?trackId=${encodeURIComponent(trackId)}`, { headers: { 'X-Reaction-Token': token } });
assert.equal(counted.data.counts.heart, 9, 'Concurrent reactions must all be counted');
assert.equal(counted.data.selected, 'heart');
assert.equal((await react(token, null)).data.counts.heart, 8);

assert.equal((await react(token, 'invalid')).status, 400);
assert.equal((await call('/api/reactions?trackId=../other.mp3')).status, 400);
assert.equal((await call('/api/reactions', { method: 'PUT', body: '{bad' })).status, 400);
assert.equal((await call('/api/reactions', { method: 'PUT', body: 'x'.repeat(2500) })).status, 413);
const badOrigin = await call('/api/guestbook', { headers: { Origin: 'https://not-allowed.example' } });
assert.equal(badOrigin.status, 403);
assert.equal(badOrigin.headers.get('Access-Control-Allow-Origin'), null);

const message = `<img src=x onerror=alert(1)> ${crypto.randomUUID()}`;
const guestIp = `2001:db8::${crypto.randomUUID().slice(0, 4)}`;
const honeypot = await call('/api/guestbook', { method: 'POST', ip: guestIp, body: { name: 'Bot', message, website: 'spam.example' } });
assert.equal(honeypot.status, 201);
assert.equal((await call('/api/guestbook', { method: 'POST', ip: guestIp, body: { message: 'x'.repeat(281) } })).status, 400);
const posted = await call('/api/guestbook', { method: 'POST', ip: guestIp, body: { name: '', message } });
assert.equal(posted.status, 201);
const guestbook = await call('/api/guestbook');
assert.equal(guestbook.status, 200);
assert.equal(guestbook.data.messages[0].name, 'Anonymous');
assert.equal(guestbook.data.messages[0].message, message, 'Guestbook content must stay plain text');
assert.equal((await call('/api/guestbook', { method: 'POST', ip: guestIp, body: { message: 'Too soon' } })).status, 429);

const parallelIp = `2001:db8::${crypto.randomUUID().slice(0, 4)}`;
const parallelPosts = await Promise.all(Array.from({ length: 3 }, (_, index) =>
  call('/api/guestbook', { method: 'POST', ip: parallelIp, body: { message: `Parallel note ${index}` } })
));
assert.deepEqual(parallelPosts.map((result) => result.status).sort(), [201, 429, 429], 'Concurrent posts from one IP must respect the cooldown');

console.log('Radio API: reactions, concurrency, idempotency, validation, CORS, guestbook and rate limiting passed.');
