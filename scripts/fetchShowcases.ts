/**
 * scripts/fetchShowcases.ts
 *
 * Scrapes full catalogs for curated publishers and showcases on Steam:
 *   1. Wholesome Direct (Curator & Showcase)
 *   2. Fellow Traveller
 *   3. Annapurna Interactive
 *   4. Raw Fury
 *   5. Devolver Digital
 *   6. Team17
 *   7. Chucklefish
 *   8. Hooded Horse
 *
 * Smart Skip Logic:
 *   - Checks existing games in `src/data/steamGamesCatalog.json`.
 *   - Completely skips re-enriching games already present on the site.
 *   - Links `publisherCatalog` for existing and new games.
 *   - Only fetches app details and reviews from Steam for newly discovered titles.
 *   - Respects local cache (`scripts/.cache/`) and handles 429 rate limits gracefully.
 *
 * Usage:
 *   npx tsx scripts/fetchShowcases.ts
 *   npx tsx scripts/fetchShowcases.ts --delay=1000
 *   npx tsx scripts/fetchShowcases.ts --showcase=annapurna
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Game, GameCategory, SteamDeckStatus } from '../src/types';

// ---------------------------------------------------------------------------
// Configuration & Constants
// ---------------------------------------------------------------------------

const CATALOG_FILE = path.resolve(process.cwd(), 'src', 'data', 'steamGamesCatalog.json');
const SHOWCASES_DATA_FILE = path.resolve(process.cwd(), 'src', 'data', 'catalogsData.ts');
const CACHE_DIR = path.resolve(process.cwd(), 'scripts', '.cache');
const APPDETAILS_CACHE_FILE = path.join(CACHE_DIR, 'appdetails_cache.json');
const APPREVIEWS_CACHE_FILE = path.join(CACHE_DIR, 'appreviews_cache.json');

const STEAM_APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails';
const STEAM_APPREVIEWS_URL = 'https://store.steampowered.com/appreviews';
const STEAM_SEARCH_URL = 'https://store.steampowered.com/search/results/';

const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_BASE_MS = 3500;
const MAX_RETRIES = 4;
const RESULTS_PER_QUERY = 50;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

const ALLOWED_APP_TYPES = new Set(['game']);

// ---------------------------------------------------------------------------
// Showcase Targets Configuration
// ---------------------------------------------------------------------------

interface ShowcaseTarget {
  id: string;
  name: string;
  publishers: string[];
  curatorId?: string;
  searchTerms?: string[];
  maxPages?: number;
  defaultCategory: GameCategory;
  vibes: string[];
}

const SHOWCASE_TARGETS: ShowcaseTarget[] = [
  {
    id: 'wholesome-direct',
    name: 'Wholesome Direct',
    publishers: ['Wholesome Games', 'Wholesome Direct'],
    curatorId: '35411526', // Wholesome Games Steam Curator
    searchTerms: ['wholesome', 'wholesome games'],
    maxPages: 6,
    defaultCategory: 'cozy',
    vibes: ['Wholesome', 'Cozy Life', 'Gentle Play', 'Heartwarming']
  },
  {
    id: 'fellow-traveller',
    name: 'Fellow Traveller',
    publishers: ['Fellow Traveller'],
    maxPages: 5,
    defaultCategory: 'rpg',
    vibes: ['Narrative Masterpiece', 'Story Rich', 'Atmospheric Sci-Fi', 'Choices Matter']
  },
  {
    id: 'annapurna-interactive',
    name: 'Annapurna Interactive',
    publishers: ['Annapurna Interactive'],
    maxPages: 5,
    defaultCategory: 'indie',
    vibes: ['Artistic Masterpiece', 'Emotional Resonance', 'Stylized Adventure', 'Indie Prestige']
  },
  {
    id: 'raw-fury',
    name: 'Raw Fury',
    publishers: ['Raw Fury'],
    maxPages: 6,
    defaultCategory: 'indie',
    vibes: ['Pixel Art Beauty', 'Unconventional Indie', 'Atmospheric Exploration', 'Cozy RPG']
  },
  {
    id: 'devolver-digital',
    name: 'Devolver Digital',
    publishers: ['Devolver Digital'],
    maxPages: 8,
    defaultCategory: 'roguelike',
    vibes: ['Stylized Indie', 'Cult Hit', 'Clever Mechanics', 'Darkly Whimsical']
  },
  {
    id: 'team17',
    name: 'Team17',
    publishers: ['Team17', 'Team17 Digital', 'Team17 Digital Ltd'],
    maxPages: 8,
    defaultCategory: 'simulation',
    vibes: ['Charming Simulation', 'Co-op Delight', 'Indie Adventure', 'Atmospheric Mystery']
  },
  {
    id: 'chucklefish',
    name: 'Chucklefish',
    publishers: ['Chucklefish'],
    maxPages: 5,
    defaultCategory: 'cozy',
    vibes: ['Pixel Art Charm', 'Magical World', 'Cozy Crafting', 'Charming RPG']
  },
  {
    id: 'hooded-horse',
    name: 'Hooded Horse',
    publishers: ['Hooded Horse'],
    maxPages: 6,
    defaultCategory: 'simulation',
    vibes: ['Deep Simulation', 'Medieval Colony', 'Strategic Depth', 'Tactical Builder']
  }
];

// ---------------------------------------------------------------------------
// Helpers & Utilities
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractAppIdFromUrl(url?: string): number | null {
  if (!url) return null;
  const match = url.match(/\/app\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function cleanHtml(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeReleaseDate(dateStr?: string, comingSoon?: boolean): string {
  if (comingSoon) {
    if (!dateStr || dateStr.toLowerCase().includes('coming soon')) return 'Coming Soon';
    return dateStr.trim();
  }
  if (!dateStr) return 'Released';
  return dateStr.trim();
}

// ---------------------------------------------------------------------------
// Network Helpers (With 429 Adaptive Exponential Backoff)
// ---------------------------------------------------------------------------

async function fetchTextWithRetry(url: string, attempt = 1): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/json,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 429) {
      if (attempt <= MAX_RETRIES) {
        const jitter = Math.floor(Math.random() * 1000);
        const backoffMs = RETRY_BASE_MS * Math.pow(2, attempt - 1) + jitter;
        console.warn(`    ⚠️ Rate limit (HTTP 429). Backing off for ${Math.round(backoffMs / 1000)}s (Attempt ${attempt}/${MAX_RETRIES})...`);
        await delay(backoffMs);
        return fetchTextWithRetry(url, attempt + 1);
      }
      console.error(`    ❌ Exhausted retries for ${url}`);
      return null;
    }

    if (!response.ok) return null;
    return await response.text();
  } catch (error: any) {
    if (attempt <= 2) {
      await delay(1500);
      return fetchTextWithRetry(url, attempt + 1);
    }
    return null;
  }
}

async function fetchJsonWithRetry<T>(url: string): Promise<T | null> {
  const text = await fetchTextWithRetry(url);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cache Management
// ---------------------------------------------------------------------------

class ScraperCache {
  private appDetails = new Map<number, any>();
  private appReviews = new Map<number, any>();

  async init(): Promise<void> {
    await mkdir(CACHE_DIR, { recursive: true });
    try {
      if (existsSync(APPDETAILS_CACHE_FILE)) {
        const raw = await readFile(APPDETAILS_CACHE_FILE, 'utf8');
        const obj = JSON.parse(raw);
        for (const [k, v] of Object.entries(obj)) {
          this.appDetails.set(Number(k), v);
        }
      }
      if (existsSync(APPREVIEWS_CACHE_FILE)) {
        const raw = await readFile(APPREVIEWS_CACHE_FILE, 'utf8');
        const obj = JSON.parse(raw);
        for (const [k, v] of Object.entries(obj)) {
          this.appReviews.set(Number(k), v);
        }
      }
      console.log(`📦 Loaded ${this.appDetails.size} cached details and ${this.appReviews.size} cached reviews from disk.`);
    } catch {
      console.warn('⚠️ Disk cache read error, proceeding with empty in-memory cache.');
    }
  }

  getDetails(appId: number): any | undefined {
    return this.appDetails.get(appId);
  }

  setDetails(appId: number, data: any): void {
    this.appDetails.set(appId, data);
  }

  getReviews(appId: number): any | undefined {
    return this.appReviews.get(appId);
  }

  setReviews(appId: number, data: any): void {
    this.appReviews.set(appId, data);
  }

  async flush(): Promise<void> {
    try {
      const detailsObj = Object.fromEntries(this.appDetails.entries());
      const reviewsObj = Object.fromEntries(this.appReviews.entries());
      await writeFile(APPDETAILS_CACHE_FILE, JSON.stringify(detailsObj), 'utf8');
      await writeFile(APPREVIEWS_CACHE_FILE, JSON.stringify(reviewsObj), 'utf8');
    } catch {
      // Non-fatal
    }
  }
}

const cache = new ScraperCache();

// ---------------------------------------------------------------------------
// Steam API Fetchers
// ---------------------------------------------------------------------------

async function fetchAppDetails(appId: number, requestDelayMs: number): Promise<any | null> {
  const cached = cache.getDetails(appId);
  if (cached !== undefined) return cached;

  await delay(requestDelayMs);
  const url = `${STEAM_APPDETAILS_URL}?appids=${appId}&l=english&cc=us`;
  const payload = await fetchJsonWithRetry<Record<string, any>>(url);
  const entry = payload?.[String(appId)];

  let result: any = null;
  if (entry?.success && entry.data) {
    if (!entry.data.type || ALLOWED_APP_TYPES.has(entry.data.type)) {
      result = entry.data;
    }
  }

  cache.setDetails(appId, result);
  return result;
}

async function fetchAppReviews(appId: number, requestDelayMs: number): Promise<any | null> {
  const cached = cache.getReviews(appId);
  if (cached !== undefined) return cached;

  await delay(requestDelayMs);
  const url = `${STEAM_APPREVIEWS_URL}/${appId}?json=1&purchase_type=all&num_per_page=0&l=english`;
  const payload = await fetchJsonWithRetry<any>(url);
  cache.setReviews(appId, payload);
  return payload;
}

async function searchPublisherAppIds(publisher: string, maxPages = 5): Promise<number[]> {
  const appIds = new Set<number>();

  for (let page = 0; page < maxPages; page++) {
    const start = page * RESULTS_PER_QUERY;
    const searchParams = new URLSearchParams({
      publisher,
      start: String(start),
      count: String(RESULTS_PER_QUERY),
      category1: '998', // Games only
      infinite: '1',
      supportedlang: 'english',
    });

    const url = `${STEAM_SEARCH_URL}?${searchParams.toString()}`;
    const payload = await fetchJsonWithRetry<{ results_html?: string }>(url);
    const html = payload?.results_html;
    if (!html) break;

    const matches = [...html.matchAll(/store\.steampowered\.com\/app\/(\d+)\//g)].map((m) => Number(m[1]));
    if (matches.length === 0) break;

    for (const id of matches) {
      appIds.add(id);
    }

    if (matches.length < RESULTS_PER_QUERY) break;
    await delay(600);
  }

  return [...appIds];
}

async function searchCuratorAppIds(curatorId: string, maxPages = 4): Promise<number[]> {
  const appIds = new Set<number>();

  for (let page = 0; page < maxPages; page++) {
    const start = page * 50;
    const url = `https://store.steampowered.com/curator/${curatorId}/ajaxgetfilteredrecommendations/render/?query=&start=${start}&count=50&tagids=&sort=recent&app_types=&curations=`;
    const payload = await fetchJsonWithRetry<{ results_html?: string }>(url);
    const html = payload?.results_html;
    if (!html) break;

    const matches = [...html.matchAll(/data-ds-appid="(\d+)"/g)].map((m) => Number(m[1]));
    if (matches.length === 0) break;

    for (const id of matches) {
      appIds.add(id);
    }

    if (matches.length < 50) break;
    await delay(600);
  }

  return [...appIds];
}

// ---------------------------------------------------------------------------
// Game Mapping & Cozy Score Calculation
// ---------------------------------------------------------------------------

function mapDataToGame(
  appId: number,
  data: any,
  reviews: any | null,
  showcase: ShowcaseTarget,
  seenSlugs: Set<string>
): Game {
  const title = data.name?.trim() || `Steam Game ${appId}`;
  let slug = slugify(title) || `steam-${appId}`;
  if (seenSlugs.has(slug)) slug = `${slug}-${appId}`;
  seenSlugs.add(slug);

  const developer = data.developers?.[0]?.trim() || 'Unknown Developer';
  const publisher = data.publishers?.[0]?.trim() || showcase.name;

  const isFree = Boolean(data.is_free) || !data.price_overview;
  const priceOverview = data.price_overview;
  const price = isFree ? 'Free' : priceOverview?.final_formatted?.trim() || 'Free';
  const discountPercent = priceOverview?.discount_percent ?? 0;
  const isOnSale = discountPercent > 0;

  const releaseDate = normalizeReleaseDate(data.release_date?.date, data.release_date?.coming_soon);
  const releaseStatus: Game['releaseStatus'] = data.release_date?.coming_soon ? 'upcoming' : 'released';

  const shortDescription = cleanHtml(data.short_description) || cleanHtml(data.about_the_game).slice(0, 240) + '...';
  const fullDescription = cleanHtml(data.about_the_game) || shortDescription;

  const coverImage = data.header_image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
  const bannerImage = data.screenshots?.[0]?.path_full || coverImage;

  // Deck compatibility parsing
  let steamDeckStatus: SteamDeckStatus = 'Playable';
  const deckCategory = data.platforms?.steam_deck_compatibility?.category;
  if (deckCategory === 3) steamDeckStatus = 'Verified';
  else if (deckCategory === 2) steamDeckStatus = 'Playable';
  else if (deckCategory === 1) steamDeckStatus = 'Unsupported';
  else if (deckCategory === 0) steamDeckStatus = 'Unknown';

  const steamDeckNotes = steamDeckStatus === 'Verified'
    ? 'Verified - Seamless controller support and performant graphics on Steam Deck.'
    : steamDeckStatus === 'Playable'
    ? 'Playable - May require minor controller adjustments or keyboard overlay.'
    : 'Standard PC configuration.';

  // Review Summary
  const querySummary = reviews?.query_summary;
  const totalReviewsNum = (querySummary?.total_positive ?? 0) + (querySummary?.total_negative ?? 0);
  const ratingScore = totalReviewsNum > 0
    ? Math.round(((querySummary?.total_positive ?? 0) / totalReviewsNum) * 100)
    : 85;

  let totalReviews = totalReviewsNum.toLocaleString();
  if (totalReviewsNum === 0) totalReviews = 'New Release';

  let reviewSentiment = querySummary?.review_score_desc || 'Positive';
  if (ratingScore >= 95) reviewSentiment = 'Overwhelmingly Positive';
  else if (ratingScore >= 80) reviewSentiment = 'Very Positive';
  else if (ratingScore >= 70) reviewSentiment = 'Mostly Positive';

  // Platforms
  const platforms: Game['platforms'] = ['PC', 'Steam'];
  if (data.platforms?.mac) platforms.push('Mac');
  if (data.platforms?.linux) platforms.push('Linux');
  if (steamDeckStatus === 'Verified' || steamDeckStatus === 'Playable') platforms.push('Steam Deck');

  // Category & Vibes
  const category: GameCategory = showcase.defaultCategory;
  const vibes: string[] = [...showcase.vibes];

  const tags: string[] = (data.genres ?? []).map((g: any) => g.description).filter(Boolean);
  if (!tags.includes('Indie')) tags.unshift('Indie');
  if (tags.length === 1) tags.push(category.toUpperCase());

  // Cozy Score (0 to 10)
  let cozyScore = 8.0;
  if (showcase.id === 'wholesome-direct') cozyScore = 9.4;
  else if (showcase.id === 'chucklefish') cozyScore = 9.0;
  else if (showcase.id === 'annapurna-interactive') cozyScore = 8.8;
  else if (showcase.id === 'raw-fury') cozyScore = 8.5;
  else if (showcase.id === 'fellow-traveller') cozyScore = 8.2;
  else if (showcase.id === 'hooded-horse') cozyScore = 7.8;
  else if (showcase.id === 'devolver-digital') cozyScore = 7.5;
  else if (showcase.id === 'team17') cozyScore = 8.1;

  const isPopular = totalReviewsNum > 1000 || ratingScore > 90;
  const isHighlyRated = ratingScore >= 92;
  const isHiddenGem = totalReviewsNum > 30 && totalReviewsNum < 800 && ratingScore >= 90;

  return {
    id: slug,
    title,
    slug,
    shortDescription,
    fullDescription,
    coverImage,
    bannerImage,
    developer,
    publisher,
    publisherCatalog: showcase.name,
    releaseDate,
    releaseStatus,
    price,
    isOnSale,
    discountPercent: isOnSale ? discountPercent : undefined,
    storePlatform: 'Steam',
    steamStoreUrl: `https://store.steampowered.com/app/${appId}/`,
    demoAvailable: Boolean(data.demos && data.demos.length > 0),
    steamDeckStatus,
    steamDeckNotes,
    cozyScore,
    category,
    tags: tags.slice(0, 5),
    primaryMood: 'Handcrafted Art & Distinct Storytelling',
    ratingScore,
    totalReviews,
    reviewSentiment,
    platforms,
    storeUrl: `https://store.steampowered.com/app/${appId}/`,
    vibes: vibes.slice(0, 3),
    isFeaturedThisWeek: false,
    isNewlyReleased: releaseStatus === 'upcoming' || releaseDate.includes('2025') || releaseDate.includes('2026'),
    isPopular,
    isHighlyRated,
    isHiddenGem,
    gameplayStyle: `${showcase.name} Showcase Selection`
  };
}

// ---------------------------------------------------------------------------
// Main Scraper Engine
// ---------------------------------------------------------------------------

async function runShowcasesScraper(): Promise<void> {
  console.log('================================================================');
  console.log('🎮 CozyDispatch Showcase & Publisher Catalog Scraper');
  console.log('================================================================\n');

  await cache.init();

  // 1. Read existing catalog
  let existingGames: Game[] = [];
  if (existsSync(CATALOG_FILE)) {
    try {
      const raw = await readFile(CATALOG_FILE, 'utf8');
      existingGames = JSON.parse(raw);
      console.log(`📂 Loaded existing catalog: ${existingGames.length} games on site.`);
    } catch {
      console.error('❌ Failed to read existing catalog file.');
      process.exit(1);
    }
  }

  // Build lookups for existing site games
  const existingAppIdMap = new Map<number, Game>();
  const existingSlugMap = new Map<string, Game>();
  const existingTitleMap = new Map<string, Game>();
  const seenSlugs = new Set<string>();

  for (const game of existingGames) {
    seenSlugs.add(game.slug || game.id);
    const appId = extractAppIdFromUrl(game.steamStoreUrl || game.storeUrl);
    if (appId) existingAppIdMap.set(appId, game);
    if (game.slug) existingSlugMap.set(game.slug, game);
    if (game.id) existingSlugMap.set(game.id, game);
    if (game.title) existingTitleMap.set(game.title.toLowerCase().trim(), game);
  }

  const newGamesToAdd: Game[] = [];
  const showcaseCounts: Record<string, { totalDiscovered: number; alreadyOnSite: number; newlyAdded: number }> = {};

  // 2. Iterate through each Showcase Target
  for (const showcase of SHOWCASE_TARGETS) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`🔍 Scraping Showcase: [${showcase.name}] (${showcase.id})`);
    console.log(`----------------------------------------------------------------`);

    const discoveredAppIds = new Set<number>();

    // Discover via Publisher search
    for (const pub of showcase.publishers) {
      console.log(`  Searching publisher: "${pub}"...`);
      const ids = await searchPublisherAppIds(pub, showcase.maxPages);
      for (const id of ids) discoveredAppIds.add(id);
      console.log(`    Found ${ids.length} titles for publisher "${pub}".`);
    }

    // Discover via Curator if available (e.g. Wholesome Direct)
    if (showcase.curatorId) {
      console.log(`  Searching curator recommendations (ID: ${showcase.curatorId})...`);
      const curatorIds = await searchCuratorAppIds(showcase.curatorId, showcase.maxPages);
      for (const id of curatorIds) discoveredAppIds.add(id);
      console.log(`    Found ${curatorIds.length} titles from curator.`);
    }

    console.log(`  📊 Total unique titles discovered for ${showcase.name}: ${discoveredAppIds.size}`);

    let alreadyOnSiteCount = 0;
    let newlyEnrichedCount = 0;

    for (const appId of discoveredAppIds) {
      // Check if already in site catalog
      const existingGame = existingAppIdMap.get(appId);
      if (existingGame) {
        // Tag with showcase if not tagged
        if (!existingGame.publisherCatalog) {
          existingGame.publisherCatalog = showcase.name;
        }
        alreadyOnSiteCount++;
        continue;
      }

      // Not in site catalog! Enrich and add.
      const appDetails = await fetchAppDetails(appId, 800);
      if (!appDetails) {
        continue;
      }

      // Check if game name matches any existing title to prevent duplicates
      const titleLower = (appDetails.name || '').toLowerCase().trim();
      if (existingTitleMap.has(titleLower)) {
        const matchingGame = existingTitleMap.get(titleLower)!;
        matchingGame.publisherCatalog = showcase.name;
        alreadyOnSiteCount++;
        continue;
      }

      const reviews = await fetchAppReviews(appId, 600);
      const newGame = mapDataToGame(appId, appDetails, reviews, showcase, seenSlugs);

      existingGames.push(newGame);
      newGamesToAdd.push(newGame);
      existingAppIdMap.set(appId, newGame);
      existingTitleMap.set(titleLower, newGame);
      newlyEnrichedCount++;

      console.log(`    ✨ Added new title: "${newGame.title}" (${newGame.price}, ${newGame.releaseDate})`);
    }

    showcaseCounts[showcase.id] = {
      totalDiscovered: discoveredAppIds.size,
      alreadyOnSite: alreadyOnSiteCount,
      newlyAdded: newlyEnrichedCount,
    };

    console.log(`  ✅ Finished ${showcase.name}: ${alreadyOnSiteCount} already on site (skipped), ${newlyEnrichedCount} newly added.`);
    await cache.flush();
  }

  // 3. Save merged catalog
  console.log(`\n================================================================`);
  console.log(`💾 Saving Merged Catalog to ${CATALOG_FILE}...`);
  await writeFile(CATALOG_FILE, JSON.stringify(existingGames, null, 2), 'utf8');
  await cache.flush();

  console.log(`🎉 SUCCESS! Catalog updated.`);
  console.log(`   Previous games: ${existingGames.length - newGamesToAdd.length}`);
  console.log(`   New games added: ${newGamesToAdd.length}`);
  console.log(`   Total games on site: ${existingGames.length}`);

  console.log('\n📊 Showcase Summary Breakdown:');
  for (const [id, stats] of Object.entries(showcaseCounts)) {
    const target = SHOWCASE_TARGETS.find((t) => t.id === id);
    console.log(`  • ${target?.name.padEnd(24)}: ${stats.totalDiscovered} total found | ${stats.alreadyOnSite} on site (skipped) | +${stats.newlyAdded} new added`);
  }
}

runShowcasesScraper().catch((err) => {
  console.error('❌ Fatal error in showcase scraper:', err);
  process.exit(1);
});
