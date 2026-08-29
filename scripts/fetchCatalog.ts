/**
 * scripts/fetchCatalog.ts
 *
 * Builds `src/data/steamGamesCatalog.json` — a dynamic catalog of every
 * relevant cozy / indie / simulation title on Steam, discovered by branching
 * out from an initial list of seed App IDs:
 *
 *   1. SEED phase    – fetch each seed's Steam store page, parse the numeric
 *                      tag ids it carries (Cozy, Relaxing, Farming Sim, ...).
 *   2. DISCOVER phase– run Steam's unauthenticated `search/results` JSON
 *                      endpoint for every discovered tag id (plus high-signal
 *                      tag pairs) to collect candidate App IDs, ranked by how
 *                      many relevant tags they share with the seeds.
 *   3. ENRICH phase  – fetch full `appdetails` (rate-limited) for each
 *                      candidate, plus `appreviews` for real rating data.
 *   4. MAP + SAVE    – map to the website's `Game` interface and write JSON.
 *
 * No API key required. All endpoints are public. Enforces a 1,500ms delay
 * between consecutive appdetails/appreviews requests, with exponential
 * backoff + retry on HTTP 429.
 *
 * Run with:
 *   npm run fetch:catalog                 (or: npx tsx scripts/fetchCatalog.ts)
 *   MAX_GAMES=400 npm run fetch:catalog   (override the catalog size)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Game, GameCategory } from '../src/types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Initial list of Steam App IDs the catalog branches out from. */
const SEED_APP_IDS: number[] = [
  1313140, 632470, 1269950, 3527020, 262060, 413150, 1055540, 1135690, 2198150,
  1589350, 418370, 1458100, 1868140, 433340, 1610080, 1092790, 504230, 367520,
  1145360,
];

/** Public Steam endpoints used by this script (no auth required). */
const STEAM_APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails';
const STEAM_APPREVIEWS_URL = 'https://store.steampowered.com/appreviews';
const STEAM_SEARCH_URL = 'https://store.steampowered.com/search/results/';
const STEAM_APP_PAGE_URL = 'https://store.steampowered.com/app/';

/** Spacing between consecutive appdetails / appreviews requests (ms). */
const REQUEST_DELAY_MS = 1500;

/** Spacing between discovery (search) requests (ms). */
const SEARCH_DELAY_MS = 1200;

/** Spacing between seed app-page fetches (ms). */
const PAGE_DELAY_MS = 600;

/** Per-request timeout (ms). */
const REQUEST_TIMEOUT_MS = 20_000;

/** Base backoff used for 429 retries (ms). */
const RETRY_BASE_MS = 4000;

/** Maximum consecutive attempts before giving up on a request. */
const MAX_RETRIES = 3;

/** How many results to pull per discovery query. */
const RESULTS_PER_QUERY = 100;

/** Target catalog size (override with `MAX_GAMES=500 npm run fetch:catalog`). */
const MAX_TOTAL_GAMES = Number(process.env.MAX_GAMES) || 1100;

/**
 * Steam appdetails entries we consider full games. Anything else
 * (dlc, demo, mod, music, video, software, ...) is skipped so the
 * catalog only contains playable titles.
 */
const ALLOWED_APP_TYPES = new Set(['game']);

/** Output file (relative to the project root). */
const OUTPUT_FILE = path.resolve(process.cwd(), 'src', 'data', 'steamGamesCatalog.json');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// ---------------------------------------------------------------------------
// Verified Steam tag ids used for discovery (each id confirmed via the
// search/results API; `weight` biases which games rank as most relevant).
// ---------------------------------------------------------------------------

interface DiscoveryTag {
  id: number;
  name: string;
  weight: number;
}

const VERIFIED_TAGS: DiscoveryTag[] = [
  { id: 97376, name: 'Cozy', weight: 5 },
  { id: 1654, name: 'Relaxing', weight: 4 },
  { id: 552282, name: 'Wholesome', weight: 4 },
  { id: 87918, name: 'Farming Sim', weight: 4 },
  { id: 3920, name: 'Cooking', weight: 3 },
  { id: 4726, name: 'Cute', weight: 3 },
  { id: 916648, name: 'Creature Collector', weight: 3 },
  { id: 32322, name: 'Deckbuilding', weight: 3 },
  { id: 4328, name: 'City Builder', weight: 3 },
  { id: 492, name: 'Indie', weight: 3 },
  { id: 599, name: 'Simulation', weight: 3 },
  { id: 597, name: 'Casual', weight: 2 },
  { id: 1664, name: 'Puzzle', weight: 2 },
  { id: 3964, name: 'Pixel Graphics', weight: 2 },
  { id: 1643, name: 'Building', weight: 2 },
  { id: 3810, name: 'Sandbox', weight: 2 },
  { id: 3834, name: 'Exploration', weight: 2 },
  { id: 12472, name: 'Management', weight: 2 },
  { id: 1625, name: 'Platformer', weight: 2 },
  { id: 1628, name: 'Metroidvania', weight: 2 },
  { id: 21, name: 'Adventure', weight: 2 },
  { id: 122, name: 'RPG', weight: 2 },
  { id: 3959, name: 'Roguelite', weight: 2 },
  { id: 1716, name: 'Roguelike', weight: 2 },
  { id: 42804, name: 'Action Roguelike', weight: 2 },
  { id: 1702, name: 'Crafting', weight: 2 },
  { id: 5350, name: 'Family Friendly', weight: 2 },
  { id: 6815, name: 'Hand-drawn', weight: 2 },
  { id: 7332, name: 'Base Building', weight: 2 },
  { id: 15564, name: 'Fishing', weight: 2 },
  { id: 22602, name: 'Agriculture', weight: 2 },
  { id: 1742, name: 'Story Rich', weight: 1 },
  { id: 1756, name: 'Great Soundtrack', weight: 1 },
  { id: 3871, name: '2D', weight: 1 },
];

/** High-signal tag intersections (games matching both tags are very relevant). */
const PAIR_QUERIES: Array<[number, number]> = [
  [97376, 1654], [97376, 492], [97376, 599], [97376, 3964], [97376, 87918], [97376, 552282],
  [1654, 492], [1654, 599], [492, 599], [492, 3964],
  [87918, 492], [87918, 3964], [552282, 492], [4726, 492],
  [1643, 3810], [4328, 1643], [32322, 3959], [1716, 3959],
  [1664, 1654], [1702, 1643],
  // Wider net: combine the core cozy tags with each other and with secondary tags.
  [97376, 3920], [97376, 916648], [97376, 4726], [97376, 1643], [97376, 32322],
  [1654, 597], [1654, 1664], [1654, 1702], [1654, 122],
  [492, 597], [492, 3834], [492, 21], [492, 122], [492, 1702],
  [599, 597], [599, 12472], [599, 4328], [599, 3810], [599, 7332],
  [87918, 552282], [87918, 22602], [87918, 1643],
  [3920, 597], [3920, 4726],
  [916648, 4726], [4328, 12472], [1702, 7332], [1702, 12472],
  [1664, 597], [1625, 492], [1628, 492], [3964, 6815],
];

/** Tag names that count as "relevant" when parsing seed pages. */
const RELEVANT_TAG_NAMES = new Set(VERIFIED_TAGS.map((tag) => tag.name));

// ---------------------------------------------------------------------------
// Types for the Steam API responses (subset we consume)
// ---------------------------------------------------------------------------

interface SteamPriceOverview {
  currency?: string;
  initial?: number;
  final?: number;
  discount_percent?: number;
  initial_formatted?: string;
  final_formatted?: string;
}

interface SteamAppDetailsData {
  steam_appid?: number;
  type?: string;
  name?: string;
  short_description?: string;
  detailed_description?: string;
  header_image?: string;
  is_free?: boolean;
  price_overview?: SteamPriceOverview;
  developers?: string[];
  publishers?: string[];
  genres?: Array<{ id?: number | string; description?: string }>;
  release_date?: { coming_soon?: boolean; date?: string };
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
  metacritic?: { score?: number; url?: string };
  recommendations?: { total?: number };
}

interface SteamAppDetailsResponse {
  [appId: string]: { success?: boolean; data?: SteamAppDetailsData } | undefined;
}

interface SteamReviewSummary {
  success?: number;
  query_summary?: {
    num_reviews?: number;
    review_score?: number;
    review_score_desc?: string;
    total_positive?: number;
    total_negative?: number;
    total_reviews?: number;
  };
}

interface SearchResultsResponse {
  success?: number;
  results_html?: string;
  total_count?: number;
  start?: number;
}

// ---------------------------------------------------------------------------
// Async / string helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Turns a title into the slug-style id used across the site, e.g. "Dave the Diver" -> "dave-the-diver". */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Strips HTML from Steam's `detailed_description` and normalizes whitespace. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Normalizes Steam's "5 Aug, 2024" release strings to the site's "Aug 5, 2024" style. */
function normalizeReleaseDate(date: string | undefined, comingSoon?: boolean): string {
  if (!date || comingSoon || /coming\s*soon/i.test(date)) return 'Coming Soon';
  const parsed = new Date(date.replace(',', ''));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return date;
}

/** True if `date` falls within the last `days` days (used to flag new releases). */
function isReleasedWithinDays(date: string | undefined, days: number): boolean {
  if (!date) return false;
  const parsed = new Date(date.replace(',', ''));
  if (Number.isNaN(parsed.getTime())) return false;
  const ageMs = Date.now() - parsed.getTime();
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Genre -> site field heuristics (Steam doesn't expose these directly)
// ---------------------------------------------------------------------------

/** Maps Steam genre descriptions to the site's GameCategory. */
function categorize(genres: string[]): GameCategory {
  const lower = genres.map((genre) => genre.toLowerCase());

  if (lower.some((g) => g.includes('horror') || g.includes('psychological'))) return 'horror';
  if (lower.some((g) => g.includes('farming') || g.includes('agriculture'))) return 'farming';
  if (lower.some((g) => g.includes('cooking') || g.includes('culinary'))) return 'cooking';
  if (lower.some((g) => g.includes('driving') || g.includes('racing') || g.includes('automobile'))) return 'driving-sim';
  if (lower.some((g) => g.includes('roguelike') || g.includes('rogue-like'))) return 'roguelike';
  if (lower.some((g) => g.includes('puzzle'))) return 'puzzle';
  if (lower.some((g) => g.includes('rpg') || g.includes('role playing'))) return 'rpg';
  if (lower.some((g) => g.includes('simulation') || g.includes('simulator') || g.includes('management') || g.includes('tycoon'))) return 'simulation';
  if (lower.some((g) => g.includes('casual') || g.includes('indie') || g.includes('relaxing') || g.includes('family'))) return 'cozy';
  return 'indie';
}

/** Heuristic cozy score (1-10) derived from genre keywords; curate after generation. */
function cozyScoreFor(category: GameCategory, genres: string[]): number {
  if (category === 'horror') return 3.5;
  const cozyKeywords = [
    'casual', 'simulation', 'farming', 'puzzle', 'indie', 'relaxing',
    'building', 'crafting', 'management', 'adventure', 'family', 'cute',
  ];
  const lower = genres.map((genre) => genre.toLowerCase());
  let score = 6.5;
  for (const keyword of cozyKeywords) {
    if (lower.some((genre) => genre.includes(keyword))) score += 0.5;
  }
  return Math.min(10, Math.round(score * 10) / 10);
}

/** Maps a Steam review_score_desc (or a % score) onto the site's sentiment union. */
function sentimentFor(reviewScoreDesc: string | undefined, positivePercent: number | undefined): Game['reviewSentiment'] {
  const desc = (reviewScoreDesc || '').toLowerCase();
  if (desc.includes('overwhelmingly positive')) return 'Overwhelmingly Positive';
  if (desc.includes('very positive')) return 'Very Positive';
  if (desc.includes('mostly positive')) return 'Mostly Positive';
  if (desc.includes('positive')) return 'Positive';
  if (positivePercent !== undefined) {
    if (positivePercent >= 95) return 'Overwhelmingly Positive';
    if (positivePercent >= 80) return 'Very Positive';
    if (positivePercent >= 60) return 'Positive';
  }
  return 'Mostly Positive';
}

const GENRE_VIBES: Record<string, string> = {
  Simulation: 'Relaxing Simulation',
  Farming: 'Wholesome Farming',
  Puzzle: 'Gentle Brain Teasers',
  Casual: 'Low-Stress Casual',
  Indie: 'Handcrafted Indie',
  RPG: 'Cozy Adventure',
  Roguelike: 'Tactical Coziness',
  Adventure: 'Quiet Exploration',
  Building: 'Creative Building',
  Crafting: 'Satisfying Crafting',
  Management: 'Comfy Management',
  Strategy: 'Chill Strategy',
};

function buildVibes(genres: string[], category: GameCategory): string[] {
  const vibes: string[] = [];
  for (const genre of genres) {
    const vibe = GENRE_VIBES[genre] ?? `${genre} Vibes`;
    if (!vibes.includes(vibe)) vibes.push(vibe);
    if (vibes.length >= 5) break;
  }
  if (vibes.length === 0) vibes.push('Cozy Vibes', 'Relaxing Escape');
  return vibes;
}

function moodFor(category: GameCategory): string {
  const moods: Record<GameCategory, string> = {
    cozy: 'Gentle, Wholesome & Relaxing',
    indie: 'Handcrafted Charm & Quiet Depth',
    simulation: 'Laid-Back Systems & Daily Routines',
    'steam-deck': 'Pick-Up-and-Play Handheld Calm',
    horror: 'Atmospheric Tension & Unease',
    cooking: 'Warm Hearth & Satisfying Kitchen Flow',
    'job-sim': 'Relaxing Task Mastery',
    'driving-sim': 'Open-Road Tranquility',
    rpg: 'Story-Driven Comfort & Growth',
    roguelike: 'Strategic Flow & Cozy Loops',
    farming: 'Pastoral Peace & Seasonal Rhythm',
    puzzle: 'Gentle Mental Stretch',
  };
  return moods[category];
}

function gameplayStyleFor(category: GameCategory): string {
  const styles: Record<GameCategory, string> = {
    cozy: 'Gentle Cozy Gameplay',
    indie: 'Exploration & Relaxation',
    simulation: 'Laid-Back Simulation',
    'steam-deck': 'Handheld-Friendly Play',
    horror: 'Atmospheric Horror',
    cooking: 'Cooking & Restaurant Management',
    'job-sim': 'Relaxing Job Simulation',
    'driving-sim': 'Relaxed Driving Sim',
    rpg: 'Story-Driven Exploration',
    roguelike: 'Roguelike Depth in Cozy Doses',
    farming: 'Relaxing Farming & Simulation',
    puzzle: 'Chill Puzzle Solving',
  };
  return styles[category];
}

// ---------------------------------------------------------------------------
// HTTP helpers (timeout + 429 backoff/retry)
// ---------------------------------------------------------------------------

/** Fetches raw text with timeout + 429 backoff/retry; returns null on failure. */
async function fetchTextOrNull(url: string, attempt = 1): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json,*/*;q=0.8' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 429) {
      if (attempt <= MAX_RETRIES) {
        const backoffMs = RETRY_BASE_MS * attempt;
        await delay(backoffMs);
        return fetchTextOrNull(url, attempt + 1);
      }
      return null;
    }
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/** Fetches + parses JSON with timeout + 429 backoff/retry; returns null on failure. */
async function fetchJsonOrNull<T>(url: string, attempt = 1): Promise<T | null> {
  const text = await fetchTextOrNull(url, attempt);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Steam API clients
// ---------------------------------------------------------------------------

/**
 * Fetches app details for a single App ID and returns the payload only when
 * it is a full game. `l=english` keeps text in English; `cc=us` forces USD.
 */
async function fetchAppDetails(appId: number): Promise<SteamAppDetailsData | null> {
  const url = `${STEAM_APPDETAILS_URL}?appids=${appId}&l=english&cc=us`;
  const payload = await fetchJsonOrNull<SteamAppDetailsResponse>(url);
  const entry = payload?.[String(appId)];
  if (!entry?.success || !entry.data) return null;

  // Skip non-game entries (DLC, demos, soundtracks, software, etc.).
  if (entry.data.type && !ALLOWED_APP_TYPES.has(entry.data.type)) return null;

  return entry.data;
}

/** Fetches the review summary for an App ID (real rating % + sentiment). */
async function fetchAppReviews(appId: number): Promise<SteamReviewSummary | null> {
  const url = `${STEAM_APPREVIEWS_URL}/${appId}?json=1&purchase_type=all&num_per_page=0&l=english`;
  return fetchJsonOrNull<SteamReviewSummary>(url);
}

/**
 * Parses the numeric tag ids Steam embeds on an app page. Only tags whose
 * names are in the relevant allowlist are kept (index-paired with `tagids`).
 */
async function fetchSeedTags(appId: number): Promise<Array<{ name: string; id: number }>> {
  const html = await fetchTextOrNull(`${STEAM_APP_PAGE_URL}${appId}/?cc=us&l=english`);
  if (!html) return [];
  const match = html.match(/"tags":(\[[^\]]*\]),"tagids":(\[[^\]]*\])/);
  if (!match) return [];
  try {
    const names = JSON.parse(match[1]) as string[];
    const ids = JSON.parse(match[2]) as number[];
    return ids
      .map((id, index) => ({ name: names[index] ?? '', id }))
      .filter((tag) => tag.name && RELEVANT_TAG_NAMES.has(tag.name));
  } catch {
    return [];
  }
}

/**
 * Queries Steam's unauthenticated `search/results` JSON endpoint for a tag
 * (or comma-separated tag pair) and returns the matching App IDs.
 */
async function searchAppIdsForTags(tags: string): Promise<number[]> {
  const url = `${STEAM_SEARCH_URL}?query=&start=0&count=${RESULTS_PER_QUERY}&category1=998&term=&tags=${tags}&infinite=1`;
  const payload = await fetchJsonOrNull<SearchResultsResponse>(url);
  const html = payload?.results_html;
  if (!html) return [];
  return [...new Set([...html.matchAll(/store\.steampowered\.com\/app\/(\d+)\//g)].map((m) => Number(m[1])))];
}

// ---------------------------------------------------------------------------
// Discovery (branching out from the seed games)
// ---------------------------------------------------------------------------

/**
 * Phase 1 + 2: learns the relevant tag ids from the seed games' store pages,
 * then queries Steam's search API for every relevant tag (and tag pair) to
 * collect candidate App IDs. Each candidate is scored by the summed weight of
 * the queries it matched — games matching many cozy/indie tags rank highest.
 * Seed games always get a large base score so they're never dropped.
 */
async function discoverCandidates(): Promise<{ candidates: Map<number, number>; discoveredTags: Array<{ id: number; name: string }> }> {
  const tagMap = new Map<number, string>();
  const scores = new Map<number, number>();

  // Phase 1: learn tags from the seed store pages.
  for (let index = 0; index < SEED_APP_IDS.length; index += 1) {
    const seedId = SEED_APP_IDS[index];
    const tags = await fetchSeedTags(seedId);
    for (const tag of tags) {
      if (!tagMap.has(tag.id)) tagMap.set(tag.id, tag.name);
    }
    // Seed games are always prioritized for the catalog.
    scores.set(seedId, (scores.get(seedId) ?? 0) + 1000);
    console.log(`  [seed ${index + 1}/${SEED_APP_IDS.length}] app ${seedId} -> tags: ${tags.map((t) => `${t.name}(${t.id})`).join(', ') || 'none parsed'}`);
    if (index < SEED_APP_IDS.length - 1) await delay(PAGE_DELAY_MS);
  }

  // Merge in the verified tag set (guarantees coverage even if seed parsing misses some).
  for (const tag of VERIFIED_TAGS) {
    if (!tagMap.has(tag.id)) tagMap.set(tag.id, tag.name);
  }
  const tagIds = [...tagMap.keys()];
  console.log(`Discovered ${tagIds.length} relevant Steam tags: ${[...tagMap.entries()].map(([id, name]) => `${name}(${id})`).join(', ')}`);

  // Build the query list: one per relevant tag, plus high-signal tag pairs.
  const queries: Array<{ tags: string; weight: number; label: string }> = [
    ...VERIFIED_TAGS.map((tag) => ({ tags: String(tag.id), weight: tag.weight, label: tag.name })),
    ...PAIR_QUERIES.map(([a, b]) => {
      const ta = VERIFIED_TAGS.find((t) => t.id === a);
      const tb = VERIFIED_TAGS.find((t) => t.id === b);
      return {
        tags: `${a},${b}`,
        weight: (ta?.weight ?? 2) + (tb?.weight ?? 2),
        label: `${ta?.name ?? a} + ${tb?.name ?? b}`,
      };
    }),
  ];

  // Phase 2: run every query, accumulating relevance scores for candidates.
  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index];
    const appIds = await searchAppIdsForTags(query.tags);
    for (const appId of appIds) {
      scores.set(appId, (scores.get(appId) ?? 0) + query.weight);
    }
    console.log(`  [discovery ${index + 1}/${queries.length}] ${query.label} (${query.tags}) -> ${appIds.length} candidates`);
    if (index < queries.length - 1) await delay(SEARCH_DELAY_MS);
  }

  return { candidates: scores, discoveredTags: [...tagMap.entries()].map(([id, name]) => ({ id, name })) };
}

// ---------------------------------------------------------------------------
// Response -> Game mapping
// ---------------------------------------------------------------------------

/**
 * Maps Valve's nested appdetails payload onto the website's Game interface.
 * Real rating data (positive %, review count, sentiment) comes from the
 * `appreviews` summary when available; Metacritic is the fallback.
 */
function mapToGame(
  appId: number,
  data: SteamAppDetailsData,
  reviews: SteamReviewSummary | null,
  seenSlugs: Set<string>,
): Game {
  const genres = (data.genres ?? [])
    .map((genre) => genre.description)
    .filter((description): description is string => Boolean(description));

  const title = data.name?.trim() || `Steam Game ${appId}`;
  let slug = slugify(title) || `steam-${appId}`;
  if (seenSlugs.has(slug)) slug = `${slug}-${appId}`;
  seenSlugs.add(slug);

  const developer = data.developers?.[0]?.trim() || 'Unknown Developer';
  const publisher = data.publishers?.[0]?.trim() || developer;

  // Price: Steam exposes `price_overview.final_formatted`; free titles omit it.
  const isFree = Boolean(data.is_free) || !data.price_overview;
  const priceOverview = data.price_overview;
  const price = isFree ? 'Free' : priceOverview?.final_formatted?.trim() || 'Free';
  const discountPercent = priceOverview?.discount_percent ?? 0;
  const isOnSale = discountPercent > 0;

  const releaseDate = normalizeReleaseDate(data.release_date?.date, data.release_date?.coming_soon);
  const releaseStatus: Game['releaseStatus'] = data.release_date?.coming_soon ? 'upcoming' : 'released';

  const category = categorize(genres);
  const metacritic = data.metacritic?.score ?? 0;

  // Prefer real Steam review data over Metacritic.
  const summary = reviews?.query_summary;
  const totalReviews =
    summary?.total_reviews != null
      ? summary.total_reviews.toLocaleString('en-US')
      : data.recommendations?.total != null
        ? data.recommendations.total.toLocaleString('en-US')
        : 'N/A';
  const positivePercent =
    summary?.total_reviews ? Math.round(((summary.total_positive ?? 0) / summary.total_reviews) * 100) : undefined;
  const ratingScore = positivePercent ?? metacritic ?? 0;
  const reviewSentiment = sentimentFor(summary?.review_score_desc, positivePercent);

  const platforms: Game['platforms'] = ['PC', 'Steam'];
  if (data.platforms?.mac) platforms.push('Mac');
  if (data.platforms?.linux) platforms.push('Linux');

  const storeUrl = `https://store.steampowered.com/app/${appId}/`;
  const shortDescription = data.short_description?.trim() || 'A cozy indie title waiting to be discovered.';
  const fullDescription = stripHtml(data.detailed_description ?? '') || shortDescription;

  return {
    id: slug,
    title,
    slug,
    shortDescription,
    fullDescription,
    coverImage: data.header_image?.trim() || '',
    bannerImage: data.header_image?.trim() || '',
    developer,
    publisher,
    releaseDate,
    releaseStatus,
    price,
    originalPrice: isOnSale ? priceOverview?.initial_formatted?.trim() : undefined,
    salePrice: isOnSale ? priceOverview?.final_formatted?.trim() : undefined,
    discountPercent: isOnSale ? discountPercent : undefined,
    isOnSale,
    storePlatform: 'Steam',
    steamStoreUrl: storeUrl,
    demoAvailable: false, // Not exposed by appdetails; curate manually if needed.
    steamDeckStatus: 'Unknown', // Requires Valve's separate Steam Deck endpoint.
    steamDeckNotes: 'Steam Deck compatibility has not been verified yet — check Valve\u2019s Steam Deck compatibility site for the latest status.',
    cozyScore: cozyScoreFor(category, genres), // Heuristic; curate after generation.
    category,
    tags: genres.length > 0 ? genres : ['Indie', 'Casual'],
    primaryMood: moodFor(category),
    ratingScore,
    totalReviews,
    reviewSentiment,
    platforms,
    storeUrl,
    vibes: buildVibes(genres, category),
    isFeaturedThisWeek: false,
    isNewlyReleased: releaseStatus === 'released' && isReleasedWithinDays(data.release_date?.date, 60),
    isPopular: (summary?.total_reviews ?? data.recommendations?.total ?? 0) >= 5000,
    isHighlyRated: ratingScore >= 90 || (summary?.total_reviews ?? data.recommendations?.total ?? 0) >= 10000,
    isHiddenGem: false,
    gameplayStyle: gameplayStyleFor(category),
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Branching out from ${SEED_APP_IDS.length} seed games to build the Cozy/Indie Steam catalog (target: ${MAX_TOTAL_GAMES} games)...`);

  // Phase 1 + 2: learn relevant tags from seeds and discover candidates.
  const { candidates, discoveredTags } = await discoverCandidates();
  console.log(`Discovery complete: ${candidates.size} candidate apps scored across ${discoveredTags.length} relevant tags.`);

  // Rank candidates by relevance score (ties broken by app id for stability).
  const ranked = [...candidates.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([appId]) => appId);

  // Phase 3: enrich until we reach the target catalog size.
  const games: Game[] = [];
  const seenSlugs = new Set<string>();
  let processed = 0;
  let skipped = 0;
  const skipReasons = new Map<string, number>();

  for (const appId of ranked) {
    if (games.length >= MAX_TOTAL_GAMES) break;

    const details = await fetchAppDetails(appId);
    if (details && details.header_image) {
      const reviews = await fetchAppReviews(appId);
      const game = mapToGame(appId, details, reviews, seenSlugs);
      games.push(game);
      processed += 1;
      console.log(
        `  [enrich ${processed}/${MAX_TOTAL_GAMES}] ${game.title} | ${game.category} | ${game.price} | ${game.ratingScore}% | ${game.totalReviews} reviews`,
      );
    } else {
      skipped += 1;
      const reason = details ? 'missing-header-image' : 'unavailable-or-non-game';
      skipReasons.set(reason, (skipReasons.get(reason) ?? 0) + 1);
      if (skipped % 25 === 1) console.log(`  [skip] ${appId} (${reason})`);
    }

    // Rate-limit spacing between appdetails/appreviews requests.
    await delay(REQUEST_DELAY_MS);
  }

  console.log(`Enrichment complete: ${games.length} games kept, ${skipped} candidates skipped (${[...skipReasons.entries()].map(([k, v]) => `${k}: ${v}`).join(', ')}).`);

  // Phase 4: persist.
  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(games, null, 2)}\n`, 'utf8');

  console.log(`\nSaved ${games.length} games to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error('Fatal error while building catalog:', error);
  process.exitCode = 1;
});
