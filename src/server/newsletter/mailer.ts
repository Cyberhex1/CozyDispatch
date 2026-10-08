/**
 * Resend mail delivery (Workers-safe: fetch only). Every attempt is logged to
 * email_log without bodies or tokens. Without RESEND_API_KEY + EMAIL_FROM the
 * mailer reports itself as not configured and nothing is sent.
 */
import type { Env } from '../http';

const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch';
export const RESEND_BATCH_MAX = 100;

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface SendOutcome {
  to: string;
  ok: boolean;
  error?: string;
}

export function mailerConfigured(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

function payload(env: Env, email: OutgoingEmail) {
  return {
    from: env.EMAIL_FROM,
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
    ...(email.headers ? { headers: email.headers } : {})
  };
}

async function post(env: Env, url: string, body: unknown): Promise<{ ok: boolean; error?: string; data?: any }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || res.statusText || 'request failed';
      return { ok: false, error: `Resend ${res.status}: ${String(msg).slice(0, 200)}` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: `Resend unreachable: ${String((err as Error)?.message || err).slice(0, 200)}` };
  }
}

async function logOutcomes(env: Env, template: string, outcomes: SendOutcome[]): Promise<void> {
  if (!outcomes.length) return;
  const now = new Date().toISOString();
  const stmt = 'INSERT INTO email_log (id, recipient, template, provider, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)';
  for (let i = 0; i < outcomes.length; i += 100) {
    await env.DB.batch(
      outcomes.slice(i, i + 100).map((o) =>
        env.DB.prepare(stmt).bind(crypto.randomUUID(), o.to, template, 'resend', o.ok ? 'sent' : 'failed', o.error ?? null, now)
      )
    );
  }
}

/** Sends one email. Caller must check mailerConfigured first. */
export async function sendEmail(env: Env, template: string, email: OutgoingEmail): Promise<SendOutcome> {
  if (!mailerConfigured(env)) throw new Error('Mailer not configured.');
  const res = await post(env, RESEND_URL, payload(env, email));
  const outcome: SendOutcome = { to: email.to, ok: res.ok, error: res.error };
  await logOutcomes(env, template, [outcome]);
  return outcome;
}

/** Sends many emails through Resend's batch endpoint, 100 per request. */
export async function sendEmailBatch(env: Env, template: string, emails: OutgoingEmail[]): Promise<SendOutcome[]> {
  if (!mailerConfigured(env)) throw new Error('Mailer not configured.');
  const outcomes: SendOutcome[] = [];
  for (let i = 0; i < emails.length; i += RESEND_BATCH_MAX) {
    const chunk = emails.slice(i, i + RESEND_BATCH_MAX);
    const res = await post(env, RESEND_BATCH_URL, chunk.map((e) => payload(env, e)));
    const chunkOutcomes = chunk.map((e) => ({ to: e.to, ok: res.ok, error: res.error }));
    await logOutcomes(env, template, chunkOutcomes);
    outcomes.push(...chunkOutcomes);
  }
  return outcomes;
}

/** "maria@gmail.com" -> "ma***@gmail.com" */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  const local = email.slice(0, at);
  const keep = local.length > 2 ? 2 : 1;
  return `${local.slice(0, keep)}***${email.slice(at)}`;
}
