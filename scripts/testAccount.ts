/**
 * Account API tests against an in-memory D1 stand-in.
 * Run: npx tsx scripts/testAccount.ts
 */
import assert from 'node:assert/strict';
import { createLocalD1 } from '../src/server/db/localSqlite';
import { handleAccountRoutes } from '../src/server/auth/accountRoutes';
import { HttpError, errorResponse, sha256Hex, type Env } from '../src/server/http';
import type { AccountState } from '../src/shared/account';

const DB = createLocalD1(':memory:');
const env: Env = { DB, APP_URL: 'https://cozy.test' };

interface Call {
  method?: string;
  body?: unknown;
  cookie?: string | null;
  ip?: string;
}

async function call(path: string, { method = 'GET', body, cookie, ip = '10.0.0.1' }: Call = {}) {
  const headers: Record<string, string> = { 'CF-Connecting-IP': ip };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = `cd_session=${cookie}`;
  const url = new URL(`https://cozy.test${path}`);
  const req = new Request(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let res: Response | null;
  try {
    res = await handleAccountRoutes(req, env, url);
  } catch (err) {
    if (err instanceof HttpError) res = errorResponse(err.status, err.message);
    else throw err;
  }
  if (!res) return { status: 404, data: null as any, setCookie: null as string | null };
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null, setCookie: res.headers.get('Set-Cookie') };
}

function tokenFrom(setCookie: string | null): string {
  const m = /cd_session=([0-9a-f]{64});/.exec(setCookie || '');
  assert.ok(m, `expected session cookie, got ${setCookie}`);
  return m[1];
}

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${(err as Error).stack?.split('\n').slice(0, 3).join('\n       ')}`);
  }
}

let ipCounter = 1;
const freshIp = () => `10.1.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}`;

async function signup(email: string, password = 'correct horse battery', displayName = 'Tester') {
  const r = await call('/api/auth/signup', { method: 'POST', body: { email, password, displayName }, ip: freshIp() });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { token: tokenFrom(r.setCookie), state: r.data as AccountState };
}

async function main() {
  console.log('Account API');

  await test('signup -> me -> logout via cookie', async () => {
    const r = await call('/api/auth/signup', {
      method: 'POST',
      body: { email: '  Ada@Example.COM ', password: 'longenough1', displayName: '  Ada  ' },
      ip: freshIp()
    });
    assert.equal(r.status, 201);
    assert.match(r.setCookie!, /HttpOnly; SameSite=Lax; Path=\/; Max-Age=2592000; Secure/);
    assert.equal(r.data.user.email, 'ada@example.com');
    assert.equal(r.data.user.displayName, 'Ada');
    assert.equal(r.data.user.avatar, 'sprout');
    assert.deepEqual(r.data.wishlist, []);
    const token = tokenFrom(r.setCookie);

    const stored = await DB.prepare('SELECT token_hash FROM sessions').all<{ token_hash: string }>();
    assert.ok(stored.results.every((s) => s.token_hash !== token), 'raw token must not be stored');
    const hash = await sha256Hex(token);
    assert.ok(stored.results.some((s) => s.token_hash === hash), 'hash of token is stored');

    const me = await call('/api/me', { cookie: token });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, 'ada@example.com');

    const out = await call('/api/auth/logout', { method: 'POST', cookie: token });
    assert.equal(out.status, 200);
    assert.match(out.setCookie!, /Max-Age=0/);
    const after = await call('/api/me', { cookie: token });
    assert.equal(after.status, 204);
    assert.equal(after.data, null);
    assert.match(after.setCookie!, /Max-Age=0/, 'stale cookie is cleared');
  });

  await test('session token is not accepted from query or Authorization header', async () => {
    const { token } = await signup('header@example.com');
    const url = new URL(`https://cozy.test/api/me?token=${token}`);
    const res = await handleAccountRoutes(new Request(url, { headers: { Authorization: `Bearer ${token}` } }), env, url);
    assert.equal(res!.status, 204);
  });

  await test('duplicate email -> 409', async () => {
    await signup('dupe@example.com');
    const r = await call('/api/auth/signup', { method: 'POST', body: { email: 'DUPE@example.com', password: 'longenough1', displayName: 'Dupe' }, ip: freshIp() });
    assert.equal(r.status, 409);
    assert.equal(r.data.error, 'An account with that email already exists.');
  });

  await test('signup validation: short password, bad email, bad name -> 400', async () => {
    const ip = freshIp();
    const short = await call('/api/auth/signup', { method: 'POST', body: { email: 'x@example.com', password: '1234567', displayName: 'Xx' }, ip });
    assert.equal(short.status, 400);
    assert.match(short.data.error, /at least 8/);
    const email = await call('/api/auth/signup', { method: 'POST', body: { email: 'not-an-email', password: 'longenough1', displayName: 'Xx' }, ip });
    assert.equal(email.status, 400);
    const name = await call('/api/auth/signup', { method: 'POST', body: { email: 'y@example.com', password: 'longenough1', displayName: 'a\u0007b' }, ip });
    assert.equal(name.status, 400);
    const count = await DB.prepare("SELECT COUNT(*) AS n FROM users WHERE email IN ('x@example.com','y@example.com')").first<number>('n');
    assert.equal(count, 0);
  });

  await test('login success, wrong password 401, unknown email 401', async () => {
    await signup('login@example.com', 'my password 1');
    const ok = await call('/api/auth/login', { method: 'POST', body: { email: 'LOGIN@example.com', password: 'my password 1' }, ip: freshIp() });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.user.email, 'login@example.com');
    tokenFrom(ok.setCookie);
    const bad = await call('/api/auth/login', { method: 'POST', body: { email: 'login@example.com', password: 'nope nope' }, ip: freshIp() });
    assert.equal(bad.status, 401);
    assert.equal(bad.data.error, 'Email or password is incorrect.');
    assert.equal(bad.setCookie, null);
    const unknown = await call('/api/auth/login', { method: 'POST', body: { email: 'ghost@example.com', password: 'whatever1' }, ip: freshIp() });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.data.error, 'Email or password is incorrect.');
  });

  await test('passwords are PBKDF2 with stored iterations and salt', async () => {
    const row = await DB.prepare("SELECT password_hash, salt, hash_iterations FROM users WHERE email = 'login@example.com'").first<any>();
    assert.equal(row.hash_iterations, 100000);
    assert.match(row.salt, /^[0-9a-f]{32}$/);
    assert.match(row.password_hash, /^[0-9a-f]{64}$/);
  });

  await test('expired session -> 401 and row deleted', async () => {
    const { token } = await signup('expire@example.com');
    const hash = await sha256Hex(token);
    await DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').bind('2000-01-01T00:00:00.000Z', hash).run();
    const r = await call('/api/me', { cookie: token });
    assert.equal(r.status, 204);
    const left = await DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?').bind(hash).first<number>('n');
    assert.equal(left, 0);
  });

  await test('sliding expiry refreshes once a day, not on every request', async () => {
    const { token } = await signup('slide@example.com');
    const hash = await sha256Hex(token);
    const before = await DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').bind(hash).first<string>('expires_at');
    await call('/api/me', { cookie: token });
    const same = await DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').bind(hash).first<string>('expires_at');
    assert.equal(same, before, 'no refresh within 24h');
    const old = new Date(Date.now() - 2 * 86400_000);
    await DB.prepare('UPDATE sessions SET last_active_at = ?, expires_at = ? WHERE token_hash = ?')
      .bind(old.toISOString(), new Date(old.getTime() + 30 * 86400_000).toISOString(), hash).run();
    await call('/api/me', { cookie: token });
    const refreshed = await DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').bind(hash).first<string>('expires_at');
    assert.ok(Date.parse(refreshed!) > Date.now() + 29.9 * 86400_000);
  });

  await test('login prunes expired sessions', async () => {
    const { token } = await signup('prune@example.com', 'prune password');
    const hash = await sha256Hex(token);
    await DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').bind('2001-01-01T00:00:00.000Z', hash).run();
    await call('/api/auth/login', { method: 'POST', body: { email: 'prune@example.com', password: 'prune password' }, ip: freshIp() });
    const n = await DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?').bind(hash).first<number>('n');
    assert.equal(n, 0);
  });

  await test('rate limits: signup 5/hour per IP, login 10/15min per IP and per email', async () => {
    const ip = '192.168.50.1';
    for (let i = 0; i < 5; i++) {
      const r = await call('/api/auth/signup', { method: 'POST', body: { email: `rl${i}@example.com`, password: 'longenough1', displayName: 'Rate' }, ip });
      assert.equal(r.status, 201);
    }
    const sixth = await call('/api/auth/signup', { method: 'POST', body: { email: 'rl6@example.com', password: 'longenough1', displayName: 'Rate' }, ip });
    assert.equal(sixth.status, 429);
    assert.equal(sixth.data.error, 'Too many attempts. Please wait a bit and try again.');

    const loginIp = '192.168.50.2';
    for (let i = 0; i < 10; i++) {
      const r = await call('/api/auth/login', { method: 'POST', body: { email: `nobody${i}@example.com`, password: 'wrong pass' }, ip: loginIp });
      assert.equal(r.status, 401);
    }
    assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'z@example.com', password: 'x' }, ip: loginIp })).status, 429);

    for (let i = 0; i < 10; i++) {
      const r = await call('/api/auth/login', { method: 'POST', body: { email: 'rl0@example.com', password: 'wrong pass' }, ip: freshIp() });
      assert.equal(r.status, 401);
    }
    const blocked = await call('/api/auth/login', { method: 'POST', body: { email: 'rl0@example.com', password: 'longenough1' }, ip: freshIp() });
    assert.equal(blocked.status, 429, 'per-email limit blocks even correct password');
  });

  await test('wishlist add/remove/dedupe/order and validation', async () => {
    const { token } = await signup('wish@example.com');
    assert.deepEqual((await call('/api/me/wishlist/413150', { method: 'PUT', cookie: token })).data, { wishlist: [413150] });
    await call('/api/me/wishlist/1145360', { method: 'PUT', cookie: token });
    const again = await call('/api/me/wishlist/413150', { method: 'PUT', cookie: token });
    assert.deepEqual(again.data.wishlist, [1145360, 413150], 'newest first, no duplicates');
    const del = await call('/api/me/wishlist/413150', { method: 'DELETE', cookie: token });
    assert.deepEqual(del.data.wishlist, [1145360]);
    assert.equal((await call('/api/me/wishlist/abc', { method: 'PUT', cookie: token })).status, 400);
    assert.equal((await call('/api/me/wishlist/0', { method: 'PUT', cookie: token })).status, 400);
    assert.equal((await call('/api/me/wishlist/-5', { method: 'PUT', cookie: token })).status, 400);
    assert.equal((await call('/api/me/wishlist/5', { method: 'PUT' })).status, 401);
  });

  await test('bookmarks: URL-decoded ids, length limit', async () => {
    const { token } = await signup('books@example.com');
    const r = await call(`/api/me/bookmarks/${encodeURIComponent('news/a b?c')}`, { method: 'PUT', cookie: token });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.bookmarks, ['news/a b?c']);
    assert.equal((await call(`/api/me/bookmarks/${'x'.repeat(201)}`, { method: 'PUT', cookie: token })).status, 400);
    assert.equal((await call('/api/me/bookmarks/%E0%A4%A', { method: 'PUT', cookie: token })).status, 400);
    const d = await call(`/api/me/bookmarks/${encodeURIComponent('news/a b?c')}`, { method: 'DELETE', cookie: token });
    assert.deepEqual(d.data.bookmarks, []);
  });

  await test('merge: union, dedupe, invalid entries dropped, order kept', async () => {
    const { token } = await signup('merge@example.com');
    await call('/api/me/wishlist/10', { method: 'PUT', cookie: token });
    await call('/api/me/bookmarks/keep', { method: 'PUT', cookie: token });
    const r = await call('/api/me/merge', {
      method: 'POST',
      cookie: token,
      body: { wishlist: [30, 10, 20, 30, -1, 'x', 1.5], bookmarks: ['b1', 'keep', '', 'b2', 42] }
    });
    assert.equal(r.status, 200);
    assert.deepEqual([...r.data.wishlist].sort((a: number, b: number) => a - b), [10, 20, 30]);
    assert.deepEqual(r.data.wishlist.filter((x: number) => x !== 10), [30, 20], 'incoming order preserved');
    assert.deepEqual([...r.data.bookmarks].sort(), ['b1', 'b2', 'keep']);
    const n = await DB.prepare("SELECT COUNT(*) AS n FROM user_wishlist w JOIN users u ON u.id = w.user_id WHERE u.email = 'merge@example.com'").first<number>('n');
    assert.equal(n, 3);
    assert.equal((await call('/api/me/merge', { method: 'POST', cookie: token, body: { wishlist: 'nope' } })).status, 400);
  });

  await test('profile patch: valid updates and validation', async () => {
    const { token } = await signup('profile@example.com');
    const ok = await call('/api/me', { method: 'PATCH', cookie: token, body: { displayName: ' Moss ', avatar: 'frog', bio: '  Likes tea.  ' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.user.displayName, 'Moss');
    assert.equal(ok.data.user.avatar, 'frog');
    assert.equal(ok.data.user.bio, 'Likes tea.');
    assert.equal((await call('/api/me', { method: 'PATCH', cookie: token, body: { avatar: 'dragon' } })).status, 400);
    assert.equal((await call('/api/me', { method: 'PATCH', cookie: token, body: { bio: 'x'.repeat(281) } })).status, 400);
    assert.equal((await call('/api/me', { method: 'PATCH', cookie: token, body: { displayName: 'a' } })).status, 400);
    const me = await call('/api/me', { cookie: token });
    assert.equal(me.data.user.avatar, 'frog', 'failed patch changed nothing');
  });

  await test('password change revokes other sessions only', async () => {
    const { token: a } = await signup('pw@example.com', 'first password');
    const login = await call('/api/auth/login', { method: 'POST', body: { email: 'pw@example.com', password: 'first password' }, ip: freshIp() });
    const b = tokenFrom(login.setCookie);
    const wrong = await call('/api/me/password', { method: 'POST', cookie: a, body: { currentPassword: 'nope nope', newPassword: 'second password' } });
    assert.equal(wrong.status, 403);
    const tooShort = await call('/api/me/password', { method: 'POST', cookie: a, body: { currentPassword: 'first password', newPassword: 'short' } });
    assert.equal(tooShort.status, 400);
    const ok = await call('/api/me/password', { method: 'POST', cookie: a, body: { currentPassword: 'first password', newPassword: 'second password' } });
    assert.equal(ok.status, 200);
    assert.equal((await call('/api/me', { cookie: a })).status, 200, 'current session kept');
    assert.equal((await call('/api/me', { cookie: b })).status, 204, 'other session revoked');
    assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'pw@example.com', password: 'first password' }, ip: freshIp() })).status, 401);
    assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'pw@example.com', password: 'second password' }, ip: freshIp() })).status, 200);
  });

  await test('delete account requires password and removes all data', async () => {
    const { token, state } = await signup('bye@example.com', 'goodbye password');
    await call('/api/me/wishlist/99', { method: 'PUT', cookie: token });
    assert.equal((await call('/api/me', { method: 'DELETE', cookie: token, body: { password: 'wrong one' } })).status, 403);
    const r = await call('/api/me', { method: 'DELETE', cookie: token, body: { password: 'goodbye password' } });
    assert.equal(r.status, 200);
    assert.match(r.setCookie!, /Max-Age=0/);
    for (const table of ['users WHERE id = ?', 'sessions WHERE user_id = ?', 'user_wishlist WHERE user_id = ?']) {
      const n = await DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).bind(state.user.id).first<number>('n');
      assert.equal(n, 0, table);
    }
    assert.equal((await call('/api/me', { cookie: token })).status, 204);
  });

  await test('unknown routes return null; wrong methods 405', async () => {
    assert.equal((await call('/api/auth/nope', { method: 'POST' })).status, 404);
    assert.equal((await call('/api/games')).status, 404);
    assert.equal((await call('/api/auth/login')).status, 405);
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
