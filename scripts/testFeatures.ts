/**
 * Shareable lists, release calendar and weekly newsletter draft, through the
 * full API router against an in-memory D1 stand-in.
 * Run: npx tsx scripts/testFeatures.ts
 */
import assert from 'node:assert/strict';
import { createLocalD1 } from '../src/server/db/localSqlite';
import { handleApiRequest } from '../src/server/apiRouter';
import type { Env } from '../src/server/http';
import { buildWeeklyDraft } from '../src/server/newsletter/weeklyDigest';

const DB = createLocalD1(':memory:');
const env: Env = { DB, APP_URL: 'https://cozy.test', ADMIN_TOKEN: 'admin-secret-123' };
const DAY = 86400;
const NOW = Math.floor(Date.now() / 1000);

let ip = 1;
async function call(path: string, opts: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'CF-Connecting-IP': `10.7.0.${ip++ % 250}`, ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.cookie) headers.Cookie = `cd_session=${opts.cookie}`;
  const res = await handleApiRequest(
    new Request(`https://cozy.test${path}`, { method: opts.method ?? 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined }),
    env
  );
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null, setCookie: res.headers.get('Set-Cookie') };
}

async function signup(email: string, displayName = 'Lister') {
  const r = await call('/api/auth/signup', { method: 'POST', body: { email, password: 'long enough pw', displayName } });
  assert.equal(r.status, 201);
  return /cd_session=([0-9a-f]{64})/.exec(r.setCookie || '')![1];
}

async function addGame(appId: number, fields: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    app_id: appId,
    slug: `game-${appId}`,
    title: `Game ${appId}`,
    is_cozy: 1,
    is_indie: 1,
    review_count: 1000,
    review_percent: 90,
    popularity: appId,
    first_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...fields
  };
  const cols = Object.keys(row);
  await DB.prepare(`INSERT INTO games (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map((c) => row[c])).run();
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
    console.log(`  FAIL ${name}\n       ${(err as Error).stack?.split('\n').slice(0, 4).join('\n       ')}`);
  }
}

async function main() {
  console.log('Lists, calendar, weekly newsletter');
  for (const id of [10, 20, 30]) await addGame(id);

  await test('lists: create, share publicly, edit order, owner-only changes, delete', async () => {
    const alice = await signup('alice@example.com', 'Alice');
    const bob = await signup('bob@example.com', 'Bob');

    assert.equal((await call('/api/me/lists', { method: 'POST', body: { title: 'x' } })).status, 401);
    assert.equal((await call('/api/me/lists', { method: 'POST', cookie: alice, body: { title: '   ' } })).status, 400);
    const made = await call('/api/me/lists', { method: 'POST', cookie: alice, body: { title: '  Autumn picks ', appIds: [20, 999, 10, 20] } });
    assert.equal(made.status, 201);
    assert.match(made.data.id, /^[A-Za-z0-9]{12}$/);
    assert.equal(made.data.title, 'Autumn picks');
    assert.deepEqual(made.data.appIds, [20, 10], 'unknown games and duplicates dropped, order kept');

    const pub = await call(`/api/lists/${made.data.id}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.data.owner.displayName, 'Alice');
    assert.equal(pub.data.isOwner, false);
    assert.deepEqual(pub.data.games.map((g: any) => g.appId), [20, 10]);
    assert.equal(pub.data.owner.email, undefined, 'no email leaks');
    assert.equal((await call(`/api/lists/${made.data.id}`, { cookie: alice })).data.isOwner, true);

    assert.equal((await call(`/api/me/lists/${made.data.id}`, { method: 'PATCH', cookie: bob, body: { title: 'mine now' } })).status, 404);
    assert.equal((await call(`/api/me/lists/${made.data.id}`, { method: 'DELETE', cookie: bob })).status, 404);

    const edited = await call(`/api/me/lists/${made.data.id}`, {
      method: 'PATCH',
      cookie: alice,
      body: { appIds: [10, 30, 20], description: 'Rainy evenings' }
    });
    assert.equal(edited.status, 200);
    assert.deepEqual(edited.data.appIds, [10, 30, 20]);
    assert.equal(edited.data.description, 'Rainy evenings');
    assert.equal((await call(`/api/me/lists/${made.data.id}`, { method: 'PATCH', cookie: alice, body: { appIds: 'nope' } })).status, 400);
    assert.equal((await call(`/api/me/lists/${made.data.id}`, { method: 'PATCH', cookie: alice, body: { title: 'x'.repeat(81) } })).status, 400);

    const mine = await call('/api/me/lists', { cookie: alice });
    assert.deepEqual(mine.data.items.map((l: any) => l.id), [made.data.id]);
    assert.deepEqual((await call('/api/me/lists', { cookie: bob })).data.items, []);

    assert.equal((await call(`/api/me/lists/${made.data.id}`, { method: 'DELETE', cookie: alice })).status, 200);
    assert.equal((await call(`/api/lists/${made.data.id}`)).status, 404);
    assert.equal((await call('/api/lists/not-a-valid-id')).status, 404);
    assert.equal((await call('/api/lists/AAAAAAAAAAAA', { method: 'POST' })).status, 405);
  });

  await test('lists: blocked cross-site and removed with the account', async () => {
    const carol = await signup('carol@example.com');
    const blocked = await call('/api/me/lists', { method: 'POST', cookie: carol, body: { title: 'x' }, headers: { Origin: 'https://evil.test' } });
    assert.equal(blocked.status, 403);
    const made = await call('/api/me/lists', { method: 'POST', cookie: carol, body: { title: 'Gone soon' } });
    assert.equal((await call('/api/me', { method: 'DELETE', cookie: carol, body: { password: 'long enough pw' } })).status, 200);
    assert.equal((await call(`/api/lists/${made.data.id}`)).status, 404);
  });

  await test('calendar: this month onward, soonest first, vague dates last', async () => {
    await addGame(101, { is_coming_soon: 1, release_ts: NOW + 20 * DAY, is_indie: 1, is_cozy: 0 });
    await addGame(102, { is_coming_soon: 1, release_ts: NOW + 2 * DAY });
    await addGame(103, { is_coming_soon: 1, release_ts: null, release_label: 'To be announced' });
    await addGame(104, { is_coming_soon: 0, release_ts: NOW - 400 * DAY });
    const r = await call('/api/calendar');
    assert.equal(r.status, 200);
    const ids = r.data.items.map((g: any) => g.appId);
    assert.deepEqual(ids.filter((id: number) => id > 100), [102, 101, 103]);
    assert.ok(!ids.includes(104), 'old releases are not on the calendar');
    const cozy = await call('/api/calendar?section=cozy');
    assert.ok(!cozy.data.items.some((g: any) => g.appId === 101), 'section filter');
  });

  await test('weekly draft: new, deals and soon; skips recent issues; admin only', async () => {
    await addGame(201, { release_ts: NOW - 2 * DAY, title: 'Fresh Farm' });
    await addGame(202, { discount_pct: 40, review_count: 5000, title: 'Old Favourite' });
    await addGame(203, { discount_pct: 50, review_count: 5000, review_percent: 60, title: 'Mixed Reviews' });
    const draft = await buildWeeklyDraft(DB);
    const all = draft.sections.flatMap((s) => s.games.map((g) => g.appId));
    assert.ok(all.includes(201) && all.includes(202) && all.includes(102), JSON.stringify(draft.sections));
    assert.ok(!all.includes(203), 'poorly reviewed deals are skipped');
    assert.match(draft.subject, /^This week in cozy: Fresh Farm and more$/);
    assert.match(draft.intro, /New this week: Fresh Farm\./);
    assert.match(draft.intro, /Old Favourite \(−40%\)/);
    assert.ok(draft.appIds.length <= 8);

    await DB.prepare(
      `INSERT INTO newsletter_issues (id, subject, intro, app_ids_json, created_at) VALUES ('i1', 's', 'i', '[201,202]', ?)`
    ).bind(new Date().toISOString()).run();
    const next = await buildWeeklyDraft(DB);
    assert.ok(!next.appIds.includes(201) && !next.appIds.includes(202), 'recently featured games are skipped');

    assert.equal((await call('/api/admin/newsletter/weekly')).status, 401);
    const viaApi = await call('/api/admin/newsletter/weekly', { headers: { Authorization: 'Bearer admin-secret-123' } });
    assert.equal(viaApi.status, 200);
    assert.equal(viaApi.data.mailerConfigured, false);
    assert.deepEqual(viaApi.data.draft.appIds, next.appIds);
    const send = await call('/api/admin/newsletter/weekly', { method: 'POST', body: {}, headers: { Authorization: 'Bearer admin-secret-123' } });
    assert.equal(send.status, 503, 'no sending without email configured');

    // With email on: refuses right after an issue, sends with force, and records it.
    Object.assign(env, { RESEND_API_KEY: 're_test', EMAIL_FROM: 'Cozy Dispatch <hello@cozy.test>' });
    const sentTo: string[] = [];
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      for (const m of Array.isArray(body) ? body : [body]) sentTo.push(...[].concat(m.to));
      const data = Array.isArray(body) ? { data: body.map((_: unknown, i: number) => ({ id: `b${i}` })) } : { id: 'e1' };
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    await DB.prepare(`INSERT INTO newsletter_subscribers (id, email, status, unsubscribe_token, created_at) VALUES ('s1', 'reader@example.com', 'active', 'tok', ?)`)
      .bind(new Date().toISOString()).run();
    const admin = { Authorization: 'Bearer admin-secret-123' };
    const tooSoon = await call('/api/admin/newsletter/weekly', { method: 'POST', body: {}, headers: admin });
    assert.equal(tooSoon.status, 409);
    assert.equal(sentTo.length, 0);
    const forced = await call('/api/admin/newsletter/weekly', { method: 'POST', body: { force: true }, headers: admin });
    assert.equal(forced.status, 200, JSON.stringify(forced.data));
    assert.equal(forced.data.sent, 1);
    assert.deepEqual(sentTo, ['reader@example.com']);
    const issues = await DB.prepare('SELECT COUNT(*) AS n FROM newsletter_issues').first<number>('n');
    assert.equal(issues, 2);
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
