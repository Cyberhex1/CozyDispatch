/**
 * Newsletter API tests against an in-memory D1 stand-in, with Resend stubbed.
 * Run: npx tsx scripts/testNewsletter.ts
 */
import assert from 'node:assert/strict';
import { createLocalD1 } from '../src/server/db/localSqlite';
import { handleNewsletterRoutes } from '../src/server/newsletter/newsletterRoutes';
import { HttpError, errorResponse, sha256Hex, type Env } from '../src/server/http';

const DB = createLocalD1(':memory:');
const offlineEnv: Env = { DB, APP_URL: 'https://cozy.test' };
const onlineEnv: Env = { DB, APP_URL: 'https://cozy.test', RESEND_API_KEY: 're_test', EMAIL_FROM: 'Cozy Dispatch <hello@cozy.test>' };
const adminEnv: Env = { ...onlineEnv, ADMIN_TOKEN: 'admin-secret-123' };

// ---- Resend stub ------------------------------------------------------------
interface Captured { url: string; auth: string | null; body: any }
let captured: Captured[] = [];
let resendFails = false;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  assert.ok(url.startsWith('https://api.resend.com/'), `unexpected fetch ${url}`);
  const headers = new Headers(init?.headers);
  const body = JSON.parse(String(init?.body));
  captured.push({ url, auth: headers.get('Authorization'), body });
  if (resendFails) return new Response(JSON.stringify({ message: 'nope' }), { status: 500 });
  const data = Array.isArray(body) ? { data: body.map((_: unknown, i: number) => ({ id: `b${i}` })) } : { id: 'e1' };
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

// ---- helpers ----------------------------------------------------------------
let ipN = 1;
async function call(env: Env, path: string, opts: { method?: string; body?: unknown; form?: string; headers?: Record<string, string>; ip?: string } = {}) {
  const headers: Record<string, string> = { 'CF-Connecting-IP': opts.ip ?? `10.9.0.${ipN++}`, ...(opts.headers || {}) };
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  } else if (opts.form !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = opts.form;
  }
  const url = new URL(`https://cozy.test${path}`);
  let res: Response | null;
  try {
    res = await handleNewsletterRoutes(new Request(url, { method: opts.method ?? 'GET', headers, body }), env, url);
  } catch (err) {
    if (err instanceof HttpError) res = errorResponse(err.status, err.message);
    else throw err;
  }
  if (!res) return { status: 404, text: '', data: null as any, type: '' };
  const text = await res.text();
  const type = res.headers.get('Content-Type') || '';
  return { status: res.status, text, type, data: type.includes('json') ? JSON.parse(text) : null };
}

const subscriber = (email: string) => DB.prepare('SELECT * FROM newsletter_subscribers WHERE email = ?').bind(email).first<any>();

function confirmTokenFrom(text: string): string {
  const m = /\/api\/newsletter\/confirm\?token=([0-9a-f]{64})/.exec(text);
  assert.ok(m, 'confirm link present');
  return m[1];
}

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => Promise<void>) {
  captured = [];
  resendFails = false;
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${(err as Error).stack?.split('\n').slice(0, 3).join('\n       ')}`);
  }
}

async function main() {
  console.log('Newsletter API');

  await test('offline mode: mailer_offline, stored pending, nothing sent', async () => {
    const r = await call(offlineEnv, '/api/newsletter/subscribe', { method: 'POST', body: { email: ' Offline@Example.com ', source: 'footer' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.status, 'mailer_offline');
    assert.match(r.data.message, /aren't switched on yet/);
    assert.doesNotMatch(r.data.message, /you're subscribed/i);
    const row = await subscriber('offline@example.com');
    assert.equal(row.status, 'pending');
    assert.equal(row.confirm_sent_at, null);
    assert.equal(row.confirm_token_hash, null);
    assert.equal(captured.length, 0);
  });

  await test('invalid email -> 400', async () => {
    const r = await call(onlineEnv, '/api/newsletter/subscribe', { method: 'POST', body: { email: 'nope' } });
    assert.equal(r.status, 400);
    assert.ok(r.data.error);
  });

  let confirmToken = '';
  await test('online: confirmation email sent with headers, text part, hashed token', async () => {
    const r = await call(onlineEnv, '/api/newsletter/subscribe', { method: 'POST', body: { email: 'reader@example.com' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.status, 'check_inbox');
    assert.equal(captured.length, 1);
    const sent = captured[0];
    assert.equal(sent.url, 'https://api.resend.com/emails');
    assert.equal(sent.auth, 'Bearer re_test');
    assert.deepEqual(sent.body.to, ['reader@example.com']);
    assert.equal(sent.body.subject, 'Confirm your Cozy Dispatch subscription');
    assert.equal(sent.body.from, 'Cozy Dispatch <hello@cozy.test>');
    assert.ok(sent.body.text.length > 20, 'plain-text part');
    const row = await subscriber('reader@example.com');
    assert.equal(sent.body.headers['List-Unsubscribe'], `<https://cozy.test/api/newsletter/unsubscribe?token=${row.unsubscribe_token}>`);
    assert.equal(sent.body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    confirmToken = confirmTokenFrom(sent.body.html);
    assert.equal(confirmTokenFrom(sent.body.text), confirmToken);
    assert.equal(row.status, 'pending');
    assert.equal(row.confirm_token_hash, await sha256Hex(confirmToken), 'only the hash is stored');
    const log = await DB.prepare("SELECT * FROM email_log WHERE recipient = 'reader@example.com'").all<any>();
    assert.equal(log.results.length, 1);
    assert.equal(log.results[0].status, 'sent');
    assert.equal(log.results[0].template, 'confirm');
  });

  await test('confirm: bad token 400 page; valid token activates; reuse 400', async () => {
    const bad = await call(onlineEnv, `/api/newsletter/confirm?token=${'0'.repeat(64)}`);
    assert.equal(bad.status, 400);
    assert.match(bad.type, /text\/html/);
    assert.match(bad.text, /href="\/"/);
    const ok = await call(onlineEnv, `/api/newsletter/confirm?token=${confirmToken}`);
    assert.equal(ok.status, 200);
    assert.match(ok.text, /on the list/);
    const row = await subscriber('reader@example.com');
    assert.equal(row.status, 'active');
    assert.ok(row.confirmed_at);
    assert.equal((await call(onlineEnv, `/api/newsletter/confirm?token=${confirmToken}`)).status, 400);
  });

  await test('confirm link expires after 7 days', async () => {
    await call(onlineEnv, '/api/newsletter/subscribe', { method: 'POST', body: { email: 'late@example.com' } });
    const token = confirmTokenFrom(captured[0].body.html);
    await DB.prepare("UPDATE newsletter_subscribers SET confirm_sent_at = ? WHERE email = 'late@example.com'")
      .bind(new Date(Date.now() - 8 * 86400_000).toISOString()).run();
    assert.equal((await call(onlineEnv, `/api/newsletter/confirm?token=${token}`)).status, 400);
    assert.equal((await subscriber('late@example.com')).status, 'pending');
  });

  await test('already-active subscribe answers check_inbox and sends nothing', async () => {
    const r = await call(onlineEnv, '/api/newsletter/subscribe', { method: 'POST', body: { email: 'READER@example.com' } });
    assert.equal(r.data.status, 'check_inbox');
    assert.equal(captured.length, 0);
    assert.equal((await subscriber('reader@example.com')).status, 'active');
  });

  await test('max 3 confirmation emails per address per day', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await call(onlineEnv, '/api/newsletter/subscribe', { method: 'POST', body: { email: 'spam@example.com' } });
      assert.equal(r.data.status, 'check_inbox');
    }
    assert.equal(captured.length, 3);
  });

  await test('subscribe rate limit 5/hour per IP', async () => {
    for (let i = 0; i < 5; i++) {
      assert.equal((await call(offlineEnv, '/api/newsletter/subscribe', { method: 'POST', body: { email: `ip${i}@example.com` }, ip: '172.16.0.1' })).status, 200);
    }
    assert.equal((await call(offlineEnv, '/api/newsletter/subscribe', { method: 'POST', body: { email: 'ip9@example.com' }, ip: '172.16.0.1' })).status, 429);
  });

  await test('Resend failure is reported honestly and leaves address queued', async () => {
    resendFails = true;
    const r = await call(onlineEnv, '/api/newsletter/subscribe', { method: 'POST', body: { email: 'flaky@example.com' } });
    assert.equal(r.status, 502);
    const row = await subscriber('flaky@example.com');
    assert.equal(row.status, 'pending');
    assert.equal(row.confirm_sent_at, null);
    const log = await DB.prepare("SELECT status FROM email_log WHERE recipient = 'flaky@example.com'").first<string>('status');
    assert.equal(log, 'failed');
  });

  await test('GET unsubscribe shows a form and does not unsubscribe; POST does', async () => {
    const row = await subscriber('reader@example.com');
    const get = await call(onlineEnv, `/api/newsletter/unsubscribe?token=${row.unsubscribe_token}`);
    assert.equal(get.status, 200);
    assert.match(get.text, /<form method="post"/);
    assert.equal((await subscriber('reader@example.com')).status, 'active');
    const post = await call(onlineEnv, `/api/newsletter/unsubscribe?token=${row.unsubscribe_token}`, { method: 'POST', form: 'List-Unsubscribe=One-Click' });
    assert.equal(post.status, 200);
    assert.match(post.text, /unsubscribed/);
    const after = await subscriber('reader@example.com');
    assert.equal(after.status, 'unsubscribed');
    assert.ok(after.unsubscribed_at);
    assert.equal((await call(onlineEnv, `/api/newsletter/unsubscribe?token=${'f'.repeat(64)}`, { method: 'POST' })).status, 400);
    assert.equal((await call(onlineEnv, '/api/newsletter/unsubscribe?token=junk')).status, 400);
  });

  await test('pages escape the stored email', async () => {
    // A syntactically odd address can't pass validation, so plant one directly.
    const token = 'a'.repeat(64);
    await DB.prepare(`INSERT INTO newsletter_subscribers (id, email, status, unsubscribe_token, created_at) VALUES ('x', ?, 'active', ?, ?)`)
      .bind('<script>alert(1)</script>@evil.test', token, new Date().toISOString()).run();
    const r = await call(onlineEnv, `/api/newsletter/unsubscribe?token=${token}`);
    assert.doesNotMatch(r.text, /<script>/);
    assert.match(r.text, /&lt;script&gt;/);
    await DB.prepare("DELETE FROM newsletter_subscribers WHERE id = 'x'").run();
  });

  await test('admin endpoints: 503 without ADMIN_TOKEN, 401 wrong token', async () => {
    const off = await call(onlineEnv, '/api/admin/newsletter/stats', { headers: { Authorization: 'Bearer anything' } });
    assert.equal(off.status, 503);
    assert.equal(off.data.error, 'Admin endpoints are disabled.');
    assert.equal((await call(adminEnv, '/api/admin/newsletter/stats')).status, 401);
    assert.equal((await call(adminEnv, '/api/admin/newsletter/stats', { headers: { Authorization: 'Bearer admin-secret-12' } })).status, 401);
    assert.equal((await call(adminEnv, '/api/admin/newsletter/send', { method: 'POST', body: { subject: 'x', intro: 'y' }, headers: { Authorization: 'Bearer wrong' } })).status, 401);
    assert.equal(captured.length, 0);
  });

  const auth = { Authorization: 'Bearer admin-secret-123' };

  await test('send: only active subscribers, escapes HTML, per-recipient unsubscribe, real counts', async () => {
    const now = new Date().toISOString();
    await DB.prepare(
      `INSERT INTO games (app_id, slug, title, short_description, asset_base, asset_version, header_file, price_cents, is_free, first_seen_at, updated_at)
       VALUES (413150, 'stardew-valley', 'Stardew <Valley>', 'Farm & friends', 'steam/apps/413150/', '123', 'header.jpg', 1499, 0, ?, ?)`
    ).bind(now, now).run();
    // two active subscribers
    for (const email of ['a1@example.com', 'a2@example.com']) {
      await DB.prepare(`INSERT INTO newsletter_subscribers (id, email, status, unsubscribe_token, created_at) VALUES (?, ?, 'active', ?, ?)`)
        .bind(crypto.randomUUID(), email, (email === 'a1@example.com' ? '1' : '2').repeat(64), now).run();
    }
    captured = [];
    const r = await call(adminEnv, '/api/admin/newsletter/send', {
      method: 'POST',
      headers: auth,
      body: { subject: 'Hello <script>alert(1)</script>', intro: 'Para one <script>x()</script>\n\nPara & two', appIds: [413150] }
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.recipients, 2);
    assert.equal(r.data.sent, 2);
    assert.equal(r.data.failed, 0);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, 'https://api.resend.com/emails/batch');
    const batch = captured[0].body as any[];
    assert.deepEqual(batch.map((e) => e.to[0]).sort(), ['a1@example.com', 'a2@example.com']);
    for (const e of batch) {
      assert.doesNotMatch(e.html, /<script>/);
      assert.match(e.html, /&lt;script&gt;/);
      assert.match(e.html, /Stardew &lt;Valley&gt;/);
      assert.match(e.html, /store_item_assets\/steam\/apps\/413150\/header\.jpg\?t=123/);
      assert.match(e.html, /store\.steampowered\.com\/app\/413150\//);
      assert.match(e.html, /\$14\.99/);
      assert.match(e.text, /Para & two/);
      const tok = e.to[0] === 'a1@example.com' ? '1'.repeat(64) : '2'.repeat(64);
      assert.equal(e.headers['List-Unsubscribe'], `<https://cozy.test/api/newsletter/unsubscribe?token=${tok}>`);
      assert.ok(e.html.includes(`unsubscribe?token=${tok}`));
    }
    const issue = await DB.prepare('SELECT * FROM newsletter_issues WHERE id = ?').bind(r.data.issueId).first<any>();
    assert.equal(issue.recipient_count, 2);
    assert.equal(issue.sent_count, 2);
    assert.equal(issue.app_ids_json, '[413150]');
  });

  await test('send validation and unknown app ids', async () => {
    assert.equal((await call(adminEnv, '/api/admin/newsletter/send', { method: 'POST', headers: auth, body: { subject: '', intro: 'x' } })).status, 400);
    assert.equal((await call(adminEnv, '/api/admin/newsletter/send', { method: 'POST', headers: auth, body: { subject: 'x'.repeat(121), intro: 'x' } })).status, 400);
    assert.equal((await call(adminEnv, '/api/admin/newsletter/send', { method: 'POST', headers: auth, body: { subject: 's', intro: 'x', appIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] } })).status, 400);
    assert.equal((await call(adminEnv, '/api/admin/newsletter/send', { method: 'POST', headers: auth, body: { subject: 's', intro: 'x', appIds: [999] } })).status, 400);
    const noMailer = await call({ DB, APP_URL: 'https://cozy.test', ADMIN_TOKEN: 'admin-secret-123' }, '/api/admin/newsletter/send', { method: 'POST', headers: auth, body: { subject: 's', intro: 'x' } });
    assert.equal(noMailer.status, 503);
    assert.equal(captured.length, 0);
  });

  await test('send-pending-confirmations sends to offline-queued addresses', async () => {
    const r = await call(adminEnv, '/api/admin/newsletter/send-pending-confirmations', { method: 'POST', headers: auth });
    assert.equal(r.status, 200);
    const expected = await DB.prepare("SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE status = 'pending' AND confirm_sent_at IS NOT NULL AND email LIKE 'offline@%'").first<number>('n');
    assert.equal(expected, 1);
    assert.ok(r.data.eligible >= 1);
    assert.equal(r.data.sent, r.data.eligible);
    const to = (captured[0].body as any[]).map((e) => e.to[0]);
    assert.ok(to.includes('offline@example.com'));
    const tok = confirmTokenFrom((captured[0].body as any[]).find((e) => e.to[0] === 'offline@example.com').html);
    assert.equal((await call(adminEnv, `/api/newsletter/confirm?token=${tok}`)).status, 200);
    assert.equal((await subscriber('offline@example.com')).status, 'active');
  });

  await test('stats: counts, mailerConfigured, masked recipients', async () => {
    const r = await call(adminEnv, '/api/admin/newsletter/stats', { headers: auth });
    assert.equal(r.status, 200);
    assert.equal(r.data.mailerConfigured, true);
    const counts = await DB.prepare("SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE status = 'active'").first<number>('n');
    assert.equal(r.data.subscribers.active, counts);
    assert.ok(r.data.issues.length >= 1);
    assert.ok(r.data.recentEmails.length > 0);
    for (const e of r.data.recentEmails) assert.match(e.recipient, /^[^@]{1,2}\*\*\*@/);
    assert.doesNotMatch(r.text, /a1@example\.com/);
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
