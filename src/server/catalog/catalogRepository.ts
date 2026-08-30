/**
 * src/server/catalog/catalogRepository.ts
 *
 * D1-backed Game Catalog, News Articles, and Incremental Sync State Storage.
 * Provides fast, indexed queries and state persistence for scheduled updates.
 */

import { ID1Database } from '../db/d1Client';

export interface GameCatalogRecord {
  id: string;
  title: string;
  slug: string;
  developer?: string;
  publisher?: string;
  shortDescription?: string;
  fullDescription?: string;
  headerImage?: string;
  capsuleImage?: string;
  coverImage?: string;
  bannerImage?: string;
  price?: {
    original: number;
    current: number;
    discountPercent: number;
    isFree: boolean;
  };
  releaseDate?: string;
  steamDeckStatus?: string;
  steamDeckNotes?: string;
  cozyScore?: number;
  ratingScore?: number;
  reviewCount?: number;
  reviewSentiment?: string;
  categories?: string[];
  tags?: string[];
  vibes?: string[];
  [key: string]: any;
}

export interface NewsArticleRecord {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  imageUrl?: string;
  author?: string;
  readTimeMinutes?: number;
  tags?: string[];
  relatedGameId?: string;
  relatedGameTitle?: string;
  geminiEnriched?: boolean;
  geminiSummary?: string;
  geminiBullets?: string[];
  geminiSentiment?: string;
  steamDeckImpact?: string;
  [key: string]: any;
}

export interface IngestionJobState {
  status: 'idle' | 'running' | 'success' | 'error';
  lastRunAt?: string;
  lastSuccessAt?: string;
  itemsProcessed: number;
  newItemsCount: number;
  updatedItemsCount: number;
  skippedCount: number;
  lastError?: string;
  knownIds?: string[];
  contentHashes?: Record<string, string>;
}

export interface SystemIngestionState {
  version: string;
  news: IngestionJobState;
  catalog: IngestionJobState;
  rankings: IngestionJobState;
}

// ============================================================================
// Catalog Queries
// ============================================================================

export async function queryGamesCatalog(
  db: ID1Database,
  params: {
    category?: string;
    search?: string;
    deckVerified?: boolean;
    sort?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ success: boolean; total: number; page: number; limit: number; games: any[] }> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(500, params.limit || 100));
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM games_catalog WHERE 1=1';
  const queryParams: any[] = [];

  if (params.deckVerified) {
    query += ' AND steam_deck_status = ?';
    queryParams.push('Verified');
  }

  if (params.category && params.category !== 'all') {
    query += ' AND (categories_json LIKE ? OR tags_json LIKE ?)';
    const catPattern = `%"${params.category}"%`;
    queryParams.push(catPattern, catPattern);
  }

  if (params.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    query += ' AND (title LIKE ? OR developer LIKE ? OR short_description LIKE ? OR tags_json LIKE ?)';
    queryParams.push(q, q, q, q);
  }

  // Count total matching
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countRow = await db.prepare(countQuery).bind(...queryParams).first<{ count: number }>();
  const total = countRow?.count || 0;

  // Sorting
  if (params.sort === 'rating') {
    query += ' ORDER BY rating_score DESC, review_count DESC';
  } else if (params.sort === 'cozy') {
    query += ' ORDER BY cozy_score DESC, rating_score DESC';
  } else if (params.sort === 'newest') {
    query += ' ORDER BY release_date DESC';
  } else if (params.sort === 'price') {
    query += ' ORDER BY price_current ASC';
  } else {
    query += ' ORDER BY rating_score DESC';
  }

  query += ' LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  const rows = await db.prepare(query).bind(...queryParams).all<any>();

  const games = rows.results.map((r: any) => {
    if (r.raw_json) {
      try {
        return JSON.parse(r.raw_json);
      } catch {}
    }
    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      developer: r.developer,
      publisher: r.publisher,
      shortDescription: r.short_description,
      fullDescription: r.full_description,
      headerImage: r.header_image,
      capsuleImage: r.capsule_image,
      coverImage: r.header_image || r.capsule_image,
      price: {
        original: r.price_original || 0,
        current: r.price_current || 0,
        discountPercent: r.discount_percent || 0,
        isFree: Boolean(r.is_free)
      },
      releaseDate: r.release_date,
      steamDeckStatus: r.steam_deck_status,
      steamDeckNotes: r.steam_deck_notes,
      cozyScore: r.cozy_score,
      ratingScore: r.rating_score,
      reviewCount: r.review_count,
      reviewSentiment: r.review_sentiment,
      categories: JSON.parse(r.categories_json || '[]'),
      tags: JSON.parse(r.tags_json || '[]'),
      vibes: JSON.parse(r.vibes_json || '[]')
    };
  });

  return {
    success: true,
    total,
    page,
    limit,
    games
  };
}

// ============================================================================
// News Queries
// ============================================================================

export async function queryNewsArticles(
  db: ID1Database,
  params: {
    category?: string;
    source?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ success: boolean; total: number; page: number; limit: number; articles: any[] }> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 50));
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM news_articles WHERE 1=1';
  const queryParams: any[] = [];

  if (params.category && params.category !== 'all') {
    query += ' AND (category = ? COLLATE NOCASE OR tags_json LIKE ?)';
    queryParams.push(params.category, `%"${params.category}"%`);
  }

  if (params.source && params.source !== 'all') {
    query += ' AND source = ? COLLATE NOCASE';
    queryParams.push(params.source);
  }

  if (params.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    query += ' AND (title LIKE ? OR summary LIKE ? OR related_game_title LIKE ? OR tags_json LIKE ?)';
    queryParams.push(q, q, q, q);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countRow = await db.prepare(countQuery).bind(...queryParams).first<{ count: number }>();
  const total = countRow?.count || 0;

  query += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  const rows = await db.prepare(query).bind(...queryParams).all<any>();

  const articles = rows.results.map((r: any) => {
    if (r.raw_json) {
      try {
        return JSON.parse(r.raw_json);
      } catch {}
    }
    return {
      id: r.id,
      title: r.title,
      summary: r.summary,
      content: r.content,
      category: r.category,
      source: r.source,
      sourceUrl: r.source_url,
      publishedAt: r.published_at,
      imageUrl: r.image_url,
      author: r.author,
      readTimeMinutes: r.read_time_minutes,
      tags: JSON.parse(r.tags_json || '[]'),
      relatedGameId: r.related_game_id,
      relatedGameTitle: r.related_game_title,
      geminiEnriched: Boolean(r.gemini_enriched),
      geminiSummary: r.gemini_summary,
      geminiBullets: JSON.parse(r.gemini_bullets_json || '[]'),
      geminiSentiment: r.gemini_sentiment,
      steamDeckImpact: r.steam_deck_impact
    };
  });

  return {
    success: true,
    total,
    page,
    limit,
    articles
  };
}

// ============================================================================
// Ingestion State Management
// ============================================================================

export async function getIngestionState(db: ID1Database): Promise<SystemIngestionState> {
  const rows = await db.prepare('SELECT * FROM ingestion_state').all<any>();
  const map: Record<string, IngestionJobState> = {};

  for (const r of rows.results) {
    map[r.key] = {
      status: r.status || 'idle',
      lastRunAt: r.last_run_at,
      lastSuccessAt: r.last_success_at,
      itemsProcessed: r.items_processed || 0,
      newItemsCount: r.new_items_count || 0,
      updatedItemsCount: r.updated_items_count || 0,
      skippedCount: r.skipped_count || 0,
      lastError: r.last_error,
      knownIds: JSON.parse(r.known_ids_json || '[]'),
      contentHashes: JSON.parse(r.content_hashes_json || '{}')
    };
  }

  return {
    version: '2.0.0',
    news: map.news || { status: 'idle', itemsProcessed: 0, newItemsCount: 0, updatedItemsCount: 0, skippedCount: 0 },
    catalog: map.catalog || { status: 'idle', itemsProcessed: 0, newItemsCount: 0, updatedItemsCount: 0, skippedCount: 0 },
    rankings: map.rankings || { status: 'idle', itemsProcessed: 0, newItemsCount: 0, updatedItemsCount: 0, skippedCount: 0 }
  };
}

export async function updateIngestionJobState(
  db: ID1Database,
  key: 'news' | 'catalog' | 'rankings',
  state: Partial<IngestionJobState>
): Promise<void> {
  const now = new Date().toISOString();
  const current = (await getIngestionState(db))[key];
  const merged = { ...current, ...state };

  await db
    .prepare(`
      INSERT INTO ingestion_state 
      (key, status, last_run_at, last_success_at, items_processed, new_items_count, updated_items_count, skipped_count, last_error, known_ids_json, content_hashes_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        status = excluded.status,
        last_run_at = excluded.last_run_at,
        last_success_at = excluded.last_success_at,
        items_processed = excluded.items_processed,
        new_items_count = excluded.new_items_count,
        updated_items_count = excluded.updated_items_count,
        skipped_count = excluded.skipped_count,
        last_error = excluded.last_error,
        known_ids_json = excluded.known_ids_json,
        content_hashes_json = excluded.content_hashes_json,
        updated_at = excluded.updated_at
    `)
    .bind(
      key,
      merged.status,
      merged.lastRunAt || null,
      merged.lastSuccessAt || null,
      merged.itemsProcessed,
      merged.newItemsCount,
      merged.updatedItemsCount,
      merged.skippedCount,
      merged.lastError || null,
      JSON.stringify(merged.knownIds || []),
      JSON.stringify(merged.contentHashes || {}),
      now
    )
    .run();
}
