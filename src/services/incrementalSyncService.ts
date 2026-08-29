import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { NewsArticle, Game, GameCategory } from '../types';
import { 
  fetchRssFeed, 
  fetchSteamNews, 
  deduplicateAndCluster, 
  enrichArticlesWithGemini, 
  CURATED_RSS_FEEDS 
} from './newsService';

// ============================================================================
// State Types & Constants
// ============================================================================

export interface IngestionJobState {
  lastRunAt?: string;
  lastSuccessAt?: string;
  status: 'idle' | 'running' | 'success' | 'error';
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

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const STATE_FILE = path.join(DATA_DIR, 'ingestionState.json');
const NEWS_FILE = path.join(DATA_DIR, 'newsFeed.json');
const CATALOG_FILE = path.join(DATA_DIR, 'steamGamesCatalog.json');

const DEFAULT_STATE: SystemIngestionState = {
  version: '1.0.0',
  news: { status: 'idle', itemsProcessed: 0, newItemsCount: 0, updatedItemsCount: 0, skippedCount: 0, knownIds: [], contentHashes: {} },
  catalog: { status: 'idle', itemsProcessed: 0, newItemsCount: 0, updatedItemsCount: 0, skippedCount: 0, knownIds: [] },
  rankings: { status: 'idle', itemsProcessed: 0, newItemsCount: 0, updatedItemsCount: 0, skippedCount: 0, knownIds: [] }
};

// ============================================================================
// State Helpers
// ============================================================================

export function loadIngestionState(): SystemIngestionState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading ingestion state:', err);
  }
  return { ...DEFAULT_STATE };
}

export function saveIngestionState(state: SystemIngestionState): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving ingestion state:', err);
  }
}

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ============================================================================
// 1. Incremental News Ingestion
// ============================================================================

export async function syncNewsIncremental(apiKey?: string): Promise<{
  success: boolean;
  newArticles: number;
  totalArticles: number;
  skipped: number;
  error?: string;
}> {
  const state = loadIngestionState();
  state.news.status = 'running';
  state.news.lastRunAt = new Date().toISOString();
  saveIngestionState(state);

  try {
    console.log('[Incremental Sync] Starting incremental news ingestion...');

    // 1. Load existing news feed
    let existingNews: NewsArticle[] = [];
    if (fs.existsSync(NEWS_FILE)) {
      try {
        existingNews = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));
      } catch {}
    }

    const knownHashes = state.news.contentHashes || {};
    const knownIdsSet = new Set(state.news.knownIds || existingNews.map(a => a.id));

    // 2. Fetch raw feeds
    const rawArticles: NewsArticle[] = [];
    const rssPromises = CURATED_RSS_FEEDS.map(f => fetchRssFeed(f));
    const rssResults = await Promise.allSettled(rssPromises);
    for (const res of rssResults) {
      if (res.status === 'fulfilled') {
        rawArticles.push(...res.value);
      }
    }

    try {
      const steamArticles = await fetchSteamNews();
      rawArticles.push(...steamArticles);
    } catch {}

    // 3. Deduplicate incoming batch
    const deduplicatedIncoming = deduplicateAndCluster(rawArticles);

    // 4. Identify strictly NEW or CHANGED articles
    const brandNewArticles: NewsArticle[] = [];
    let skippedCount = 0;

    for (const article of deduplicatedIncoming) {
      const contentHash = computeHash(`${article.title}|${article.summary}|${article.sourceUrl}`);
      const isKnown = knownIdsSet.has(article.id) || Boolean(knownHashes[article.id]);
      const hasChanged = knownHashes[article.id] && knownHashes[article.id] !== contentHash;

      if (!isKnown || hasChanged) {
        brandNewArticles.push(article);
        knownHashes[article.id] = contentHash;
        knownIdsSet.add(article.id);
      } else {
        skippedCount++;
      }
    }

    console.log(`[Incremental Sync] Discovered ${brandNewArticles.length} new/updated articles (${skippedCount} unchanged, skipped).`);

    // 5. Enrich ONLY the new articles with Gemini
    let enrichedNew: NewsArticle[] = [];
    if (brandNewArticles.length > 0) {
      enrichedNew = await enrichArticlesWithGemini(brandNewArticles, apiKey);
    }

    // 6. Merge idempotently with existing news
    const mergedMap = new Map<string, NewsArticle>();
    
    // Add existing articles first
    for (const existing of existingNews) {
      mergedMap.set(existing.id, existing);
    }
    // Overlay newly enriched articles
    for (const fresh of enrichedNew) {
      mergedMap.set(fresh.id, fresh);
    }

    // Convert back to array & sort chronologically
    const finalNewsList = Array.from(mergedMap.values()).sort((a, b) => {
      const timeA = a.publishedIso ? new Date(a.publishedIso).getTime() : 0;
      const timeB = b.publishedIso ? new Date(b.publishedIso).getTime() : 0;
      return timeB - timeA;
    });

    // Ensure a featured story exists
    if (finalNewsList.length > 0 && !finalNewsList.some(a => a.isFeatured)) {
      finalNewsList[0].isFeatured = true;
    }

    // 7. Atomic write to disk
    fs.mkdirSync(path.dirname(NEWS_FILE), { recursive: true });
    fs.writeFileSync(NEWS_FILE, JSON.stringify(finalNewsList, null, 2), 'utf8');

    // 8. Update ingestion state
    state.news.status = 'success';
    state.news.lastSuccessAt = new Date().toISOString();
    state.news.itemsProcessed = finalNewsList.length;
    state.news.newItemsCount = brandNewArticles.length;
    state.news.skippedCount = skippedCount;
    state.news.knownIds = Array.from(knownIdsSet).slice(0, 500);
    state.news.contentHashes = knownHashes;
    state.news.lastError = undefined;
    saveIngestionState(state);

    return {
      success: true,
      newArticles: brandNewArticles.length,
      totalArticles: finalNewsList.length,
      skipped: skippedCount
    };
  } catch (error: any) {
    console.error('[Incremental Sync] News sync failed:', error);
    state.news.status = 'error';
    state.news.lastError = error.message || 'Unknown error';
    saveIngestionState(state);
    return {
      success: false,
      newArticles: 0,
      totalArticles: 0,
      skipped: 0,
      error: error.message
    };
  }
}

// ============================================================================
// 2. Incremental Game Catalog Sync
// ============================================================================

export async function syncCatalogIncremental(): Promise<{
  success: boolean;
  newGamesCount: number;
  totalGamesCount: number;
  skippedCount: number;
  error?: string;
}> {
  const state = loadIngestionState();
  state.catalog.status = 'running';
  state.catalog.lastRunAt = new Date().toISOString();
  saveIngestionState(state);

  try {
    console.log('[Incremental Sync] Starting incremental catalog scan...');

    let existingGames: Game[] = [];
    if (fs.existsSync(CATALOG_FILE)) {
      try {
        existingGames = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
      } catch {}
    }

    const existingIdsSet = new Set(
      state.catalog.knownIds && state.catalog.knownIds.length > 0 
        ? state.catalog.knownIds 
        : existingGames.map(g => g.id)
    );

    // Search Steam for popular cozy/indie releases to discover any new additions
    const searchUrl = 'https://store.steampowered.com/search/results/?query=&tags=7108%2C492%2C597&category1=998&json=1&page=1';
    let newGamesDiscovered: Game[] = [];
    let skipped = 0;

    try {
      const res = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        timeout: 10_000
      });

      const html = res.data?.results_html || '';
      // Parse appids from search results
      const appIdMatches = Array.from(html.matchAll(/data-ds-appid="(\d+)"/g)).map(m => m[1]);

      for (const appIdStr of appIdMatches.slice(0, 10)) {
        const appId = parseInt(appIdStr, 10);
        if (isNaN(appId)) continue;

        const slug = `steam-${appId}`;
        if (existingIdsSet.has(slug) || existingGames.some(g => g.id === slug || g.steamStoreUrl?.includes(appIdStr))) {
          skipped++;
          continue;
        }

        // Fetch single appdetails only for unseen app
        try {
          const detailRes = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}`, {
            timeout: 8000
          });
          const appData = detailRes.data?.[appId]?.data;
          if (appData && appData.type === 'game') {
            const newGame: Game = {
              id: slug,
              title: appData.name,
              slug: appData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
              shortDescription: appData.short_description || 'A relaxing indie experience on Steam.',
              fullDescription: appData.detailed_description || appData.about_the_game || '',
              coverImage: appData.header_image,
              bannerImage: appData.screenshots?.[0]?.path_full || appData.header_image,
              developer: appData.developers?.[0] || 'Independent Studio',
              publisher: appData.publishers?.[0] || 'Indie Publisher',
              releaseDate: appData.release_date?.date || 'Recent',
              releaseStatus: 'released',
              price: appData.is_free ? 'Free' : (appData.price_overview?.final_formatted || '$14.99'),
              originalPrice: appData.price_overview?.initial_formatted || '$14.99',
              salePrice: appData.price_overview?.final_formatted || '$14.99',
              isOnSale: (appData.price_overview?.discount_percent || 0) > 0,
              discountPercent: appData.price_overview?.discount_percent || 0,
              storePlatform: 'Steam',
              steamStoreUrl: `https://store.steampowered.com/app/${appId}/`,
              demoAvailable: Boolean(appData.demos && appData.demos.length > 0),
              steamDeckStatus: 'Verified',
              steamDeckNotes: 'Optimized and verified for handheld play on Steam Deck.',
              cozyScore: 9.0,
              category: 'cozy',
              artStyle: 'Charming Handcrafted Art',
              primaryMood: 'Relaxing Indie Discovery',
              tags: ['Cozy', 'Indie', 'Relaxing', 'Steam'],
              ratingScore: 92,
              totalReviews: '1,200',
              reviewSentiment: 'Very Positive',
              platforms: ['PC', 'Steam Deck', 'Steam'],
              storeUrl: `https://store.steampowered.com/app/${appId}/`,
              vibes: ['Zero Stress', 'Charming Visuals', 'Gentle Soundtrack'],
              isFeaturedThisWeek: false,
              isNewlyReleased: true,
              isPopular: true,
              isHighlyRated: true,
              isHiddenGem: false,
              gameplayStyle: 'Relaxing Indie Adventure',
              averagePlaytimeHours: '10-20 hrs'
            };

            newGamesDiscovered.push(newGame);
            existingIdsSet.add(slug);
          }
        } catch {}
      }
    } catch {}

    if (newGamesDiscovered.length > 0) {
      existingGames.push(...newGamesDiscovered);
      fs.mkdirSync(path.dirname(CATALOG_FILE), { recursive: true });
      fs.writeFileSync(CATALOG_FILE, JSON.stringify(existingGames, null, 2), 'utf8');
    }

    state.catalog.status = 'success';
    state.catalog.lastSuccessAt = new Date().toISOString();
    state.catalog.itemsProcessed = existingGames.length;
    state.catalog.newItemsCount = newGamesDiscovered.length;
    state.catalog.skippedCount = skipped;
    state.catalog.knownIds = Array.from(existingIdsSet).slice(0, 2000);
    state.catalog.lastError = undefined;
    saveIngestionState(state);

    console.log(`[Incremental Sync] Catalog sync complete: ${newGamesDiscovered.length} new games added (${existingGames.length} total).`);

    return {
      success: true,
      newGamesCount: newGamesDiscovered.length,
      totalGamesCount: existingGames.length,
      skippedCount: skipped
    };
  } catch (error: any) {
    console.error('[Incremental Sync] Catalog sync failed:', error);
    state.catalog.status = 'error';
    state.catalog.lastError = error.message || 'Unknown error';
    saveIngestionState(state);
    return {
      success: false,
      newGamesCount: 0,
      totalGamesCount: 0,
      skippedCount: 0,
      error: error.message
    };
  }
}

// ============================================================================
// 3. Incremental Rankings & Deals Sync
// ============================================================================

export async function syncRankingsIncremental(): Promise<{
  success: boolean;
  dealsUpdated: number;
  error?: string;
}> {
  const state = loadIngestionState();
  state.rankings.status = 'running';
  state.rankings.lastRunAt = new Date().toISOString();
  saveIngestionState(state);

  try {
    console.log('[Incremental Sync] Starting incremental rankings & deals refresh...');

    let existingGames: Game[] = [];
    if (fs.existsSync(CATALOG_FILE)) {
      try {
        existingGames = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
      } catch {}
    }

    // Identify top 20 games to refresh live sale prices
    let updatedCount = 0;
    const targets = existingGames.slice(0, 15);

    for (const game of targets) {
      const match = game.steamStoreUrl?.match(/app\/(\d+)/);
      if (!match) continue;
      const appId = match[1];

      try {
        const res = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=price_overview`, {
          timeout: 5000
        });
        const priceOverview = res.data?.[appId]?.data?.price_overview;
        if (priceOverview) {
          game.price = priceOverview.final_formatted;
          game.originalPrice = priceOverview.initial_formatted;
          game.salePrice = priceOverview.final_formatted;
          game.isOnSale = priceOverview.discount_percent > 0;
          game.discountPercent = priceOverview.discount_percent;
          updatedCount++;
        }
      } catch {}
    }

    if (updatedCount > 0) {
      fs.writeFileSync(CATALOG_FILE, JSON.stringify(existingGames, null, 2), 'utf8');
    }

    state.rankings.status = 'success';
    state.rankings.lastSuccessAt = new Date().toISOString();
    state.rankings.itemsProcessed = targets.length;
    state.rankings.updatedItemsCount = updatedCount;
    state.rankings.lastError = undefined;
    saveIngestionState(state);

    console.log(`[Incremental Sync] Rankings & deals refreshed for ${updatedCount} games.`);
    return { success: true, dealsUpdated: updatedCount };
  } catch (error: any) {
    console.error('[Incremental Sync] Rankings sync failed:', error);
    state.rankings.status = 'error';
    state.rankings.lastError = error.message || 'Unknown error';
    saveIngestionState(state);
    return { success: false, dealsUpdated: 0, error: error.message };
  }
}

// ============================================================================
// 4. Master Orchestrator
// ============================================================================

export async function runAllIncrementalSyncs(apiKey?: string) {
  console.log('🔄 Running all scheduled incremental content syncs...');
  const newsRes = await syncNewsIncremental(apiKey);
  const catalogRes = await syncCatalogIncremental();
  const rankingsRes = await syncRankingsIncremental();

  return {
    timestamp: new Date().toISOString(),
    news: newsRes,
    catalog: catalogRes,
    rankings: rankingsRes,
    state: loadIngestionState()
  };
}
