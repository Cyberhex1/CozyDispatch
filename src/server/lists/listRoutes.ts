/**
 * Game lists a member curates and shares by link.
 *
 *   GET    /api/lists/:id          anyone with the link
 *   GET    /api/me/lists           the signed-in member's lists
 *   POST   /api/me/lists           { title, description?, appIds? }
 *   PATCH  /api/me/lists/:id       { title?, description?, appIds? }  (appIds replaces the whole order)
 *   DELETE /api/me/lists/:id
 */
import type { ID1Database } from '../db/d1Client';
import { Env, HttpError, json, rateLimit, readJson } from '../http';
import { resolveSession } from '../auth/sessions';
import { rowToGame } from '../catalog/catalogRoutes';
import {
  DEFAULT_AVATAR,
  LISTS_PER_USER_MAX,
  LIST_GAMES_MAX,
  isAvatar,
  isValidAppId,
  isValidListId,
  validateListDescription,
  validateListTitle
} from '../../shared/account';
import type { GameList, GameListSummary } from '../../shared/lists';

interface ListRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  app_ids_json: string;
  created_at: string;
  updated_at: string;
}

const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function newListId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join('');
}

function appIdsOf(row: ListRow): number[] {
  try {
    const v = JSON.parse(row.app_ids_json || '[]');
    return Array.isArray(v) ? v.filter(isValidAppId) : [];
  } catch {
    return [];
  }
}

function summary(row: ListRow): GameListSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    appIds: appIdsOf(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function cleanText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function parseAppIds(value: unknown): number[] {
  if (!Array.isArray(value) || !value.every(isValidAppId)) throw new HttpError(400, 'appIds must be a list of game ids.');
  const ids = [...new Set(value as number[])];
  if (ids.length > LIST_GAMES_MAX) throw new HttpError(400, `A list can hold at most ${LIST_GAMES_MAX} games.`);
  return ids;
}

/** Keeps only ids that are in the catalog, in the order given. */
async function knownAppIds(db: ID1Database, ids: number[]): Promise<number[]> {
  if (!ids.length) return [];
  const { results } = await db
    .prepare(`SELECT app_id FROM games WHERE app_id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids)
    .all<{ app_id: number }>();
  const known = new Set(results.map((r) => Number(r.app_id)));
  return ids.filter((id) => known.has(id));
}

async function publicList(db: ID1Database, id: string, viewerId: string | null): Promise<Response> {
  const row = await db
    .prepare(
      `SELECT l.*, u.display_name, u.avatar FROM game_lists l JOIN users u ON u.id = l.user_id WHERE l.id = ?`
    )
    .bind(id)
    .first<ListRow & { display_name: string; avatar: string }>();
  if (!row) throw new HttpError(404, 'That list doesn’t exist, or its owner deleted it.');
  const ids = appIdsOf(row);
  const games = ids.length
    ? (await db.prepare(`SELECT * FROM games WHERE app_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results.map(rowToGame)
    : [];
  const byId = new Map(games.map((g) => [g.appId, g]));
  const list: GameList = {
    ...summary(row),
    owner: { displayName: row.display_name, avatar: isAvatar(row.avatar) ? row.avatar : DEFAULT_AVATAR },
    isOwner: viewerId === row.user_id,
    games: ids.map((i) => byId.get(i)).filter((g) => g !== undefined)
  };
  return json(list, 200, { 'Cache-Control': 'no-store' });
}

async function ownList(db: ID1Database, userId: string, id: string): Promise<ListRow> {
  const row = await db.prepare('SELECT * FROM game_lists WHERE id = ? AND user_id = ?').bind(id, userId).first<ListRow>();
  if (!row) throw new HttpError(404, 'That list doesn’t exist, or isn’t yours.');
  return row;
}

async function myLists(db: ID1Database, userId: string): Promise<GameListSummary[]> {
  const { results } = await db
    .prepare('SELECT * FROM game_lists WHERE user_id = ? ORDER BY updated_at DESC')
    .bind(userId)
    .all<ListRow>();
  return results.map(summary);
}

async function createList(request: Request, db: ID1Database, userId: string): Promise<Response> {
  if (!(await rateLimit(db, `lists:user:${userId}`, 30, 3600))) throw new HttpError(429, 'You’re making lists very quickly. Please wait a bit.');
  const body = await readJson(request);
  const titleError = validateListTitle(body.title);
  if (titleError) throw new HttpError(400, titleError);
  const description = body.description === undefined ? '' : body.description;
  const descError = validateListDescription(description);
  if (descError) throw new HttpError(400, descError);
  const appIds = body.appIds === undefined ? [] : await knownAppIds(db, parseAppIds(body.appIds));

  const count = await db.prepare('SELECT COUNT(*) AS n FROM game_lists WHERE user_id = ?').bind(userId).first<number>('n');
  if ((count ?? 0) >= LISTS_PER_USER_MAX) throw new HttpError(400, `You can have up to ${LISTS_PER_USER_MAX} lists.`);

  const now = new Date().toISOString();
  const id = newListId();
  await db
    .prepare('INSERT INTO game_lists (id, user_id, title, description, app_ids_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, cleanText(body.title as string), cleanText(description as string), JSON.stringify(appIds), now, now)
    .run();
  return json(summary(await ownList(db, userId, id)), 201);
}

async function updateList(request: Request, db: ID1Database, userId: string, id: string): Promise<Response> {
  await ownList(db, userId, id);
  const body = await readJson(request);
  const sets: string[] = [];
  const values: unknown[] = [];
  if (body.title !== undefined) {
    const err = validateListTitle(body.title);
    if (err) throw new HttpError(400, err);
    sets.push('title = ?');
    values.push(cleanText(body.title as string));
  }
  if (body.description !== undefined) {
    const err = validateListDescription(body.description);
    if (err) throw new HttpError(400, err);
    sets.push('description = ?');
    values.push(cleanText(body.description as string));
  }
  if (body.appIds !== undefined) {
    sets.push('app_ids_json = ?');
    values.push(JSON.stringify(await knownAppIds(db, parseAppIds(body.appIds))));
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    values.push(new Date().toISOString());
    await db.prepare(`UPDATE game_lists SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).bind(...values, id, userId).run();
  }
  return json(summary(await ownList(db, userId, id)));
}

export async function handleListRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  const method = request.method.toUpperCase();
  const db = env.DB;

  const publicMatch = /^\/api\/lists\/([^/]+)$/.exec(path);
  if (publicMatch) {
    if (method !== 'GET') throw new HttpError(405, 'Method not allowed.');
    if (!isValidListId(publicMatch[1])) throw new HttpError(404, 'That list doesn’t exist, or its owner deleted it.');
    const session = await resolveSession(request, db);
    return publicList(db, publicMatch[1], session?.userId ?? null);
  }

  const mine = /^\/api\/me\/lists(?:\/([^/]+))?$/.exec(path);
  if (!mine) return null;
  const session = await resolveSession(request, db);
  if (!session) throw new HttpError(401, 'Sign in to make lists.');
  const userId = session.userId;

  if (!mine[1]) {
    if (method === 'GET') return json({ items: await myLists(db, userId) });
    if (method === 'POST') return createList(request, db, userId);
    throw new HttpError(405, 'Method not allowed.');
  }
  const id = mine[1];
  if (!isValidListId(id)) throw new HttpError(404, 'That list doesn’t exist, or isn’t yours.');
  if (method === 'PATCH') return updateList(request, db, userId, id);
  if (method === 'DELETE') {
    await ownList(db, userId, id);
    await db.prepare('DELETE FROM game_lists WHERE id = ? AND user_id = ?').bind(id, userId).run();
    return json({ ok: true });
  }
  throw new HttpError(405, 'Method not allowed.');
}
