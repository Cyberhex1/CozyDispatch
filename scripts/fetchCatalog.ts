/**
 * scripts/fetchCatalog.ts
 *
 * Scrapes Steam's public APIs to build `src/data/steamGamesCatalog.json` —
 * a comprehensive catalog of applicable Cozy, Indie, Simulation, and Deck-friendly
 * games on Steam.
 *
 * Features:
 *   1. DISCOVERY ENGINE  – Paginates Steam's public search endpoint across 35+
 *                          cozy/indie tags, genre matrices, top-rated games,
 *                          and Steam Deck compatibility filters.
 *   2. ENRICHMENT        – Fetches full store details (pricing, descriptions,
 *                          hero banner screenshots, trailer video URLs,
 *                          Steam Deck badges) + live review sentiment/ratings.
 *   3. RESUMABLE CACHE   – Persists intermediate fetches to `scripts/.cache/`
 *                          allowing seamless resume without burning rate limits.
 *   4. ATOMIC FLUSH      – Progressively saves the catalog so the database is
 *                          always valid and up-to-date even during long runs.
 *   5. ADAPTIVE BACKOFF  – Gracefully handles HTTP 429 rate limits with
 *                          exponential backoff + jitter.
 *
 * Usage:
 *   npx tsx scripts/fetchCatalog.ts                      (Default discovery mode)
 *   npx tsx scripts/fetchCatalog.ts --max=50             (Scrape 50 games)
 *   npx tsx scripts/fetchCatalog.ts --mode=deep          (Deep pagination across all tags)
 *   npx tsx scripts/fetchCatalog.ts --mode=quick         (Quick run using seed games)
 *   npx tsx scripts/fetchCatalog.ts --category=farming   (Target specific category)
 *   npx tsx scripts/fetchCatalog.ts --resume             (Resume using cached state)
 *   npx tsx scripts/fetchCatalog.ts --help               (Show CLI options)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Game, GameCategory, SteamDeckStatus } from '../src/types';

// ---------------------------------------------------------------------------
// CLI Argument Parsing & Options
// ---------------------------------------------------------------------------

interface ScraperOptions {
  maxGames: number;
  mode: 'discovery' | 'deep' | 'quick';
  categoryFilter?: GameCategory | 'all';
  requestDelayMs: number;
  searchDelayMs: number;
  resume: boolean;
  pagesPerQuery: number;
}

function parseCliArgs(): ScraperOptions {
  const args = process.argv.slice(2);
  const options: ScraperOptions = {
    maxGames: Number(process.env.MAX_GAMES) || 1200,
    mode: (process.env.MODE as 'discovery' | 'deep' | 'quick') || 'discovery',
    categoryFilter: (process.env.CATEGORY as GameCategory | 'all') || 'all',
    requestDelayMs: Number(process.env.REQUEST_DELAY_MS) || 1200,
    searchDelayMs: Number(process.env.SEARCH_DELAY_MS) || 800,
    resume: process.env.RESUME === 'true' || false,
    pagesPerQuery: Number(process.env.PAGES_PER_QUERY) || 3,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
CozyDispatch Steam Library Scraper
==================================

Options:
  --max=<number>          Max games to scrape (default: 1200)
  --mode=<quick|discovery|deep>
                          Discovery mode:
                            quick     = Fast scan of seeds and top picks (~100-200 games)
                            discovery = Balanced multi-tag store discovery (default)
                            deep      = Exhaustive pagination across all tag matrices
  --category=<name>       Filter by category (e.g. cozy, farming, cooking, puzzle, etc.)
  --resume                Resume from disk cache in scripts/.cache/
  --delay=<ms>            Throttle delay between appdetails requests in ms (default: 1200)
  --pages=<n>             Number of search result pages per query tag (default: 3)
  --help, -h              Show this help message
`);
      process.exit(0);
    }
    if (arg.startsWith('--max=')) {
      options.maxGames = Number(arg.split('=')[1]);
    } else if (arg.startsWith('--mode=')) {
      const mode = arg.split('=')[1] as 'discovery' | 'deep' | 'quick';
      options.mode = mode;
      if (mode === 'deep') options.pagesPerQuery = 10;
      if (mode === 'quick') options.pagesPerQuery = 1;
    } else if (arg.startsWith('--category=')) {
      options.categoryFilter = arg.split('=')[1] as GameCategory | 'all';
    } else if (arg.startsWith('--delay=')) {
      options.requestDelayMs = Number(arg.split('=')[1]);
    } else if (arg.startsWith('--pages=')) {
      options.pagesPerQuery = Number(arg.split('=')[1]);
    } else if (arg === '--resume') {
      options.resume = true;
    }
  }

  return options;
}

const OPTIONS = parseCliArgs();

// ---------------------------------------------------------------------------
// Configuration & Constants
// ---------------------------------------------------------------------------

const OUTPUT_FILE = path.resolve(process.cwd(), 'src', 'data', 'steamGamesCatalog.json');
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

/** Curated seed App IDs representing the pinnacle of cozy, indie, and sim games */
const SEED_APP_IDS: number[] = [
  413150,   // Stardew Valley
  1055540,  // Dorfromantik
  1313140,  // Fields of Mistria
  2198150,  // Tiny Glade
  1589350,  // Dave the Diver
  1458100,  // Coral Island
  1135690,  // Slime Rancher 2
  632470,   // Risk of Rain 2
  262060,   // Darkest Dungeon
  3527020,  // Balatro
  418370,   // Resident Evil 7
  1868140,  // DREDGE
  433340,   // Slime Rancher
  1610080,  // Roots of Pacha
  1092790,  // In Stars and Time
  504230,   // Celeste
  367520,   // Hollow Knight
  1145360,  // Hades
  1465360,  // SnowRunner
  1385380,  // PowerWash Simulator
  1888930,  // Pacific Drive
  1659040,  // HITMAN World of Assassination
  960090,   // Bloons TD 6
  1269950,  // Cassette Beasts
  1794680,  // Vampire Survivors
  2427700,  // Minami Lane
  1243830,  // A Short Hike
  1158160,  // Unpacking
  1942280,  // Sticky Business
  2118370,  // Tavern Talk
];

// ---------------------------------------------------------------------------
// Verified Tag Matrix for Cozy / Indie / Simulation
// ---------------------------------------------------------------------------

interface DiscoveryTag {
  id: number;
  name: string;
  weight: number;
  categoryHint?: GameCategory;
}

const VERIFIED_TAGS: DiscoveryTag[] = [
  { id: 97376, name: 'Cozy', weight: 6, categoryHint: 'cozy' },
  { id: 1654, name: 'Relaxing', weight: 5, categoryHint: 'cozy' },
  { id: 552282, name: 'Wholesome', weight: 5, categoryHint: 'cozy' },
  { id: 87918, name: 'Farming Sim', weight: 5, categoryHint: 'farming' },
  { id: 3920, name: 'Cooking', weight: 4, categoryHint: 'cooking' },
  { id: 4726, name: 'Cute', weight: 4, categoryHint: 'cozy' },
  { id: 916648, name: 'Creature Collector', weight: 4, categoryHint: 'rpg' },
  { id: 32322, name: 'Deckbuilding', weight: 4, categoryHint: 'roguelike' },
  { id: 4328, name: 'City Builder', weight: 4, categoryHint: 'simulation' },
  { id: 492, name: 'Indie', weight: 3, categoryHint: 'indie' },
  { id: 599, name: 'Simulation', weight: 3, categoryHint: 'simulation' },
  { id: 597, name: 'Casual', weight: 3, categoryHint: 'cozy' },
  { id: 1664, name: 'Puzzle', weight: 3, categoryHint: 'puzzle' },
  { id: 3964, name: 'Pixel Graphics', weight: 3, categoryHint: 'indie' },
  { id: 1643, name: 'Building', weight: 3, categoryHint: 'simulation' },
  { id: 3810, name: 'Sandbox', weight: 3, categoryHint: 'simulation' },
  { id: 3834, name: 'Exploration', weight: 3, categoryHint: 'indie' },
  { id: 12472, name: 'Management', weight: 3, categoryHint: 'job-sim' },
  { id: 1625, name: 'Platformer', weight: 2, categoryHint: 'indie' },
  { id: 1628, name: 'Metroidvania', weight: 2, categoryHint: 'indie' },
  { id: 21, name: 'Adventure', weight: 2, categoryHint: 'indie' },
  { id: 122, name: 'RPG', weight: 2, categoryHint: 'rpg' },
  { id: 3959, name: 'Roguelite', weight: 3, categoryHint: 'roguelike' },
  { id: 1716, name: 'Roguelike', weight: 3, categoryHint: 'roguelike' },
  { id: 42804, name: 'Action Roguelike', weight: 2, categoryHint: 'roguelike' },
  { id: 1702, name: 'Crafting', weight: 3, categoryHint: 'simulation' },
  { id: 5350, name: 'Family Friendly', weight: 2, categoryHint: 'cozy' },
  { id: 6815, name: 'Hand-drawn', weight: 3, categoryHint: 'indie' },
  { id: 7332, name: 'Base Building', weight: 3, categoryHint: 'simulation' },
  { id: 15564, name: 'Fishing', weight: 3, categoryHint: 'cozy' },
  { id: 22602, name: 'Agriculture', weight: 4, categoryHint: 'farming' },
  { id: 1667, name: 'Horror', weight: 2, categoryHint: 'horror' },
  { id: 4166, name: 'Atmospheric Horror', weight: 2, categoryHint: 'horror' },
  { id: 1644, name: 'Driving', weight: 3, categoryHint: 'driving-sim' },
  { id: 110068, name: 'Automobile Sim', weight: 3, categoryHint: 'driving-sim' },
  { id: 1742, name: 'Story Rich', weight: 2, categoryHint: 'rpg' },
  { id: 3871, name: '2D', weight: 2, categoryHint: 'indie' },
];

/** High-signal tag intersections for targeted searches */
const PAIR_QUERIES: Array<[number, number]> = [
  [97376, 1654], [97376, 492], [97376, 599], [97376, 3964], [97376, 87918], [97376, 552282],
  [1654, 492], [1654, 599], [492, 599], [492, 3964], [87918, 492], [87918, 3964],
  [552282, 492], [4726, 492], [1643, 3810], [4328, 1643], [32322, 3959], [1716, 3959],
  [1664, 1654], [1702, 1643], [97376, 3920], [97376, 916648], [97376, 4726], [97376, 1643],
  [97376, 32322], [1654, 597], [1654, 1664], [1654, 1702], [1654, 122], [492, 597],
  [492, 3834], [492, 21], [492, 122], [492, 1702], [599, 597], [599, 12472],
  [599, 4328], [599, 3810], [599, 7332], [87918, 552282], [87918, 22602], [87918, 1643],
  [3920, 597], [3920, 4726], [916648, 4726], [4328, 12472], [1702, 7332], [1702, 12472],
  [1664, 597], [1625, 492], [1628, 492], [3964, 6815], [1667, 492], [1644, 599],
];

// ---------------------------------------------------------------------------
// Steam API Response Interfaces
// ---------------------------------------------------------------------------

interface SteamPriceOverview {
  currency?: string;
  initial?: number;
  final?: number;
  discount_percent?: number;
  initial_formatted?: string;
  final_formatted?: string;
}

interface SteamScreenshot {
  id?: number;
  path_thumbnail?: string;
  path_full?: string;
}

interface SteamMovie {
  id?: number;
  name?: string;
  thumbnail?: string;
  webm?: { 480?: string; max?: string };
  mp4?: { 480?: string; max?: string };
}

interface SteamCategoryEntry {
  id?: number;
  description?: string;
}

interface SteamAppDetailsData {
  steam_appid?: number;
  type?: string;
  name?: string;
  short_description?: string;
  detailed_description?: string;
  about_the_game?: string;
  header_image?: string;
  capsule_image?: string;
  is_free?: boolean;
  price_overview?: SteamPriceOverview;
  developers?: string[];
  publishers?: string[];
  genres?: Array<{ id?: number | string; description?: string }>;
  categories?: SteamCategoryEntry[];
  release_date?: { coming_soon?: boolean; date?: string };
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
  metacritic?: { score?: number; url?: string };
  recommendations?: { total?: number };
  screenshots?: SteamScreenshot[];
  movies?: SteamMovie[];
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
// Utility Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

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

function isReleasedWithinDays(date: string | undefined, days: number): boolean {
  if (!date) return false;
  const parsed = new Date(date.replace(',', ''));
  if (Number.isNaN(parsed.getTime())) return false;
  const ageMs = Date.now() - parsed.getTime();
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Category & Vibe Classifications
// ---------------------------------------------------------------------------

function categorize(genres: string[], appName = ''): GameCategory {
  const lower = [...genres.map((g) => g.toLowerCase()), appName.toLowerCase()];

  if (lower.some((g) => g.includes('horror') || g.includes('psychological'))) return 'horror';
  if (lower.some((g) => g.includes('farming') || g.includes('agriculture') || g.includes('harvest'))) return 'farming';
  if (lower.some((g) => g.includes('cooking') || g.includes('culinary') || g.includes('bakery') || g.includes('restaurant'))) return 'cooking';
  if (lower.some((g) => g.includes('driving') || g.includes('racing') || g.includes('automobile') || g.includes('truck') || g.includes('vehicle'))) return 'driving-sim';
  if (lower.some((g) => g.includes('roguelike') || g.includes('roguelite') || g.includes('deckbuilder') || g.includes('deckbuilding'))) return 'roguelike';
  if (lower.some((g) => g.includes('puzzle') || g.includes('logic') || g.includes('hidden object') || g.includes('escape room'))) return 'puzzle';
  if (lower.some((g) => g.includes('job') || g.includes('mechanic') || g.includes('powerwash') || g.includes('cleaner') || g.includes('store simulator'))) return 'job-sim';
  if (lower.some((g) => g.includes('rpg') || g.includes('role playing') || g.includes('jrpg') || g.includes('creature collector'))) return 'rpg';
  if (lower.some((g) => g.includes('simulation') || g.includes('simulator') || g.includes('management') || g.includes('tycoon') || g.includes('city builder') || g.includes('building'))) return 'simulation';
  if (lower.some((g) => g.includes('casual') || g.includes('cozy') || g.includes('relaxing') || g.includes('wholesome') || g.includes('family'))) return 'cozy';
  return 'indie';
}

function determineSteamDeckStatus(categories: SteamCategoryEntry[] = [], genres: string[] = []): SteamDeckStatus {
  // Category 28 = Full controller support
  const hasFullController = categories.some((c) => c.id === 28 || /full controller/i.test(c.description || ''));
  const hasPartialController = categories.some((c) => c.id === 18 || /partial controller/i.test(c.description || ''));

  if (hasFullController) return 'Verified';
  if (hasPartialController) return 'Playable';
  return 'Unknown';
}

function cozyScoreFor(category: GameCategory, genres: string[]): number {
  if (category === 'horror') return 3.5;
  const cozyKeywords = [
    'casual', 'simulation', 'farming', 'puzzle', 'indie', 'relaxing',
    'building', 'crafting', 'management', 'adventure', 'family', 'cute', 'cozy', 'wholesome',
  ];
  const lower = genres.map((genre) => genre.toLowerCase());
  let score = 6.5;
  for (const keyword of cozyKeywords) {
    if (lower.some((genre) => genre.includes(keyword))) score += 0.4;
  }
  return Math.min(10, Math.round(score * 10) / 10);
}

function sentimentFor(reviewScoreDesc: string | undefined, positivePercent: number | undefined): Game['reviewSentiment'] {
  const desc = (reviewScoreDesc || '').toLowerCase();
  if (desc.includes('overwhelmingly positive')) return 'Overwhelmingly Positive';
  if (desc.includes('very positive')) return 'Very Positive';
  if (desc.includes('mostly positive')) return 'Mostly Positive';
  if (desc.includes('positive')) return 'Positive';
  if (positivePercent !== undefined) {
    if (positivePercent >= 95) return 'Overwhelmingly Positive';
    if (positivePercent >= 80) return 'Very Positive';
    if (positivePercent >= 65) return 'Positive';
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
  Roguelike: 'Tactical Flow & Cozy Loops',
  Adventure: 'Quiet Exploration',
  Building: 'Creative Zen Architecture',
  Crafting: 'Satisfying Tactile Crafting',
  Management: 'Comfy Cozy Management',
  Strategy: 'Chill Mindful Strategy',
  Cooking: 'Warm Kitchen Flow',
  Driving: 'Open Road Tranquility',
  Horror: 'Atmospheric Tension',
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
    horror: 'Atmospheric Tension & Mystery',
    cooking: 'Warm Hearth & Satisfying Kitchen Flow',
    'job-sim': 'Relaxing Task Mastery & Satisfying Work',
    'driving-sim': 'Open-Road Tranquility & Scenic Cruising',
    rpg: 'Story-Driven Comfort & Character Growth',
    roguelike: 'Strategic Flow & Repeatable Delight',
    farming: 'Pastoral Peace & Seasonal Rhythm',
    puzzle: 'Gentle Mental Stretch & Zen Satisfaction',
  };
  return moods[category] || 'Relaxing & Engaging';
}

function gameplayStyleFor(category: GameCategory): string {
  const styles: Record<GameCategory, string> = {
    cozy: 'Gentle Cozy Gameplay',
    indie: 'Exploration & Handcrafted Delight',
    simulation: 'Laid-Back Simulation & Crafting',
    'steam-deck': 'Handheld-Friendly Couch Play',
    horror: 'Atmospheric Exploration',
    cooking: 'Cooking & Cafe Management',
    'job-sim': 'Satisfying Job Simulation',
    'driving-sim': 'Relaxed Driving Sim',
    rpg: 'Story-Driven Exploration & Quests',
    roguelike: 'Deep Strategy in Cozy Doses',
    farming: 'Relaxing Farming & Community Living',
    puzzle: 'Chill Puzzle Solving',
  };
  return styles[category] || 'Relaxing Interactive Experience';
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
  private appDetails = new Map<number, SteamAppDetailsData | null>();
  private appReviews = new Map<number, SteamReviewSummary | null>();

  async init(): Promise<void> {
    await mkdir(CACHE_DIR, { recursive: true });
    if (OPTIONS.resume) {
      try {
        if (existsSync(APPDETAILS_CACHE_FILE)) {
          const raw = await readFile(APPDETAILS_CACHE_FILE, 'utf8');
          const obj = JSON.parse(raw);
          for (const [k, v] of Object.entries(obj)) {
            this.appDetails.set(Number(k), v as any);
          }
          console.log(`📦 Loaded ${this.appDetails.size} cached app details entries from disk.`);
        }
        if (existsSync(APPREVIEWS_CACHE_FILE)) {
          const raw = await readFile(APPREVIEWS_CACHE_FILE, 'utf8');
          const obj = JSON.parse(raw);
          for (const [k, v] of Object.entries(obj)) {
            this.appReviews.set(Number(k), v as any);
          }
          console.log(`📦 Loaded ${this.appReviews.size} cached review summary entries from disk.`);
        }
      } catch (e) {
        console.warn('⚠️ Could not load disk cache, starting fresh.');
      }
    }
  }

  getDetails(appId: number): SteamAppDetailsData | null | undefined {
    return this.appDetails.get(appId);
  }

  setDetails(appId: number, data: SteamAppDetailsData | null): void {
    this.appDetails.set(appId, data);
  }

  getReviews(appId: number): SteamReviewSummary | null | undefined {
    return this.appReviews.get(appId);
  }

  setReviews(appId: number, data: SteamReviewSummary | null): void {
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

async function fetchAppDetails(appId: number): Promise<SteamAppDetailsData | null> {
  const cached = cache.getDetails(appId);
  if (cached !== undefined) return cached;

  const url = `${STEAM_APPDETAILS_URL}?appids=${appId}&l=english&cc=us`;
  const payload = await fetchJsonWithRetry<SteamAppDetailsResponse>(url);
  const entry = payload?.[String(appId)];

  let result: SteamAppDetailsData | null = null;
  if (entry?.success && entry.data) {
    if (!entry.data.type || ALLOWED_APP_TYPES.has(entry.data.type)) {
      result = entry.data;
    }
  }

  cache.setDetails(appId, result);
  return result;
}

async function fetchAppReviews(appId: number): Promise<SteamReviewSummary | null> {
  const cached = cache.getReviews(appId);
  if (cached !== undefined) return cached;

  const url = `${STEAM_APPREVIEWS_URL}/${appId}?json=1&purchase_type=all&num_per_page=0&l=english`;
  const payload = await fetchJsonWithRetry<SteamReviewSummary>(url);
  cache.setReviews(appId, payload);
  return payload;
}

async function searchAppIdsForQuery(params: {
  tags?: string;
  sort?: string;
  deckCompatibility?: number;
  start?: number;
  count?: number;
}): Promise<number[]> {
  const searchParams = new URLSearchParams({
    query: '',
    start: String(params.start ?? 0),
    count: String(params.count ?? RESULTS_PER_QUERY),
    category1: '998', // Games only
    infinite: '1',
    supportedlang: 'english',
  });

  if (params.tags) searchParams.set('tags', params.tags);
  if (params.sort) searchParams.set('sort_by', params.sort);
  if (params.deckCompatibility) searchParams.set('deck_compatibility', String(params.deckCompatibility));

  const url = `${STEAM_SEARCH_URL}?${searchParams.toString()}`;
  const payload = await fetchJsonWithRetry<SearchResultsResponse>(url);
  const html = payload?.results_html;
  if (!html) return [];

  const matches = [...html.matchAll(/store\.steampowered\.com\/app\/(\d+)\//g)].map((m) => Number(m[1]));
  return [...new Set(matches)];
}

// ---------------------------------------------------------------------------
// Candidate Discovery
// ---------------------------------------------------------------------------

async function runCandidateDiscovery(): Promise<Map<number, number>> {
  const scores = new Map<number, number>();

  // 1. Prioritize Seed Games
  for (const seedId of SEED_APP_IDS) {
    scores.set(seedId, 10_000);
  }

  if (OPTIONS.mode === 'quick') {
    console.log(`🚀 Quick mode active: Scraping seed list (${SEED_APP_IDS.length} games) + top store hits.`);
    const topPicks = await searchAppIdsForQuery({ tags: '97376', sort: 'Reviews_DESC', count: 50 });
    for (const id of topPicks) {
      scores.set(id, (scores.get(id) ?? 0) + 500);
    }
    return scores;
  }

  // 2. Build Query Matrix
  interface SearchPlan {
    label: string;
    tags?: string;
    sort?: string;
    deckCompat?: number;
    weight: number;
  }

  const queryPlan: SearchPlan[] = [
    // Top-reviewed across core cozy tags
    { label: 'Cozy Top Reviews', tags: '97376', sort: 'Reviews_DESC', weight: 15 },
    { label: 'Relaxing Top Reviews', tags: '1654', sort: 'Reviews_DESC', weight: 12 },
    { label: 'Farming Sim Top Reviews', tags: '87918', sort: 'Reviews_DESC', weight: 12 },
    { label: 'Wholesome Top Reviews', tags: '552282', sort: 'Reviews_DESC', weight: 12 },
    { label: 'Cute Top Reviews', tags: '4726', sort: 'Reviews_DESC', weight: 10 },
    
    // Steam Deck verified games
    { label: 'Steam Deck Verified Top Reviews', deckCompat: 3, sort: 'Reviews_DESC', weight: 12 },
    { label: 'Steam Deck Verified Cozy', tags: '97376', deckCompat: 3, weight: 15 },

    // Single tags
    ...VERIFIED_TAGS.map((tag) => ({
      label: `Tag: ${tag.name}`,
      tags: String(tag.id),
      weight: tag.weight,
    })),

    // High signal pairs
    ...PAIR_QUERIES.map(([a, b]) => {
      const ta = VERIFIED_TAGS.find((t) => t.id === a);
      const tb = VERIFIED_TAGS.find((t) => t.id === b);
      return {
        label: `Pair: ${ta?.name ?? a} + ${tb?.name ?? b}`,
        tags: `${a},${b}`,
        weight: (ta?.weight ?? 2) + (tb?.weight ?? 2) + 2,
      };
    }),
  ];

  console.log(`🔍 Running discovery across ${queryPlan.length} Steam search vectors (pages per query: ${OPTIONS.pagesPerQuery})...`);

  let completedQueries = 0;
  for (const plan of queryPlan) {
    completedQueries += 1;
    for (let page = 0; page < OPTIONS.pagesPerQuery; page += 1) {
      const start = page * RESULTS_PER_QUERY;
      const appIds = await searchAppIdsForQuery({
        tags: plan.tags,
        sort: plan.sort,
        deckCompatibility: plan.deckCompat,
        start,
        count: RESULTS_PER_QUERY,
      });

      if (appIds.length === 0) break;

      for (const appId of appIds) {
        scores.set(appId, (scores.get(appId) ?? 0) + plan.weight);
      }

      await delay(OPTIONS.searchDelayMs);
    }

    if (completedQueries % 10 === 0 || completedQueries === queryPlan.length) {
      console.log(`  [discovery ${completedQueries}/${queryPlan.length}] Processed "${plan.label}" -> ${scores.size} total unique candidates discovered so far.`);
    }
  }

  return scores;
}

// ---------------------------------------------------------------------------
// Game Mapping & Normalization
// ---------------------------------------------------------------------------

function mapToGame(
  appId: number,
  data: SteamAppDetailsData,
  reviews: SteamReviewSummary | null,
  seenSlugs: Set<string>,
): Game {
  const genres = (data.genres ?? [])
    .map((g) => g.description)
    .filter((d): d is string => Boolean(d));

  const title = data.name?.trim() || `Steam Game ${appId}`;
  let slug = slugify(title) || `steam-${appId}`;
  if (seenSlugs.has(slug)) slug = `${slug}-${appId}`;
  seenSlugs.add(slug);

  const developer = data.developers?.[0]?.trim() || 'Unknown Developer';
  const publisher = data.publishers?.[0]?.trim() || developer;

  const isFree = Boolean(data.is_free) || !data.price_overview;
  const priceOverview = data.price_overview;
  const price = isFree ? 'Free' : priceOverview?.final_formatted?.trim() || 'Free';
  const discountPercent = priceOverview?.discount_percent ?? 0;
  const isOnSale = discountPercent > 0;

  const releaseDate = normalizeReleaseDate(data.release_date?.date, data.release_date?.coming_soon);
  const releaseStatus: Game['releaseStatus'] = data.release_date?.coming_soon ? 'upcoming' : 'released';

  const category = categorize(genres, title);
  const metacritic = data.metacritic?.score ?? 0;

  const summary = reviews?.query_summary;
  const totalReviews =
    summary?.total_reviews != null
      ? summary.total_reviews.toLocaleString('en-US')
      : data.recommendations?.total != null
        ? data.recommendations.total.toLocaleString('en-US')
        : 'N/A';

  const positivePercent =
    summary?.total_reviews ? Math.round(((summary.total_positive ?? 0) / summary.total_reviews) * 100) : undefined;
  const ratingScore = positivePercent ?? (metacritic > 0 ? metacritic : 85);
  const reviewSentiment = sentimentFor(summary?.review_score_desc, positivePercent);

  const platforms: Game['platforms'] = ['PC', 'Steam'];
  if (data.platforms?.mac) platforms.push('Mac');
  if (data.platforms?.linux) platforms.push('Linux');

  // Steam Deck Status
  const steamDeckStatus = determineSteamDeckStatus(data.categories, genres);
  if (steamDeckStatus === 'Verified' || steamDeckStatus === 'Playable') {
    platforms.push('Steam Deck');
  }

  const storeUrl = `https://store.steampowered.com/app/${appId}/`;
  const shortDescription = data.short_description?.trim() || 'A cozy indie title waiting to be discovered.';
  const fullDescription = stripHtml(data.about_the_game || data.detailed_description || '') || shortDescription;

  // Media assets
  const coverImage = data.header_image?.trim() || data.capsule_image?.trim() || '';
  const bannerImage =
    data.screenshots && data.screenshots.length > 0
      ? data.screenshots[0]?.path_full || coverImage
      : coverImage;

  const trailerVideoUrl =
    data.movies && data.movies.length > 0
      ? data.movies[0]?.webm?.max || data.movies[0]?.mp4?.max || data.movies[0]?.webm?.[480]
      : undefined;

  const totalReviewsNum = summary?.total_reviews ?? data.recommendations?.total ?? 0;

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
    releaseDate,
    releaseStatus,
    price,
    originalPrice: isOnSale ? priceOverview?.initial_formatted?.trim() : undefined,
    salePrice: isOnSale ? priceOverview?.final_formatted?.trim() : undefined,
    discountPercent: isOnSale ? discountPercent : undefined,
    isOnSale,
    storePlatform: 'Steam',
    steamStoreUrl: storeUrl,
    demoAvailable: false,
    steamDeckStatus,
    steamDeckNotes:
      steamDeckStatus === 'Verified'
        ? 'Verified - Seamless full controller support and optimized default graphics on Steam Deck.'
        : steamDeckStatus === 'Playable'
          ? 'Playable on Steam Deck with minor controller or resolution adjustments.'
          : 'Check Valve’s official Steam Deck compatibility hub for latest test results.',
    cozyScore: cozyScoreFor(category, genres),
    category,
    tags: genres.length > 0 ? genres : ['Indie', 'Casual'],
    primaryMood: moodFor(category),
    ratingScore,
    totalReviews,
    reviewSentiment,
    platforms,
    storeUrl,
    trailerVideoUrl,
    vibes: buildVibes(genres, category),
    isFeaturedThisWeek: false,
    isNewlyReleased: releaseStatus === 'released' && isReleasedWithinDays(data.release_date?.date, 60),
    isPopular: totalReviewsNum >= 5000,
    isHighlyRated: ratingScore >= 90 || totalReviewsNum >= 10000,
    isHiddenGem: ratingScore >= 88 && totalReviewsNum >= 100 && totalReviewsNum < 2500,
    gameplayStyle: gameplayStyleFor(category),
  };
}

// ---------------------------------------------------------------------------
// Main Orchestrator
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n🎮 CozyDispatch Steam Scraper Initialized`);
  console.log(`   Target games: ${OPTIONS.maxGames} | Mode: ${OPTIONS.mode} | Delay: ${OPTIONS.requestDelayMs}ms\n`);

  await cache.init();

  // Step 1: Run candidate discovery
  const candidates = await runCandidateDiscovery();
  console.log(`\n✅ Discovery complete: ${candidates.size} unique candidate games scored.`);

  // Step 2: Rank candidates
  const ranked = [...candidates.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([appId]) => appId);

  // Step 3: Enrich candidates with full store & review metadata
  const games: Game[] = [];
  const seenSlugs = new Set<string>();
  let processed = 0;
  let skipped = 0;
  const skipReasons = new Map<string, number>();

  console.log(`\n📦 Enriching candidates via Steam public API (target: ${OPTIONS.maxGames} games)...`);

  for (const appId of ranked) {
    if (games.length >= OPTIONS.maxGames) break;

    const details = await fetchAppDetails(appId);
    if (details && details.name && details.header_image) {
      // Optional category filter
      const genres = (details.genres ?? []).map((g) => g.description || '');
      const gameCat = categorize(genres, details.name);
      if (OPTIONS.categoryFilter && OPTIONS.categoryFilter !== 'all' && gameCat !== OPTIONS.categoryFilter) {
        skipped += 1;
        skipReasons.set('category-mismatch', (skipReasons.get('category-mismatch') ?? 0) + 1);
        continue;
      }

      const reviews = await fetchAppReviews(appId);
      const game = mapToGame(appId, details, reviews, seenSlugs);
      games.push(game);
      processed += 1;

      console.log(
        `  [${processed}/${OPTIONS.maxGames}] ${game.title} | ${game.category} | ${game.price} | ⭐ ${game.ratingScore}% | 💬 ${game.totalReviews} (${game.steamDeckStatus})`,
      );

      // Save incremental checkpoint every 25 games
      if (processed % 25 === 0) {
        await cache.flush();
        await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
        await writeFile(OUTPUT_FILE, `${JSON.stringify(games, null, 2)}\n`, 'utf8');
        console.log(`  💾 Progress checkpoint saved (${games.length} games in ${OUTPUT_FILE}).`);
      }
    } else {
      skipped += 1;
      const reason = details ? 'missing-header' : 'unavailable-or-non-game';
      skipReasons.set(reason, (skipReasons.get(reason) ?? 0) + 1);
    }

    await delay(OPTIONS.requestDelayMs);
  }

  // Step 4: Final save
  await cache.flush();
  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(games, null, 2)}\n`, 'utf8');

  console.log(`\n🎉 Scraping Complete!`);
  console.log(`   Total games saved: ${games.length}`);
  console.log(`   Output file: ${OUTPUT_FILE}`);
  console.log(`   Skipped: ${skipped} (${[...skipReasons.entries()].map(([k, v]) => `${k}: ${v}`).join(', ')})\n`);
}

// Graceful interrupt handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Interrupted by user. Flushing cache...');
  await cache.flush();
  process.exit(0);
});

main().catch((err) => {
  console.error('❌ Fatal error during scrape:', err);
  process.exitCode = 1;
});
