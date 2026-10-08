/**
 * Account API: /api/auth/* and /api/me*. Cookie sessions only, same-origin
 * (the router enforces assertSameOrigin before dispatching here).
 */
import type { ID1Database, ID1PreparedStatement } from '../db/d1Client';
import { clientIp, Env, HttpError, json, rateLimit, readJson } from '../http';
import {
  AccountState,
  Avatar,
  BIO_MAX,
  DEFAULT_AVATAR,
  SAVED_ITEMS_CAP,
  isAvatar,
  isValidAppId,
  isValidArticleId,
  isValidEmail,
  normalizeEmail,
  validateBio,
  validateDisplayName,
  validatePassword
} from '../../shared/account';
import { dummyVerify, hashPassword, verifyPassword } from './passwords';
import {
  Session,
  clearSessionCookie,
  createSession,
  deleteSession,
  hasSessionCookie,
  pruneExpiredSessions,
  resolveSession,
  revokeOtherSessions,
  sessionCookie
} from './sessions';

const TOO_MANY = 'Too many attempts. Please wait a bit and try again.';
const BAD_CREDENTIALS = 'Email or password is incorrect.';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  hash_iterations: number;
  display_name: string;
  avatar: string;
  bio: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function badRequest(message: string): never {
  throw new HttpError(400, message);
}

function methodNotAllowed(): never {
  throw new HttpError(405, 'Method not allowed.');
}

function notSignedIn(request: Request): Response {
  const headers: HeadersInit = hasSessionCookie(request) ? { 'Set-Cookie': clearSessionCookie(request) } : {};
  // Checking "am I signed in?" is a normal question, not an error: answer with an
  // empty 204 so signed-out visitors don't get a failed request on every page.
  if (request.method === 'GET' && new URL(request.url).pathname === '/api/me') {
    return new Response(null, { status: 204, headers: { ...headers, 'Cache-Control': 'no-store' } });
  }
  return json({ error: 'Not signed in.' }, 401, headers);
}

async function getUserRow(db: ID1Database, userId: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
}

async function loadWishlist(db: ID1Database, userId: string): Promise<number[]> {
  const { results } = await db
    .prepare('SELECT app_id FROM user_wishlist WHERE user_id = ? ORDER BY added_at DESC, rowid DESC')
    .bind(userId)
    .all<{ app_id: number }>();
  return results.map((r) => Number(r.app_id));
}

async function loadBookmarks(db: ID1Database, userId: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT article_id FROM user_bookmarks WHERE user_id = ? ORDER BY added_at DESC, rowid DESC')
    .bind(userId)
    .all<{ article_id: string }>();
  return results.map((r) => r.article_id);
}

async function loadState(db: ID1Database, user: UserRow): Promise<AccountState> {
  const [wishlist, bookmarks] = await Promise.all([loadWishlist(db, user.id), loadBookmarks(db, user.id)]);
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatar: isAvatar(user.avatar) ? user.avatar : DEFAULT_AVATAR,
      bio: user.bio,
      memberSince: user.created_at
    },
    wishlist,
    bookmarks
  };
}

function cleanBio(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function signup(request: Request, env: Env): Promise<Response> {
  const db = env.DB;
  if (!(await rateLimit(db, `signup:ip:${clientIp(request)}`, 5, 3600))) throw new HttpError(429, TOO_MANY);

  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) badRequest('Please enter a valid email address.');
  const passwordError = validatePassword(body.password);
  if (passwordError) badRequest(passwordError);
  const nameError = validateDisplayName(body.displayName);
  if (nameError) badRequest(nameError);
  const password = body.password as string;
  const displayName = (body.displayName as string).trim();

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) throw new HttpError(409, 'An account with that email already exists.');

  const hashed = await hashPassword(password);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO users (id, email, password_hash, salt, hash_iterations, display_name, avatar, bio, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)`
      )
      .bind(id, email, hashed.hash, hashed.salt, hashed.iterations, displayName, DEFAULT_AVATAR, now, now)
      .run();
  } catch (err) {
    if (/unique/i.test(String((err as Error)?.message))) {
      throw new HttpError(409, 'An account with that email already exists.');
    }
    throw err;
  }

  const token = await createSession(db, id);
  const user = (await getUserRow(db, id))!;
  return json(await loadState(db, user), 201, { 'Set-Cookie': sessionCookie(request, token) });
}

async function login(request: Request, env: Env): Promise<Response> {
  const db = env.DB;
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = str(body.password);

  const ipOk = await rateLimit(db, `login:ip:${clientIp(request)}`, 10, 900);
  const emailOk = email ? await rateLimit(db, `login:email:${email}`, 10, 900) : true;
  if (!ipOk || !emailOk) throw new HttpError(429, TOO_MANY);

  if (!email || !password || password.length > 1000) throw new HttpError(401, BAD_CREDENTIALS);

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!user) {
    await dummyVerify(password);
    throw new HttpError(401, BAD_CREDENTIALS);
  }
  const ok = await verifyPassword(password, { hash: user.password_hash, salt: user.salt, iterations: user.hash_iterations });
  if (!ok) throw new HttpError(401, BAD_CREDENTIALS);

  await pruneExpiredSessions(db);
  const token = await createSession(db, user.id);
  return json(await loadState(db, user), 200, { 'Set-Cookie': sessionCookie(request, token) });
}

async function logout(request: Request, env: Env): Promise<Response> {
  const session = await resolveSession(request, env.DB);
  if (session) await deleteSession(env.DB, session.tokenHash);
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

async function patchMe(request: Request, db: ID1Database, user: UserRow): Promise<Response> {
  const body = await readJson(request);
  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.displayName !== undefined) {
    const err = validateDisplayName(body.displayName);
    if (err) badRequest(err);
    sets.push('display_name = ?');
    values.push((body.displayName as string).trim());
  }
  if (body.avatar !== undefined) {
    if (!isAvatar(body.avatar)) badRequest('Please pick one of the available avatars.');
    sets.push('avatar = ?');
    values.push(body.avatar as Avatar);
  }
  if (body.bio !== undefined) {
    const err = validateBio(body.bio);
    if (err) badRequest(err);
    const bio = cleanBio(body.bio as string);
    if (bio.length > BIO_MAX) badRequest(`Bio must be at most ${BIO_MAX} characters.`);
    sets.push('bio = ?');
    values.push(bio);
  }

  if (sets.length) {
    sets.push('updated_at = ?');
    values.push(new Date().toISOString());
    await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...values, user.id).run();
  }
  return json(await loadState(db, (await getUserRow(db, user.id))!));
}

async function changePassword(request: Request, db: ID1Database, user: UserRow, session: Session): Promise<Response> {
  if (!(await rateLimit(db, `password:user:${user.id}`, 10, 900))) throw new HttpError(429, TOO_MANY);
  const body = await readJson(request);
  const current = str(body.currentPassword);
  const ok = current.length > 0 && current.length <= 1000 &&
    (await verifyPassword(current, { hash: user.password_hash, salt: user.salt, iterations: user.hash_iterations }));
  if (!ok) throw new HttpError(403, 'Your current password is incorrect.');
  const err = validatePassword(body.newPassword);
  if (err) badRequest(err);

  const hashed = await hashPassword(body.newPassword as string);
  await db
    .prepare('UPDATE users SET password_hash = ?, salt = ?, hash_iterations = ?, updated_at = ? WHERE id = ?')
    .bind(hashed.hash, hashed.salt, hashed.iterations, new Date().toISOString(), user.id)
    .run();
  await revokeOtherSessions(db, user.id, session.tokenHash);
  return json({ ok: true });
}

async function deleteAccount(request: Request, db: ID1Database, user: UserRow): Promise<Response> {
  if (!(await rateLimit(db, `password:user:${user.id}`, 10, 900))) throw new HttpError(429, TOO_MANY);
  const body = await readJson(request);
  const password = str(body.password);
  const ok = password.length > 0 && password.length <= 1000 &&
    (await verifyPassword(password, { hash: user.password_hash, salt: user.salt, iterations: user.hash_iterations }));
  if (!ok) throw new HttpError(403, 'That password is incorrect.');

  // Explicit deletes so nothing is left behind even if FK cascades are off.
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM user_wishlist WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM user_bookmarks WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM users WHERE id = ?').bind(user.id)
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
}

// ---------------------------------------------------------------------------
// Saved items
// ---------------------------------------------------------------------------

async function putWishlist(db: ID1Database, userId: string, appId: number): Promise<Response> {
  const exists = await db.prepare('SELECT 1 AS x FROM user_wishlist WHERE user_id = ? AND app_id = ?').bind(userId, appId).first();
  if (!exists) {
    const count = await db.prepare('SELECT COUNT(*) AS n FROM user_wishlist WHERE user_id = ?').bind(userId).first<number>('n');
    if ((count ?? 0) >= SAVED_ITEMS_CAP) badRequest(`Your wishlist is full (${SAVED_ITEMS_CAP} games).`);
    await db
      .prepare('INSERT OR IGNORE INTO user_wishlist (user_id, app_id, added_at) VALUES (?, ?, ?)')
      .bind(userId, appId, new Date().toISOString())
      .run();
  }
  return json({ wishlist: await loadWishlist(db, userId) });
}

async function putBookmark(db: ID1Database, userId: string, articleId: string): Promise<Response> {
  const exists = await db.prepare('SELECT 1 AS x FROM user_bookmarks WHERE user_id = ? AND article_id = ?').bind(userId, articleId).first();
  if (!exists) {
    const count = await db.prepare('SELECT COUNT(*) AS n FROM user_bookmarks WHERE user_id = ?').bind(userId).first<number>('n');
    if ((count ?? 0) >= SAVED_ITEMS_CAP) badRequest(`Your bookmarks are full (${SAVED_ITEMS_CAP} articles).`);
    await db
      .prepare('INSERT OR IGNORE INTO user_bookmarks (user_id, article_id, added_at) VALUES (?, ?, ?)')
      .bind(userId, articleId, new Date().toISOString())
      .run();
  }
  return json({ bookmarks: await loadBookmarks(db, userId) });
}

async function merge(request: Request, db: ID1Database, user: UserRow): Promise<Response> {
  const body = await readJson<{ wishlist?: unknown; bookmarks?: unknown }>(request);
  if (body.wishlist !== undefined && !Array.isArray(body.wishlist)) badRequest('wishlist must be an array.');
  if (body.bookmarks !== undefined && !Array.isArray(body.bookmarks)) badRequest('bookmarks must be an array.');
  const inWishlist = (body.wishlist as unknown[] | undefined) ?? [];
  const inBookmarks = (body.bookmarks as unknown[] | undefined) ?? [];
  if (inWishlist.length > SAVED_ITEMS_CAP || inBookmarks.length > SAVED_ITEMS_CAP) badRequest('Too many items to merge.');

  const [wishlist, bookmarks] = await Promise.all([loadWishlist(db, user.id), loadBookmarks(db, user.id)]);
  const haveApps = new Set(wishlist);
  const haveArticles = new Set(bookmarks);
  // Incoming lists are newest first; descending timestamps keep that order.
  // They were saved recently (while signed out), so they sort ahead of
  // older account items.
  const base = Date.now();
  const statements: ID1PreparedStatement[] = [];

  let room = SAVED_ITEMS_CAP - wishlist.length;
  inWishlist.forEach((value, i) => {
    if (room <= 0 || !isValidAppId(value) || haveApps.has(value)) return;
    haveApps.add(value);
    room--;
    statements.push(
      db.prepare('INSERT OR IGNORE INTO user_wishlist (user_id, app_id, added_at) VALUES (?, ?, ?)')
        .bind(user.id, value, new Date(base - i).toISOString())
    );
  });

  room = SAVED_ITEMS_CAP - bookmarks.length;
  inBookmarks.forEach((value, i) => {
    if (room <= 0 || !isValidArticleId(value) || haveArticles.has(value)) return;
    haveArticles.add(value);
    room--;
    statements.push(
      db.prepare('INSERT OR IGNORE INTO user_bookmarks (user_id, article_id, added_at) VALUES (?, ?, ?)')
        .bind(user.id, value, new Date(base - i).toISOString())
    );
  });

  if (statements.length) await db.batch(statements);
  return json(await loadState(db, user));
}

function parseAppId(raw: string): number {
  if (!/^[1-9]\d{0,15}$/.test(raw)) badRequest('Invalid game id.');
  const id = Number(raw);
  if (!isValidAppId(id)) badRequest('Invalid game id.');
  return id;
}

function parseArticleId(raw: string): string {
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    badRequest('Invalid article id.');
  }
  if (!isValidArticleId(id)) badRequest('Invalid article id.');
  return id;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function handleAccountRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  const method = request.method.toUpperCase();

  if (path.startsWith('/api/auth/')) {
    const handlers: Record<string, (r: Request, e: Env) => Promise<Response>> = {
      '/api/auth/signup': signup,
      '/api/auth/login': login,
      '/api/auth/logout': logout
    };
    const handler = handlers[path];
    if (!handler) return null;
    if (method !== 'POST') methodNotAllowed();
    return handler(request, env);
  }

  if (path !== '/api/me' && !path.startsWith('/api/me/')) return null;

  // Recognise the route before touching the session so unknown paths 404.
  const sub = path.slice('/api/me'.length); // '' | '/wishlist/123' | ...
  const wishMatch = /^\/wishlist\/([^/]+)$/.exec(sub);
  const bookmarkMatch = /^\/bookmarks\/(.+)$/.exec(sub);
  const known = sub === '' || sub === '/merge' || sub === '/password' || wishMatch || bookmarkMatch;
  if (!known) return null;

  const db = env.DB;
  const session = await resolveSession(request, db);
  if (!session) return notSignedIn(request);
  const user = await getUserRow(db, session.userId);
  if (!user) {
    await deleteSession(db, session.tokenHash);
    return notSignedIn(request);
  }

  if (sub === '') {
    if (method === 'GET') return json(await loadState(db, user));
    if (method === 'PATCH') return patchMe(request, db, user);
    if (method === 'DELETE') return deleteAccount(request, db, user);
    methodNotAllowed();
  }
  if (sub === '/merge') {
    if (method !== 'POST') methodNotAllowed();
    return merge(request, db, user);
  }
  if (sub === '/password') {
    if (method !== 'POST') methodNotAllowed();
    return changePassword(request, db, user, session);
  }
  if (wishMatch) {
    const appId = parseAppId(wishMatch[1]);
    if (method === 'PUT') return putWishlist(db, user.id, appId);
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM user_wishlist WHERE user_id = ? AND app_id = ?').bind(user.id, appId).run();
      return json({ wishlist: await loadWishlist(db, user.id) });
    }
    methodNotAllowed();
  }
  if (bookmarkMatch) {
    const articleId = parseArticleId(bookmarkMatch[1]);
    if (method === 'PUT') return putBookmark(db, user.id, articleId);
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM user_bookmarks WHERE user_id = ? AND article_id = ?').bind(user.id, articleId).run();
      return json({ bookmarks: await loadBookmarks(db, user.id) });
    }
    methodNotAllowed();
  }
  return null;
}
