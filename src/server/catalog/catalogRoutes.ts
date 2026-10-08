/**
 * Read-only catalog + news API backed by the D1 tables the sync job fills.
 */
import type { ID1Database } from '../db/d1Client';
import { cachedJson, HttpError, json, type Env } from '../http';
import { deckStatusFromCategory, steamAssetUrl, steamStoreUrl } from '../../shared/steam';
import { GENRES, GENRE_BY_ID } from '../../shared/genres';
import type { Article, Game, GameQuery, GameSort, HomeFeed, SiteStats } from '../../shared/content';
import { cleanSteamAnnouncement, stripHtml } from '../../sync/newsSync';
import { fetchWithRetry } from '../../sync/steamStore';

const GAME_SORTS: GameSort[] = ['popular', 'rating', 'newest', 'discount', 'price', 'upcoming'];

function parseJsonArray<T>(value: unknown): T[] {
  try {
    const v = JSON.parse(String(value ?? '[]'));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function iso(ts: number | null | undefined): string | null {
  return ts ? new Date(ts * 1000).toISOString() : null;
}

export function rowToGame(r: any): Game {
  return {
    appId: r.app_id,
    slug: r.slug,
    title: r.title,
    description: r.short_description ? stripHtml(r.short_description) : null,
    developers: parseJsonArray<string>(r.developers_json),
    publishers: parseJsonArray<string>(r.publishers_json),
    headerImage: steamAssetUrl(r.asset_base, r.header_file, r.asset_version),
    capsuleImage: steamAssetUrl(r.asset_base, r.capsule_file, r.asset_version),
    heroImage: steamAssetUrl(r.asset_base, r.hero_file, r.asset_version),
    releaseDate: iso(r.release_ts),
    releaseLabel: r.release_label ?? null,
    comingSoon: Boolean(r.is_coming_soon),
    earlyAccess: Boolean(r.is_early_access),
    isFree: Boolean(r.is_free),
    price: r.price_cents ?? null,
    originalPrice: r.original_price_cents ?? null,
    discountPct: r.discount_pct ?? 0,
    discountEndsAt: iso(r.discount_ends_ts),
    reviewCount: r.review_count ?? 0,
    reviewPercent: r.review_percent ?? null,
    reviewLabel: r.review_label ?? null,
    deck: deckStatusFromCategory(r.deck_compat),
    tags: parseJsonArray<string>(r.tags_json),
    cozy: Boolean(r.is_cozy),
    indie: Boolean(r.is_indie),
    horror: Boolean(r.is_horror),
    genres: parseJsonArray<string>(r.genres_json),
    storeUrl: steamStoreUrl(r.app_id)
  };
}

export function rowToArticle(r: any): Article {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    summary: r.summary,
    url: r.url,
    source: r.source,
    author: r.author ?? null,
    imageUrl: r.image_url ?? null,
    publishedAt: new Date(r.published_ts * 1000).toISOString(),
    cozy: Boolean(r.is_cozy),
    indie: Boolean(r.is_indie),
    appIds: parseJsonArray<number>(r.app_ids_json)
  };
}

// Rating that doesn't let a 100% game with 12 reviews outrank a 97% game with 50k.
const RATING_ORDER = `(COALESCE(review_percent, 0) - 2500.0 / (review_count + 50)) DESC, review_count DESC`;

const ORDER_BY: Record<GameSort, string> = {
  popular: 'popularity ASC, review_count DESC',
  rating: RATING_ORDER,
  newest: 'release_ts DESC',
  discount: 'discount_pct DESC, popularity ASC',
  price: 'COALESCE(price_cents, 1000000000) ASC, popularity ASC',
  upcoming: 'popularity ASC'
};

export function parseGameQuery(url: URL): GameQuery {
  const p = url.searchParams;
  const section = p.get('section');
  const sort = p.get('sort') as GameSort | null;
  const deck = p.get('deck');
  const genre = p.get('genre');
  return {
    section: section === 'cozy' || section === 'indie' ? section : undefined,
    genre: genre && GENRE_BY_ID[genre] ? genre : undefined,
    q: (p.get('q') || '').trim().slice(0, 80) || undefined,
    deck: deck === 'verified' || deck === 'playable' ? deck : undefined,
    sale: p.get('sale') === '1',
    free: p.get('free') === '1',
    sort: sort && GAME_SORTS.includes(sort) ? sort : 'popular',
    page: Math.max(1, Math.min(500, parseInt(p.get('page') || '1', 10) || 1)),
    limit: Math.max(1, Math.min(60, parseInt(p.get('limit') || '24', 10) || 24))
  };
}

/** Exact membership test for an id inside a compact JSON array column. */
function jsonArrayHas(column: string, id: number): [string, unknown[]] {
  return [`(${column} = ? OR ${column} LIKE ? OR ${column} LIKE ? OR ${column} LIKE ?)`, [`[${id}]`, `[${id},%`, `%,${id},%`, `%,${id}]`]];
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function queryGames(db: ID1Database, q: GameQuery) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.section === 'cozy') where.push('is_cozy = 1');
  if (q.section === 'indie') where.push('is_indie = 1');
  if (q.genre) {
    where.push('genres_json LIKE ?');
    params.push(`%"${q.genre}"%`);
  }
  if (q.q) {
    const like = `%${escapeLike(q.q)}%`;
    where.push(`(title LIKE ? ESCAPE '\\' OR developers_json LIKE ? ESCAPE '\\' OR tags_json LIKE ? ESCAPE '\\')`);
    params.push(like, like, like);
  }
  if (q.deck === 'verified') where.push('deck_compat = 3');
  if (q.deck === 'playable') where.push('deck_compat >= 2');
  if (q.sale) where.push('discount_pct > 0');
  if (q.free) where.push('is_free = 1');
  // Searches include upcoming games; browsing lists separate them.
  if (q.sort === 'upcoming') where.push('is_coming_soon = 1');
  else if (!q.q) where.push('is_coming_soon = 0');

  const clause = `WHERE ${where.join(' AND ')}`;
  const limit = q.limit ?? 24;
  const page = q.page ?? 1;
  // When searching, title matches come first so "Hades" finds Hades before games merely tagged with it.
  const order = q.q ? `(title LIKE ? ESCAPE '\\') DESC, ${ORDER_BY[q.sort ?? 'popular']}` : ORDER_BY[q.sort ?? 'popular'];
  const orderParams = q.q ? [`${escapeLike(q.q)}%`] : [];

  const [countRow, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM games ${clause}`).bind(...params).first<{ n: number }>(),
    db
      .prepare(`SELECT * FROM games ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .bind(...params, ...orderParams, limit, (page - 1) * limit)
      .all()
  ]);
  return { items: rows.results.map(rowToGame), total: countRow?.n ?? 0, page, limit };
}

async function gamesWhere(db: ID1Database, sql: string, ...params: unknown[]): Promise<Game[]> {
  return (await db.prepare(`SELECT * FROM games WHERE ${sql}`).bind(...params).all()).results.map(rowToGame);
}

async function articlesWhere(db: ID1Database, sql: string, ...params: unknown[]): Promise<Article[]> {
  return (await db.prepare(`SELECT * FROM articles WHERE ${sql}`).bind(...params).all()).results.map(rowToArticle);
}

export async function getStats(db: ID1Database): Promise<SiteStats> {
  const [counts, catalogRun, newsRun] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS games, COALESCE(SUM(is_cozy),0) AS cozy, COALESCE(SUM(is_indie),0) AS indie FROM games WHERE is_coming_soon = 0`).first<any>(),
    db.prepare(`SELECT finished_at FROM sync_runs WHERE target = 'catalog' AND status = 'success' ORDER BY finished_at DESC LIMIT 1`).first<any>(),
    db.prepare(`SELECT finished_at FROM sync_runs WHERE target = 'news' AND status = 'success' ORDER BY finished_at DESC LIMIT 1`).first<any>()
  ]);
  return {
    games: counts?.games ?? 0,
    cozy: counts?.cozy ?? 0,
    indie: counts?.indie ?? 0,
    catalogUpdatedAt: catalogRun?.finished_at ?? null,
    newsUpdatedAt: newsRun?.finished_at ?? null
  };
}

export async function getHomeFeed(db: ID1Database): Promise<HomeFeed> {
  const now = Math.floor(Date.now() / 1000);
  const monthAgo = now - 30 * 86400;
  const [newReleases, cozyPopular, indiePopular, deals, upcoming, news, updates, stats] = await Promise.all([
    gamesWhere(db, `is_coming_soon = 0 AND release_ts BETWEEN ? AND ? ORDER BY review_count DESC LIMIT 9`, monthAgo, now),
    gamesWhere(db, `is_cozy = 1 AND is_coming_soon = 0 ORDER BY popularity LIMIT 8`),
    gamesWhere(db, `is_indie = 1 AND is_cozy = 0 AND is_coming_soon = 0 ORDER BY popularity LIMIT 8`),
    gamesWhere(db, `discount_pct > 0 AND review_count >= 1000 AND is_coming_soon = 0 ORDER BY popularity LIMIT 8`),
    gamesWhere(db, `is_coming_soon = 1 ORDER BY popularity LIMIT 6`),
    articlesWhere(db, `kind = 'news' ORDER BY published_ts DESC LIMIT 7`),
    articlesWhere(db, `kind = 'update' ORDER BY published_ts DESC LIMIT 6`),
    getStats(db)
  ]);
  const [lead, ...restNew] = newReleases;
  return {
    lead: lead ?? cozyPopular[0] ?? null,
    newReleases: lead ? restNew : newReleases,
    cozyPopular,
    indiePopular,
    deals,
    upcoming,
    news,
    updates,
    stats
  };
}

/** Recent official announcements for one game, straight from Steam (cached at the edge). */
async function liveAnnouncements(game: Game): Promise<Article[]> {
  try {
    const res = await fetchWithRetry(
      `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${game.appId}&count=5&maxlength=600&feeds=steam_community_announcements&format=json`,
      {},
      2
    );
    if (!res.ok) return [];
    const body: any = await res.json();
    return (body.appnews?.newsitems ?? []).map((n: any): Article => {
      const { text, image } = cleanSteamAnnouncement(n.contents || '');
      return {
        id: `u-${n.gid}`,
        kind: 'update',
        title: stripHtml(n.title),
        summary: text,
        url: n.url,
        source: game.title,
        author: n.author || null,
        imageUrl: image,
        publishedAt: new Date(n.date * 1000).toISOString(),
        cozy: game.cozy,
        indie: game.indie,
        appIds: [game.appId]
      };
    });
  } catch {
    return [];
  }
}

const TOP_LEVEL = new Set(['/api/home', '/api/genres', '/api/news', '/api/status']);

export async function handleCatalogRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  const path = url.pathname;
  if (!(path === '/api/games' || path.startsWith('/api/games/') || TOP_LEVEL.has(path))) return null;
  if (request.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
  const db = env.DB;

  if (path === '/api/home') return cachedJson(await getHomeFeed(db));
  if (path === '/api/status') return json(await getStats(db));

  if (path === '/api/genres') {
    const section = url.searchParams.get('section');
    const filter = section === 'cozy' ? 'AND is_cozy = 1' : section === 'indie' ? 'AND is_indie = 1' : '';
    const counts = await Promise.all(
      GENRES.filter((g) => !(section === 'cozy' && g.onlySection === 'indie')).map(async (g) => {
        const row = await db
          .prepare(`SELECT COUNT(*) AS n FROM games WHERE is_coming_soon = 0 AND genres_json LIKE ? ${filter}`)
          .bind(`%"${g.id}"%`)
          .first<{ n: number }>();
        return { id: g.id, label: g.label, count: row?.n ?? 0 };
      })
    );
    return cachedJson({ items: counts.filter((g) => g.count > 0) }, 900);
  }

  if (path === '/api/news') {
    const p = url.searchParams;
    const where: string[] = [];
    const params: unknown[] = [];
    const kind = p.get('kind');
    if (kind === 'news' || kind === 'update') {
      where.push('kind = ?');
      params.push(kind);
    }
    const section = p.get('section');
    if (section === 'cozy') where.push('is_cozy = 1');
    if (section === 'indie') where.push('is_indie = 1');
    const q = (p.get('q') || '').trim().slice(0, 80);
    if (q) {
      const l = `%${escapeLike(q)}%`;
      where.push(`(title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR source LIKE ? ESCAPE '\\')`);
      params.push(l, l, l);
    }
    const ids = (p.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
    if (ids.length) {
      where.push(`id IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    }
    const page = Math.max(1, parseInt(p.get('page') || '1', 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(p.get('limit') || '20', 10) || 20));
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [count, rows] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS n FROM articles ${clause}`).bind(...params).first<{ n: number }>(),
      db
        .prepare(`SELECT * FROM articles ${clause} ORDER BY published_ts DESC LIMIT ? OFFSET ?`)
        .bind(...params, limit, (page - 1) * limit)
        .all()
    ]);
    return cachedJson({ items: rows.results.map(rowToArticle), total: count?.n ?? 0, page, limit });
  }

  // /api/games, /api/games?ids=, /api/games/:appId, /api/games/:appId/updates
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 2) {
    const idsParam = url.searchParams.get('ids');
    if (idsParam !== null) {
      const ids = idsParam.split(',').map((s) => parseInt(s, 10)).filter((n) => n > 0).slice(0, 100);
      if (ids.length === 0) return json({ items: [] });
      const games = await gamesWhere(db, `app_id IN (${ids.map(() => '?').join(',')})`, ...ids);
      const byId = new Map(games.map((g) => [g.appId, g]));
      return json({ items: ids.map((id) => byId.get(id)).filter(Boolean) });
    }
    return cachedJson(await queryGames(db, parseGameQuery(url)));
  }

  const appId = parseInt(parts[2], 10);
  if (!(appId > 0) || parts.length > 4) throw new HttpError(404, 'Not found.');
  const row = await db.prepare('SELECT * FROM games WHERE app_id = ?').bind(appId).first();
  if (!row) throw new HttpError(404, 'That game isn’t in the catalog.');
  const game = rowToGame(row);

  if (parts.length === 4) {
    if (parts[3] !== 'updates') throw new HttpError(404, 'Not found.');
    return cachedJson({ items: await liveAnnouncements(game) }, 3600);
  }

  // Related: same section, most genres in common, popular first.
  const genreLikes = game.genres.map((g) => `%"${g}"%`);
  const related = game.genres.length
    ? await gamesWhere(
        db,
        `app_id != ? AND is_coming_soon = 0 AND ${game.cozy ? 'is_cozy = 1' : 'is_indie = 1'}
         AND (${game.genres.map(() => 'genres_json LIKE ?').join(' OR ')})
         ORDER BY (${game.genres.map(() => '(genres_json LIKE ?)').join(' + ')}) DESC, popularity ASC LIMIT 8`,
        appId,
        ...genreLikes,
        ...genreLikes
      )
    : [];
  const [hasApp, hasAppParams] = jsonArrayHas('app_ids_json', appId);
  const articles = await articlesWhere(db, `${hasApp} ORDER BY published_ts DESC LIMIT 6`, ...hasAppParams);
  return cachedJson({ game, related, articles });
}
