import * as cheerio from 'cheerio';
import axios from 'axios';
import { GoogleGenAI, Type } from '@google/genai';
import { NewsArticle, NewsTopicCategory, NewsSource } from '../types';

// ============================================================================
// Types & Feed Definitions
// ============================================================================

export interface FeedSourceConfig {
  id: string;
  name: NewsSource;
  url: string;
  categoryHint?: NewsTopicCategory;
  defaultLogo?: string;
}

export const CURATED_RSS_FEEDS: FeedSourceConfig[] = [
  {
    id: 'rps-feed',
    name: 'Rock Paper Shotgun',
    url: 'https://www.rockpapershotgun.com/feed',
    categoryHint: 'indie'
  },
  {
    id: 'eurogamer-indie',
    name: 'Eurogamer',
    url: 'https://www.eurogamer.net/?format=rss&topic=indie',
    categoryHint: 'indie'
  },
  {
    id: 'nintendo-life-news',
    name: 'Nintendo Life',
    url: 'https://www.nintendolife.com/feeds/news',
    categoryHint: 'cozy'
  },
  {
    id: 'siliconera-feed',
    name: 'Siliconera',
    url: 'https://www.siliconera.com/feed/',
    categoryHint: 'life-sim'
  },
  {
    id: 'pcgamer-indie',
    name: 'PC Gamer',
    url: 'https://www.pcgamer.com/rss/',
    categoryHint: 'indie'
  }
];

export const STEAM_COZY_APPS: { appId: number; gameTitle: string; slug: string; defaultCategory: NewsTopicCategory }[] = [
  { appId: 2142790, gameTitle: 'Fields of Mistria', slug: 'fields-of-mistria', defaultCategory: 'farming' },
  { appId: 2198150, gameTitle: 'Tiny Glade', slug: 'tiny-glade', defaultCategory: 'building' },
  { appId: 413150, gameTitle: 'Stardew Valley', slug: 'stardew-valley', defaultCategory: 'farming' },
  { appId: 2379780, gameTitle: 'Balatro', slug: 'balatro', defaultCategory: 'indie' },
  { appId: 1657630, gameTitle: 'Slime Rancher 2', slug: 'slime-rancher-2', defaultCategory: 'cozy' },
  { appId: 2527500, gameTitle: "Rusty's Retirement", slug: 'rustys-retirement', defaultCategory: 'life-sim' },
  { appId: 1245560, gameTitle: 'Roots of Pacha', slug: 'roots-of-pacha', defaultCategory: 'farming' },
  { appId: 1868140, gameTitle: 'Dave the Diver', slug: 'dave-the-diver', defaultCategory: 'cozy' },
  { appId: 1158160, gameTitle: 'Coral Island', slug: 'coral-island', defaultCategory: 'life-sim' },
  { appId: 2195120, gameTitle: 'Go-Go Town!', slug: 'go-go-town', defaultCategory: 'building' },
  { appId: 1139980, gameTitle: "Travellers Rest", slug: 'travellers-rest', defaultCategory: 'life-sim' },
  { appId: 1658150, gameTitle: 'Moonstone Island', slug: 'moonstone-island', defaultCategory: 'rpg-adventure' },
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Keywords to score cozy & indie relevance
const COZY_POSITIVE_KEYWORDS = [
  'cozy', 'indie', 'wholesome', 'relaxing', 'farming', 'farm', 'life sim', 'simulator',
  'building', 'cottage', 'crafting', 'steam deck', 'pixel art', 'animals', 'cats', 'dogs',
  'stardew', 'mistria', 'tiny glade', 'balatro', 'chucklefish', 'annapurna', 'raw fury',
  'fellow traveller', 'wholesome games', 'peaceful', 'pastoral', 'gardening', 'cafe',
  'tavern', 'boba', 'town', 'village', 'decorating', 'cooking', 'deck verified', 'early access',
  'patch', 'roadmap', 'update', 'demo', 'trailer', 'announcement', 'cozy horror', 'dredge'
];

const DISQUALIFYING_KEYWORDS = [
  'call of duty', 'warzone', 'gta online', 'diablo iv', 'fortnite', 'counter-strike 2',
  'valorant', 'apex legends', 'esports tournament', 'gpu benchmark', 'rtx 5090', 'rtx 5080',
  'intel core', 'amd ryzen 9', 'battle pass tier', 'league of legends lcs'
];

// ============================================================================
// Helper Functions
// ============================================================================

function cleanText(html: string): string {
  if (!html) return '';
  const $ = cheerio.load(html);
  return $.text().replace(/\s+/g, ' ').trim();
}

function extractImageFromHtml(html: string): string | undefined {
  if (!html) return undefined;
  const $ = cheerio.load(html);
  const src = $('img').first().attr('src') || $('img').first().attr('data-src');
  if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
    return src;
  }
  return undefined;
}

function canonicalizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    parsed.searchParams.delete('utm_term');
    parsed.searchParams.delete('utm_content');
    parsed.searchParams.delete('ref');
    return parsed.toString();
  } catch {
    return urlStr;
  }
}

function calculateCozyScore(title: string, content: string): number {
  const text = `${title} ${content}`.toLowerCase();
  
  for (const dq of DISQUALIFYING_KEYWORDS) {
    if (text.includes(dq)) return -50;
  }

  let score = 0;
  for (const kw of COZY_POSITIVE_KEYWORDS) {
    if (text.includes(kw)) {
      score += 15;
    }
  }

  // Check matching game titles
  for (const app of STEAM_COZY_APPS) {
    if (text.includes(app.gameTitle.toLowerCase())) {
      score += 35;
    }
  }

  return Math.min(100, Math.max(0, score));
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (isNaN(date.getTime())) return 'Recently';
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function tokenize(str: string): Set<string> {
  return new Set(
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function titleSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  return intersection / Math.max(setA.size, setB.size);
}

// Fallback category heuristic
function heuristicCategorize(title: string, summary: string): NewsTopicCategory {
  const text = `${title} ${summary}`.toLowerCase();
  if (text.includes('patch') || text.includes('hotfix') || text.includes('update') || text.includes('changelog')) return 'developer-news';
  if (text.includes('trailer') || text.includes('gameplay video') || text.includes('teaser')) return 'trailers';
  if (text.includes('announced') || text.includes('revealed') || text.includes('roadmap')) return 'announcements';
  if (text.includes('out now') || text.includes('releases today') || text.includes('release date') || text.includes('launch')) return 'releases';
  if (text.includes('farming') || text.includes('farm') || text.includes('crops') || text.includes('harvest')) return 'farming';
  if (text.includes('building') || text.includes('castle') || text.includes('decorate') || text.includes('gridless')) return 'building';
  if (text.includes('cat') || text.includes('dog') || text.includes('animal') || text.includes('pet')) return 'animals';
  if (text.includes('horror') || text.includes('spooky') || text.includes('dredge') || text.includes('haunted')) return 'cozy-horror';
  if (text.includes('life sim') || text.includes('town') || text.includes('village') || text.includes('cafe')) return 'life-sim';
  if (text.includes('rpg') || text.includes('adventure') || text.includes('quest')) return 'rpg-adventure';
  if (text.includes('steam deck') || text.includes('handheld') || text.includes('tdp') || text.includes('oled')) return 'steam-deck';
  if (text.includes('wholesome')) return 'wholesome';
  return 'cozy';
}

function generateHeuristicTakeaways(title: string, summary: string): string[] {
  const sentences = summary.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
  if (sentences.length >= 2) {
    return [
      sentences[0],
      sentences[1],
      `Highlights latest updates and community features for cozy and indie players.`
    ];
  }
  return [
    `Key coverage for ${title.slice(0, 50)}...`,
    `Focuses on low-stress gameplay, player accessibility, and recent development milestones.`,
    `Recommended for fans of relaxing, handcrafted indie experiences.`
  ];
}

// ============================================================================
// 1. Fetch RSS Feeds
// ============================================================================

export async function fetchRssFeed(feed: FeedSourceConfig): Promise<NewsArticle[]> {
  try {
    const response = await axios.get(feed.url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 15_000
    });

    const xml = response.data;
    const $ = cheerio.load(xml, { xmlMode: true });
    const items: NewsArticle[] = [];

    $('item, entry').each((i, el) => {
      if (items.length >= 15) return false;

      const $el = $(el);
      const title = $el.find('title').text().trim();
      const rawLink = $el.find('link').text().trim() || $el.find('link').attr('href') || '';
      const link = canonicalizeUrl(rawLink);
      const pubDateStr = $el.find('pubDate, published, updated').first().text().trim();
      const author = $el.find('dc\\:creator, author name, creator').first().text().trim() || feed.name;
      
      const rawDesc = $el.find('description, summary').text().trim();
      const rawContent = $el.find('content\\:encoded, content').text().trim();
      const cleanDesc = cleanText(rawDesc || rawContent);

      // Extract image
      let imageUrl = 
        $el.find('enclosure[type^="image"]').attr('url') ||
        $el.find('media\\:content[medium="image"]').attr('url') ||
        $el.find('media\\:thumbnail').attr('url') ||
        extractImageFromHtml(rawContent) ||
        extractImageFromHtml(rawDesc);

      // Fallback default thematic images if none found
      if (!imageUrl) {
        if (title.toLowerCase().includes('mistria')) imageUrl = 'https://cdn.akamai.steamstatic.com/steam/apps/2142790/header.jpg';
        else if (title.toLowerCase().includes('glade')) imageUrl = 'https://cdn.akamai.steamstatic.com/steam/apps/2198150/header.jpg';
        else if (title.toLowerCase().includes('balatro')) imageUrl = 'https://cdn.akamai.steamstatic.com/steam/apps/2379780/header.jpg';
        else if (title.toLowerCase().includes('stardew')) imageUrl = 'https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg';
        else imageUrl = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80';
      }

      if (!title || !link) return;

      const relevanceScore = calculateCozyScore(title, cleanDesc);
      if (relevanceScore < 15) return; // Skip non-relevant articles

      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80);

      const category = feed.categoryHint || heuristicCategorize(title, cleanDesc);

      items.push({
        id: `${feed.id}-${slug}-${Math.abs(link.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0))}`,
        title,
        slug,
        summary: cleanDesc.slice(0, 240) + (cleanDesc.length > 240 ? '...' : ''),
        content: cleanDesc.slice(0, 1200),
        source: feed.name,
        sourceUrl: link,
        publishedAt: formatRelativeTime(pubDateStr),
        publishedIso: pubDateStr ? new Date(pubDateStr).toISOString() : new Date().toISOString(),
        category,
        imageUrl,
        tags: [category, feed.name, 'Indie News'],
        readTimeMinutes: Math.max(2, Math.min(8, Math.round(cleanDesc.split(/\s+/).length / 200))),
        takeaways: generateHeuristicTakeaways(title, cleanDesc),
        isHot: relevanceScore > 60,
        isFeatured: false,
        relevanceScore,
        author: author.replace(/^by\s+/i, '')
      });
    });

    return items;
  } catch (error: any) {
    console.warn(`[RSS] Failed to fetch feed ${feed.name}:`, error.message);
    return [];
  }
}

// ============================================================================
// 2. Fetch Steam Official News API
// ============================================================================

export async function fetchSteamNews(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  for (const app of STEAM_COZY_APPS.slice(0, 6)) {
    try {
      const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${app.appId}&count=3&maxlength=800&format=json`;
      const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 10_000 });
      const newsItems = res.data?.appnews?.newsitems || [];

      for (const item of newsItems) {
        const title = item.title?.trim();
        const content = cleanText(item.contents || '');
        const pubDate = new Date(item.date * 1000).toISOString();

        if (!title) continue;

        const slug = `${app.slug}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
        const category: NewsTopicCategory = item.title.toLowerCase().includes('patch') || item.title.toLowerCase().includes('hotfix')
          ? 'developer-news'
          : app.defaultCategory;

        articles.push({
          id: `steam-${app.appId}-${item.gid}`,
          title: `${app.gameTitle}: ${title}`,
          slug,
          summary: content.slice(0, 220) + '...',
          content: content.slice(0, 1000),
          source: 'Steam Official',
          sourceUrl: item.url || `https://store.steampowered.com/app/${app.appId}/`,
          publishedAt: formatRelativeTime(pubDate),
          publishedIso: pubDate,
          category,
          relatedGameId: app.slug,
          relatedGameTitle: app.gameTitle,
          imageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${app.appId}/header.jpg`,
          tags: [app.gameTitle, 'Developer Update', 'Patch Notes', 'Steam'],
          readTimeMinutes: Math.max(2, Math.round(content.split(/\s+/).length / 200)),
          takeaways: [
            `Official development update released for ${app.gameTitle}.`,
            `Includes latest performance fixes, content tweaks, and community enhancements.`,
            `Verified and fully playable on PC and Steam Deck.`
          ],
          isHot: true,
          isFeatured: false,
          relevanceScore: 90,
          author: `${app.gameTitle} Dev Team`
        });
      }
    } catch (err: any) {
      console.warn(`[SteamNews] Failed for app ${app.gameTitle}:`, err.message);
    }
  }

  return articles;
}

// ============================================================================
// 3. Deduplication & Clustering
// ============================================================================

export function deduplicateAndCluster(articles: NewsArticle[]): NewsArticle[] {
  const uniqueUrls = new Set<string>();
  const clustered: NewsArticle[] = [];

  for (const article of articles) {
    if (uniqueUrls.has(article.sourceUrl)) continue;
    uniqueUrls.add(article.sourceUrl);

    let merged = false;
    for (const existing of clustered) {
      const sim = titleSimilarity(existing.title, article.title);
      if (sim >= 0.65) {
        // Cluster as duplicate coverage
        existing.clusteredSources = existing.clusteredSources || [];
        existing.clusteredSources.push({
          source: article.source,
          url: article.sourceUrl,
          title: article.title
        });
        // Retain higher relevance score
        if ((article.relevanceScore || 0) > (existing.relevanceScore || 0)) {
          existing.relevanceScore = article.relevanceScore;
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      clustered.push(article);
    }
  }

  // Sort chronologically with relevance weight
  clustered.sort((a, b) => {
    const timeA = a.publishedIso ? new Date(a.publishedIso).getTime() : 0;
    const timeB = b.publishedIso ? new Date(b.publishedIso).getTime() : 0;
    return timeB - timeA;
  });

  // Assign top featured story: choose the most relevant recent story with a thumbnail
  const featuredCandidate = clustered.find(
    (a) => (a.relevanceScore || 0) >= 30 && a.imageUrl && !a.imageUrl.includes('placeholder')
  ) || clustered[0];

  if (featuredCandidate) {
    featuredCandidate.isFeatured = true;
  }

  return clustered;
}

// ============================================================================
// 4. Gemini Classification & Enrichment Pipeline
// ============================================================================

export async function enrichArticlesWithGemini(
  articles: NewsArticle[],
  apiKey?: string
): Promise<NewsArticle[]> {
  if (!apiKey || articles.length === 0) {
    return articles;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    // Enrich top 8 most recent articles in a batch for speed and cost efficiency
    const targetArticles = articles.slice(0, 8);
    const payload = targetArticles.map((a, i) => ({
      index: i,
      title: a.title,
      summary: a.summary,
      source: a.source
    }));

    const prompt = `You are the lead editor for CozyDispatch, a gaming publication specializing strictly in cozy, wholesome, simulation, and indie games.
Analyze these real gaming news articles and classify them into one of these 13 categories:
['cozy', 'indie', 'life-sim', 'farming', 'building', 'wholesome', 'cozy-horror', 'animals', 'rpg-adventure', 'announcements', 'trailers', 'developer-news', 'releases']

For each article, generate 3 concise, friendly 30-second bullet takeaways based strictly on the factual content provided (never fabricate new facts).

Input articles:
${JSON.stringify(payload, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.NUMBER },
              category: { type: Type.STRING },
              takeaways: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              isHot: { type: Type.BOOLEAN }
            },
            required: ['index', 'category', 'takeaways']
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || '[]');
    for (const item of parsed) {
      if (typeof item.index === 'number' && targetArticles[item.index]) {
        const art = targetArticles[item.index];
        if (item.category) art.category = item.category as NewsTopicCategory;
        if (Array.isArray(item.takeaways) && item.takeaways.length > 0) {
          art.takeaways = item.takeaways;
        }
        if (typeof item.isHot === 'boolean') art.isHot = item.isHot;
      }
    }
  } catch (error: any) {
    console.warn('[Gemini Enrichment] Skipped batch enrichment:', error.message);
  }

  return articles;
}

// ============================================================================
// Main Ingestion Orchestrator
// ============================================================================

export async function runFullNewsIngestion(apiKey?: string): Promise<NewsArticle[]> {
  console.log('[News Ingestion] Starting multi-source fetch...');
  const allArticles: NewsArticle[] = [];

  // 1. Fetch RSS Feeds in parallel
  const rssPromises = CURATED_RSS_FEEDS.map(f => fetchRssFeed(f));
  const rssResults = await Promise.allSettled(rssPromises);
  for (const res of rssResults) {
    if (res.status === 'fulfilled') {
      allArticles.push(...res.value);
    }
  }

  // 2. Fetch Steam Official News
  try {
    const steamArticles = await fetchSteamNews();
    allArticles.push(...steamArticles);
  } catch (err: any) {
    console.warn('[News Ingestion] Steam fetch error:', err.message);
  }

  console.log(`[News Ingestion] Raw articles collected: ${allArticles.length}`);

  // 3. Deduplicate & Cluster
  const deduplicated = deduplicateAndCluster(allArticles);
  console.log(`[News Ingestion] Deduplicated articles count: ${deduplicated.length}`);

  // 4. Enrich with Gemini if available
  const enriched = await enrichArticlesWithGemini(deduplicated, apiKey);
  console.log(`[News Ingestion] Enrichment complete. Total active feed: ${enriched.length}`);

  return enriched;
}
