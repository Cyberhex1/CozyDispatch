/**
 * Cookie sessions. The browser holds a random 32-byte token in an HttpOnly
 * cookie; D1 stores only its SHA-256 hash. Sessions last 30 days and slide
 * forward at most once per 24h of activity.
 */
import type { ID1Database } from '../db/d1Client';
import { getCookie, randomToken, sha256Hex } from '../http';

export const SESSION_COOKIE = 'cd_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
const TOKEN_RE = /^[0-9a-f]{64}$/;

export interface Session {
  userId: string;
  tokenHash: string;
}

function cookieAttributes(request: Request, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function sessionCookie(request: Request, token: string): string {
  return `${SESSION_COOKIE}=${token}; ${cookieAttributes(request, SESSION_TTL_SECONDS)}`;
}

export function clearSessionCookie(request: Request): string {
  return `${SESSION_COOKIE}=; ${cookieAttributes(request, 0)}`;
}

/** The raw token from the cookie, if it is well-formed. Never read from headers or query. */
export function readSessionToken(request: Request): string | null {
  const token = getCookie(request, SESSION_COOKIE);
  return token && TOKEN_RE.test(token) ? token : null;
}

export function hasSessionCookie(request: Request): boolean {
  return getCookie(request, SESSION_COOKIE) !== null;
}

export async function createSession(db: ID1Database, userId: string): Promise<string> {
  const token = randomToken(32);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_active_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, now.toISOString(), now.toISOString(), expires.toISOString())
    .run();
  return token;
}

/** Resolves the session from the cookie; deletes it if expired; slides expiry once per 24h. */
export async function resolveSession(request: Request, db: ID1Database): Promise<Session | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare('SELECT user_id, last_active_at, expires_at FROM sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ user_id: string; last_active_at: string; expires_at: string }>();
  if (!row) return null;

  const now = Date.now();
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }

  const lastActive = Date.parse(row.last_active_at);
  if (!Number.isFinite(lastActive) || now - lastActive >= REFRESH_AFTER_MS) {
    await db
      .prepare('UPDATE sessions SET last_active_at = ?, expires_at = ? WHERE token_hash = ?')
      .bind(new Date(now).toISOString(), new Date(now + SESSION_TTL_SECONDS * 1000).toISOString(), tokenHash)
      .run();
  }
  return { userId: row.user_id, tokenHash };
}

export async function deleteSession(db: ID1Database, tokenHash: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
}

export async function revokeOtherSessions(db: ID1Database, userId: string, keepTokenHash: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(userId, keepTokenHash).run();
}

export async function pruneExpiredSessions(db: ID1Database): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run();
}
