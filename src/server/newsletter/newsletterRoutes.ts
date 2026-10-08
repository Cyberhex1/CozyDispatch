/**
 * Newsletter API (double opt-in) and admin endpoints.
 *
 *   POST /api/newsletter/subscribe
 *   GET  /api/newsletter/confirm?token=
 *   GET  /api/newsletter/unsubscribe?token=   (shows a button; never unsubscribes)
 *   POST /api/newsletter/unsubscribe?token=   (form or RFC 8058 one-click)
 *   GET  /api/admin/newsletter/stats
 *   POST /api/admin/newsletter/send
 *   POST /api/admin/newsletter/send-pending-confirmations
 */
import type { ID1Database } from '../db/d1Client';
import { clientIp, Env, escapeHtml, html, HttpError, json, randomToken, rateLimit, readJson, sha256Hex, siteOrigin } from '../http';
import { isValidAppId, isValidEmail, normalizeEmail, NewsletterSubscribeResult } from '../../shared/account';
import { steamAssetUrl, steamStoreUrl } from '../../shared/steam';
import { timingSafeEqualString } from '../auth/passwords';
import { confirmationEmail, issueEmail, IssueGame, simplePage } from './emailTemplates';
import { mailerConfigured, maskEmail, OutgoingEmail, sendEmail, sendEmailBatch } from './mailer';

const CONFIRM_VALID_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_RE = /^[0-9a-f]{64}$/;

const MSG_CHECK_INBOX = 'Almost there! Check your inbox for a confirmation link to finish subscribing.';
const MSG_OFFLINE =
  "Thanks! We've saved your address. Our newsletter emails aren't switched on yet — you'll get a confirmation email as soon as they are.";

interface SubscriberRow {
  id: string;
  email: string;
  status: 'pending' | 'active' | 'unsubscribed';
  confirm_token_hash: string | null;
  confirm_sent_at: string | null;
  unsubscribe_token: string;
}

function unsubscribeUrl(origin: string, token: string): string {
  return `${origin}/api/newsletter/unsubscribe?token=${token}`;
}

function listHeaders(origin: string, token: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl(origin, token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  };
}

function buildConfirmation(origin: string, email: string, confirmToken: string, unsubToken: string): OutgoingEmail {
  const rendered = confirmationEmail({
    origin,
    confirmUrl: `${origin}/api/newsletter/confirm?token=${confirmToken}`,
    unsubscribeUrl: unsubscribeUrl(origin, unsubToken)
  });
  return { to: email, ...rendered, headers: listHeaders(origin, unsubToken) };
}

function cleanSource(value: unknown): string {
  if (typeof value !== 'string') return 'footer';
  const s = value.trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(s) ? s : 'footer';
}

function page(status: number, title: string, heading: string, bodyHtml: string): Response {
  return html(simplePage({ title, heading, bodyHtml }), status);
}

// ---------------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------------

async function subscribe(request: Request, env: Env): Promise<Response> {
  const db = env.DB;
  if (!(await rateLimit(db, `subscribe:ip:${clientIp(request)}`, 5, 3600))) {
    throw new HttpError(429, 'Too many attempts. Please wait a bit and try again.');
  }
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) throw new HttpError(400, 'Please enter a valid email address.');
  const source = cleanSource(body.source);
  const online = mailerConfigured(env);
  const reply = (): Response =>
    json(
      online
        ? ({ status: 'check_inbox', message: MSG_CHECK_INBOX } satisfies NewsletterSubscribeResult)
        : ({ status: 'mailer_offline', message: MSG_OFFLINE } satisfies NewsletterSubscribeResult)
    );

  let row = await db.prepare('SELECT * FROM newsletter_subscribers WHERE email = ?').bind(email).first<SubscriberRow>();
  // Already confirmed: same answer as everyone else, nothing sent (no enumeration).
  if (row?.status === 'active') return reply();

  const now = new Date().toISOString();
  if (!row) {
    const id = crypto.randomUUID();
    const unsub = randomToken(32);
    await db
      .prepare(
        `INSERT INTO newsletter_subscribers (id, email, status, source, unsubscribe_token, created_at)
         VALUES (?, ?, 'pending', ?, ?, ?) ON CONFLICT(email) DO NOTHING`
      )
      .bind(id, email, source, unsub, now)
      .run();
    row = await db.prepare('SELECT * FROM newsletter_subscribers WHERE email = ?').bind(email).first<SubscriberRow>();
    if (!row) throw new Error('Subscriber insert failed.');
    if (row.status === 'active') return reply();
  } else if (row.status === 'unsubscribed') {
    await db.prepare(`UPDATE newsletter_subscribers SET status = 'pending', source = ? WHERE id = ?`).bind(source, row.id).run();
  }

  if (!online) {
    // Keep the address as pending; a confirmation goes out once mail is on.
    await db
      .prepare(`UPDATE newsletter_subscribers SET confirm_token_hash = NULL, confirm_sent_at = NULL WHERE id = ?`)
      .bind(row.id)
      .run();
    return reply();
  }

  // At most 3 confirmation emails per address per 24h; extra requests are silently skipped.
  if (!(await rateLimit(db, `confirm:email:${email}`, 3, 86400))) return reply();

  const confirmToken = randomToken(32);
  await db
    .prepare('UPDATE newsletter_subscribers SET confirm_token_hash = ?, confirm_sent_at = ? WHERE id = ?')
    .bind(await sha256Hex(confirmToken), now, row.id)
    .run();
  const outcome = await sendEmail(env, 'confirm', buildConfirmation(siteOrigin(request, env), email, confirmToken, row.unsubscribe_token));
  if (!outcome.ok) {
    // Leave it queued for send-pending-confirmations and tell the truth.
    await db
      .prepare('UPDATE newsletter_subscribers SET confirm_token_hash = NULL, confirm_sent_at = NULL WHERE id = ?')
      .bind(row.id)
      .run();
    throw new HttpError(502, "We couldn't send the confirmation email just now. Please try again in a few minutes.");
  }
  return reply();
}

async function confirm(env: Env, url: URL): Promise<Response> {
  const token = url.searchParams.get('token') || '';
  const invalid = () =>
    page(
      400,
      'Link expired',
      'This link has expired',
      `<p>That confirmation link is invalid, already used, or older than 7 days.</p>
<p>If you’ve already confirmed, you’re all set. Otherwise, sign up again from the <a href="/">Cozy Dispatch homepage</a> and we’ll send a fresh link.</p>`
    );
  if (!TOKEN_RE.test(token)) return invalid();

  const row = await env.DB
    .prepare(`SELECT * FROM newsletter_subscribers WHERE confirm_token_hash = ? AND status = 'pending'`)
    .bind(await sha256Hex(token))
    .first<SubscriberRow>();
  const sentAt = row?.confirm_sent_at ? Date.parse(row.confirm_sent_at) : NaN;
  if (!row || !Number.isFinite(sentAt) || Date.now() - sentAt > CONFIRM_VALID_MS) return invalid();

  await env.DB
    .prepare(
      `UPDATE newsletter_subscribers
       SET status = 'active', confirmed_at = ?, confirm_token_hash = NULL, unsubscribed_at = NULL
       WHERE id = ?`
    )
    .bind(new Date().toISOString(), row.id)
    .run();
  return page(
    200,
    'Subscribed',
    'You’re on the list',
    `<p>Thanks for confirming, <strong>${escapeHtml(row.email)}</strong>. The next Cozy Dispatch will land in your inbox.</p>
<p>Every email has an unsubscribe link at the bottom if you ever want a break.</p>`
  );
}

async function findByUnsubToken(db: ID1Database, token: string): Promise<SubscriberRow | null> {
  if (!TOKEN_RE.test(token)) return null;
  return db.prepare('SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = ?').bind(token).first<SubscriberRow>();
}

const BAD_UNSUB_BODY = `<p>That unsubscribe link isn’t valid. It may have been copied incompletely from the email.</p>
<p>Try the link at the bottom of any Cozy Dispatch email again.</p>`;

async function unsubscribeGet(env: Env, url: URL): Promise<Response> {
  const token = url.searchParams.get('token') || '';
  const row = await findByUnsubToken(env.DB, token);
  if (!row) return page(400, 'Invalid link', 'We couldn’t find that link', BAD_UNSUB_BODY);
  if (row.status === 'unsubscribed') {
    return page(200, 'Unsubscribed', 'You’re already unsubscribed', `<p><strong>${escapeHtml(row.email)}</strong> won’t receive any more newsletters.</p>`);
  }
  return page(
    200,
    'Unsubscribe',
    'Unsubscribe from Cozy Dispatch?',
    `<p>We’ll stop sending the newsletter to <strong>${escapeHtml(row.email)}</strong>.</p>
<form method="post" action="/api/newsletter/unsubscribe?token=${escapeHtml(token)}"><button type="submit">Unsubscribe</button></form>`
  );
}

async function unsubscribePost(request: Request, env: Env, url: URL): Promise<Response> {
  let token = url.searchParams.get('token') || '';
  if (!token) {
    const text = await request.text().catch(() => '');
    token = new URLSearchParams(text).get('token') || '';
  }
  const row = await findByUnsubToken(env.DB, token);
  if (!row) return page(400, 'Invalid link', 'We couldn’t find that link', BAD_UNSUB_BODY);
  if (row.status !== 'unsubscribed') {
    await env.DB
      .prepare(`UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = ?, confirm_token_hash = NULL WHERE id = ?`)
      .bind(new Date().toISOString(), row.id)
      .run();
  }
  return page(
    200,
    'Unsubscribed',
    'You’ve been unsubscribed',
    `<p><strong>${escapeHtml(row.email)}</strong> won’t receive any more Cozy Dispatch newsletters.</p>
<p class="muted">Changed your mind? You can sign up again any time from the homepage.</p>`
  );
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

async function requireAdmin(request: Request, env: Env): Promise<void> {
  if (!env.ADMIN_TOKEN) throw new HttpError(503, 'Admin endpoints are disabled.');
  const header = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const ok = await timingSafeEqualString(match ? match[1].trim() : '', env.ADMIN_TOKEN);
  if (!match || !ok) throw new HttpError(401, 'Invalid admin token.');
}

async function stats(env: Env): Promise<Response> {
  const db = env.DB;
  const [counts, unsent, issues, log] = await Promise.all([
    db.prepare('SELECT status, COUNT(*) AS n FROM newsletter_subscribers GROUP BY status').all<{ status: string; n: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE status = 'pending' AND confirm_sent_at IS NULL`).first<number>('n'),
    db
      .prepare('SELECT id, subject, app_ids_json, recipient_count, sent_count, failed_count, created_at FROM newsletter_issues ORDER BY created_at DESC LIMIT 10')
      .all<any>(),
    db.prepare('SELECT recipient, template, provider, status, error, created_at FROM email_log ORDER BY created_at DESC LIMIT 25').all<any>()
  ]);
  const subscribers = { pending: 0, active: 0, unsubscribed: 0, total: 0, pendingAwaitingConfirmationEmail: Number(unsent ?? 0) };
  for (const r of counts.results) {
    if (r.status === 'pending' || r.status === 'active' || r.status === 'unsubscribed') subscribers[r.status] = Number(r.n);
    subscribers.total += Number(r.n);
  }
  return json({
    mailerConfigured: mailerConfigured(env),
    subscribers,
    issues: issues.results.map((i) => ({
      id: i.id,
      subject: i.subject,
      appIds: JSON.parse(i.app_ids_json || '[]'),
      recipients: i.recipient_count,
      sent: i.sent_count,
      failed: i.failed_count,
      createdAt: i.created_at
    })),
    recentEmails: log.results.map((l) => ({
      recipient: maskEmail(l.recipient),
      template: l.template,
      provider: l.provider,
      status: l.status,
      error: l.error,
      createdAt: l.created_at
    }))
  });
}

function formatPrice(g: { is_free: number; price_cents: number | null; discount_pct: number }): string | null {
  if (g.is_free) return 'Free';
  if (g.price_cents == null) return null;
  const price = `$${(g.price_cents / 100).toFixed(2)}`;
  return g.discount_pct > 0 ? `${price} (−${g.discount_pct}%)` : price;
}

async function loadGames(db: ID1Database, appIds: number[]): Promise<IssueGame[]> {
  if (!appIds.length) return [];
  const { results } = await db
    .prepare(
      `SELECT app_id, title, short_description, asset_base, asset_version, header_file, is_free, price_cents, discount_pct
       FROM games WHERE app_id IN (${appIds.map(() => '?').join(',')})`
    )
    .bind(...appIds)
    .all<any>();
  const byId = new Map(results.map((r) => [Number(r.app_id), r]));
  const missing = appIds.filter((id) => !byId.has(id));
  if (missing.length) throw new HttpError(400, `Unknown app ids: ${missing.join(', ')}`);
  return appIds.map((id) => {
    const r = byId.get(id);
    return {
      appId: id,
      title: r.title,
      description: r.short_description ?? null,
      imageUrl: steamAssetUrl(r.asset_base, r.header_file, r.asset_version),
      price: formatPrice(r),
      storeUrl: steamStoreUrl(id)
    };
  });
}

async function sendIssue(request: Request, env: Env): Promise<Response> {
  if (!mailerConfigured(env)) throw new HttpError(503, 'Email delivery is not configured (RESEND_API_KEY / EMAIL_FROM).');
  const db = env.DB;
  const body = await readJson(request);
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const intro = typeof body.intro === 'string' ? body.intro.replace(/\r\n/g, '\n').trim() : '';
  if (subject.length < 1 || subject.length > 120 || /[\u0000-\u001f\u007f]/.test(subject)) {
    throw new HttpError(400, 'Subject must be 1–120 characters on a single line.');
  }
  if (intro.length < 1 || intro.length > 2000) throw new HttpError(400, 'Intro must be 1–2000 characters.');
  let appIds: number[] = [];
  if (body.appIds !== undefined) {
    if (!Array.isArray(body.appIds) || !body.appIds.every(isValidAppId)) throw new HttpError(400, 'appIds must be positive integers.');
    appIds = [...new Set(body.appIds as number[])];
    if (appIds.length > 8) throw new HttpError(400, 'Feature at most 8 games.');
  }

  const games = await loadGames(db, appIds);
  const origin = siteOrigin(request, env);
  const { results: recipients } = await db
    .prepare(`SELECT id, email, unsubscribe_token FROM newsletter_subscribers WHERE status = 'active' ORDER BY created_at`)
    .all<{ id: string; email: string; unsubscribe_token: string }>();

  const emails: OutgoingEmail[] = recipients.map((r) => {
    const rendered = issueEmail({ origin, subject, intro, games, unsubscribeUrl: unsubscribeUrl(origin, r.unsubscribe_token) });
    return { to: r.email, ...rendered, headers: listHeaders(origin, r.unsubscribe_token) };
  });
  const outcomes = emails.length ? await sendEmailBatch(env, 'issue', emails) : [];
  const sent = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.length - sent;

  const now = new Date().toISOString();
  const sentIds = recipients.filter((_, i) => outcomes[i]?.ok).map((r) => r.id);
  for (let i = 0; i < sentIds.length; i += 100) {
    await db.batch(
      sentIds.slice(i, i + 100).map((id) => db.prepare('UPDATE newsletter_subscribers SET last_sent_at = ? WHERE id = ?').bind(now, id))
    );
  }
  const issueId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO newsletter_issues (id, subject, intro, app_ids_json, recipient_count, sent_count, failed_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(issueId, subject, intro, JSON.stringify(appIds), recipients.length, sent, failed, now)
    .run();
  return json({ issueId, recipients: recipients.length, sent, failed });
}

async function sendPendingConfirmations(request: Request, env: Env): Promise<Response> {
  if (!mailerConfigured(env)) throw new HttpError(503, 'Email delivery is not configured (RESEND_API_KEY / EMAIL_FROM).');
  const db = env.DB;
  const origin = siteOrigin(request, env);
  const { results } = await db
    .prepare(`SELECT id, email, unsubscribe_token FROM newsletter_subscribers WHERE status = 'pending' AND confirm_sent_at IS NULL ORDER BY created_at LIMIT 1000`)
    .all<{ id: string; email: string; unsubscribe_token: string }>();

  const now = new Date().toISOString();
  const emails: OutgoingEmail[] = [];
  const updates = [];
  for (const r of results) {
    const token = randomToken(32);
    updates.push(
      db.prepare('UPDATE newsletter_subscribers SET confirm_token_hash = ?, confirm_sent_at = ? WHERE id = ?').bind(await sha256Hex(token), now, r.id)
    );
    emails.push(buildConfirmation(origin, r.email, token, r.unsubscribe_token));
  }
  for (let i = 0; i < updates.length; i += 100) await db.batch(updates.slice(i, i + 100));

  const outcomes = emails.length ? await sendEmailBatch(env, 'confirm', emails) : [];
  const failedIds = results.filter((_, i) => !outcomes[i]?.ok).map((r) => r.id);
  for (let i = 0; i < failedIds.length; i += 100) {
    await db.batch(
      failedIds.slice(i, i + 100).map((id) =>
        db.prepare('UPDATE newsletter_subscribers SET confirm_token_hash = NULL, confirm_sent_at = NULL WHERE id = ?').bind(id)
      )
    );
  }
  return json({ eligible: results.length, sent: results.length - failedIds.length, failed: failedIds.length });
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function only(method: string, allowed: string): void {
  if (method !== allowed) throw new HttpError(405, 'Method not allowed.');
}

export async function handleNewsletterRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  const method = request.method.toUpperCase();

  switch (path) {
    case '/api/newsletter/subscribe':
      only(method, 'POST');
      return subscribe(request, env);
    case '/api/newsletter/confirm':
      only(method, 'GET');
      return confirm(env, url);
    case '/api/newsletter/unsubscribe':
      if (method === 'GET') return unsubscribeGet(env, url);
      only(method, 'POST');
      return unsubscribePost(request, env, url);
    case '/api/admin/newsletter/stats':
      await requireAdmin(request, env);
      only(method, 'GET');
      return stats(env);
    case '/api/admin/newsletter/send':
      await requireAdmin(request, env);
      only(method, 'POST');
      return sendIssue(request, env);
    case '/api/admin/newsletter/send-pending-confirmations':
      await requireAdmin(request, env);
      only(method, 'POST');
      return sendPendingConfirmations(request, env);
    default:
      return null;
  }
}
