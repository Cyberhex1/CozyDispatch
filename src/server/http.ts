/**
 * Shared request/response helpers for the API (Workers-safe: Web APIs only).
 */
import type { ID1Database } from './db/d1Client';

export interface Env {
  DB: ID1Database;
  /** Public site origin used in email links, e.g. https://cozydispatch.pages.dev */
  APP_URL?: string;
  /** Resend API key. Without it no email is sent and the newsletter says so. */
  RESEND_API_KEY?: string;
  /** From header for outgoing mail, e.g. "Cozy Dispatch <hello@yourdomain.com>" */
  EMAIL_FROM?: string;
  /** Bearer token for /api/admin/*. Admin endpoints are disabled when unset. */
  ADMIN_TOKEN?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json; charset=utf-8');
  if (!h.has('Cache-Control')) h.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function errorResponse(status: number, message: string): Response {
  return json({ error: message }, status);
}

/** Public, cacheable JSON (catalog/news reads). */
export function cachedJson(data: unknown, maxAgeSeconds = 300): Response {
  return json(data, 200, {
    'Cache-Control': `public, max-age=60, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`
  });
}

export function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Expected a JSON body.');
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    'local'
  );
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function siteOrigin(request: Request, env: Env): string {
  return (env.APP_URL || new URL(request.url).origin).replace(/\/+$/, '');
}

/**
 * Rejects cross-site state-changing requests. Browsers always send Origin on
 * POST/PUT/DELETE; together with SameSite=Lax cookies this blocks CSRF.
 */
export function assertSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  const origin = request.headers.get('Origin');
  if (!origin) return; // non-browser clients (curl, tests)
  if (origin !== new URL(request.url).origin) throw new HttpError(403, 'Cross-site request blocked.');
}

/**
 * Fixed-window rate limit stored in D1. Returns false when the caller is over
 * the limit for the current window.
 */
export async function rateLimit(db: ID1Database, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count`
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 1) <= limit;
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
