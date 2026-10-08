/**
 * News sync: press RSS feeds filtered to stories about games in our catalog,
 * plus official developer announcements for the most popular catalog games.
 * Workers-safe (fetch + string parsing only).
 */
import type { ID1Database } from '../server/db/d1Client';
import { sha256Hex } from '../server/http';
import { fetchWithRetry, getAppAnnouncements } from './steamStore';
import { recordSyncRun, upsertRows, type SqlValue } from './sqlWrite';

export interface FeedSource {
  name: string;
  url: string;
}

export const NEWS_FEEDS: FeedSource[] = [
  { name: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed' },
  { name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/' },
  { name: 'Eurogamer', url: 'https://www.eurogamer.net/feed' },
  { name: 'Siliconera', url: 'https://www.siliconera.com/feed/' },
  { name: 'PCGamesN', url: 'https://www.pcgamesn.com/mainrss.xml' },
  { name: 'VG247', url: 'https://www.vg247.com/feed' },
  { name: 'Destructoid', url: 'https://www.destructoid.com/feed/' },
  { name: 'Game Developer', url: 'https://www.gamedeveloper.com/rss.xml' },
  { name: 'GamingOnLinux', url: 'https://www.gamingonlinux.com/article_rss.php' }
];

/** Words that, in a headline, make a story relevant even without a catalog match. */
const TOPIC_PATTERNS: { re: RegExp; cozy: boolean; indie: boolean }[] = [
  { re: /\b(cozy|cosy|wholesome)\b/i, cozy: true, indie: false },
  { re: /\b(farming sim|life sim|cottagecore)\b/i, cozy: true, indie: false },
  { re: /\bindie\b/i, cozy: false, indie: true }
];

/** Single-word game titles that are also everyday words; never matched alone. */
const AMBIGUOUS_TITLES = new Set([
  'inside', 'journey', 'control', 'limbo', 'unpacking', 'witness', 'abzu', 'gris', 'below', 'outer',
  'rain', 'home', 'island', 'farm', 'garden', 'kitchen', 'cozy', 'chill', 'love', 'music', 'night',
  'dream', 'dreams', 'forest', 'ocean', 'party', 'friends', 'together', 'alone', 'escape', 'survive',
  'build', 'craft', 'nature', 'spirit', 'magic', 'witch', 'sky', 'moon', 'sun', 'stars', 'snow', 'tavern',
  'factory', 'village', 'town', 'city', 'road', 'roads', 'train', 'boat', 'fish', 'fishing', 'cats', 'dogs'
]);

export interface CatalogTitle {
  app_id: number;
  title: string;
  is_cozy: number;
  is_indie: number;
  review_count: number;
  asset_base: string | null;
  header_file: string | null;
  asset_version: string | null;
}

interface TitleMatcher {
  appId: number;
  re: RegExp;
  isCozy: boolean;
  isIndie: boolean;
  image: string | null;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTitle(title: string): string {
  return title.replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();
}

/** Famous enough that a one-word title ("Celeste", "Balatro") is safe to match on its own. */
const SINGLE_WORD_MIN_REVIEWS = 20_000;

export function buildTitleMatchers(games: CatalogTitle[]): TitleMatcher[] {
  // Franchise prefixes shared by several games ("Warhammer 40,000") can't identify one game.
  const mainCounts = new Map<string, number>();
  const mainOf = (title: string) => title.split(/[:–—]\s|\s-\s/)[0].trim();
  for (const g of games) {
    const main = mainOf(normalizeTitle(g.title));
    mainCounts.set(main, (mainCounts.get(main) ?? 0) + 1);
  }

  const matchers: TitleMatcher[] = [];
  const usable = (name: string, reviews: number) => {
    const words = name.split(' ');
    if (name.length < 4 || AMBIGUOUS_TITLES.has(name.toLowerCase())) return false;
    if (words.length === 1) return name.length >= 5 && reviews >= SINGLE_WORD_MIN_REVIEWS;
    return true;
  };
  for (const g of games) {
    const title = normalizeTitle(g.title);
    const variants: string[] = [];
    if (usable(title, g.review_count)) variants.push(title);
    // "Hades II: ..." also matches as "Hades II" when that prefix is unique and multi-word.
    const main = mainOf(title);
    if (main !== title && main.includes(' ') && mainCounts.get(main) === 1 && usable(main, g.review_count)) variants.push(main);
    if (variants.length === 0) continue;
    const pattern = variants.map(escapeRegExp).join('|');
    matchers.push({
      appId: g.app_id,
      // Case-sensitive on purpose: headlines capitalise game names, which avoids matching ordinary words.
      re: new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, 'u'),
      isCozy: Boolean(g.is_cozy),
      isIndie: Boolean(g.is_indie),
      image: g.asset_base && g.header_file
        ? `https://shared.akamai.steamstatic.com/store_item_assets/${g.asset_base}${g.header_file}${g.asset_version ? `?t=${g.asset_version}` : ''}`
        : null
    });
  }
  // Longer titles first so "Stardew Valley" wins over a shorter overlapping title.
  return matchers.sort((a, b) => b.re.source.length - a.re.source.length);
}

// ---------------------------------------------------------------------------
// Minimal RSS/Atom parsing
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

/** Plain text from HTML that may itself be entity-encoded (common in RSS descriptions). */
export function stripHtml(s: string): string {
  return decodeEntities(stripTags(decodeEntities(stripTags(s)))).replace(/\s+/g, ' ').trim();
}

function tagContent(xml: string, names: string[]): string | null {
  for (const name of names) {
    const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
    if (m) return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
  }
  return null;
}

function attr(xml: string, tag: string, attribute: string): string | null {
  const m = xml.match(new RegExp(`<${tag}\\s[^>]*${attribute}=["']([^"']+)["']`, 'i'));
  return m ? decodeEntities(m[1]) : null;
}

export interface FeedEntry {
  title: string;
  url: string;
  summary: string;
  author: string | null;
  image: string | null;
  publishedTs: number;
}

export function parseFeed(xml: string): FeedEntry[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  const entries: FeedEntry[] = [];
  for (const block of blocks) {
    const title = stripHtml(tagContent(block, ['title']) || '');
    const link = tagContent(block, ['link']) || attr(block, 'link', 'href') || '';
    const url = decodeEntities(link.replace(/<!\[CDATA\[|\]\]>/g, '').trim());
    const date = tagContent(block, ['pubDate', 'published', 'updated', 'dc:date']);
    const publishedTs = date ? Math.floor(Date.parse(date) / 1000) : NaN;
    if (!title || !/^https?:\/\//.test(url) || !Number.isFinite(publishedTs)) continue;
    const rawSummary = tagContent(block, ['description', 'summary', 'content:encoded', 'content']) || '';
    const summary = stripHtml(rawSummary).slice(0, 400);
    const author = stripHtml(tagContent(block, ['dc:creator', 'author']) || '') || null;
    const image =
      attr(block, 'media:content', 'url') ||
      attr(block, 'media:thumbnail', 'url') ||
      attr(block, 'enclosure', 'url') ||
      (rawSummary.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null);
    entries.push({ title, url, summary, author: author?.slice(0, 80) ?? null, image: image && /^https:\/\//.test(image) ? image : null, publishedTs });
  }
  return entries;
}

function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    [...u.searchParams.keys()].filter((k) => k.startsWith('utm_')).forEach((k) => u.searchParams.delete(k));
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Steam announcement cleanup
// ---------------------------------------------------------------------------

export function cleanSteamAnnouncement(contents: string): { text: string; image: string | null } {
  const imgMatch = contents.match(/\{STEAM_CLAN_IMAGE\}\/([^\s\[\]"']+\.(?:png|jpe?g|gif|webp))/i);
  const image = imgMatch ? `https://clan.akamai.steamstatic.com/images/${imgMatch[1]}` : null;
  const text = stripHtml(
    contents
      .replace(/\{STEAM_CLAN_IMAGE\}\S*/g, ' ')
      .replace(/\[img[^\]]*\][\s\S]*?\[\/img\]/gi, ' ')
      .replace(/\[previewyoutube[^\]]*\][\s\S]*?\[\/previewyoutube\]/gi, ' ')
      .replace(/\[\/?[a-z0-9*]+(=[^\]]*)?\]/gi, ' ')
  );
  return { text: text.slice(0, 400), image };
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

const ARTICLE_COLUMNS = ['id', 'kind', 'title', 'summary', 'url', 'source', 'author', 'image_url', 'published_ts', 'is_cozy', 'is_indie', 'app_ids_json', 'created_at'];

export interface NewsSyncResult {
  feeds: Record<string, { fetched: number; kept: number; error?: string }>;
  updates: number;
  removedOld: number;
}

export async function syncNews(db: ID1Database, log: (msg: string) => void = () => {}): Promise<NewsSyncResult> {
  const startedAt = new Date();
  const nowIso = startedAt.toISOString();
  const nowTs = Math.floor(startedAt.getTime() / 1000);
  try {
    const catalog = (
      await db
        .prepare(`SELECT app_id, title, is_cozy, is_indie, review_count, asset_base, header_file, asset_version
                  FROM games WHERE is_coming_soon = 1 OR review_count >= 300 OR popularity <= 1500`)
        .all<CatalogTitle>()
    ).results;
    if (catalog.length === 0) throw new Error('Catalog is empty; run the catalog sync first.');
    const matchers = buildTitleMatchers(catalog);

    const rows: SqlValue[][] = [];
    const feeds: NewsSyncResult['feeds'] = {};

    for (const feed of NEWS_FEEDS) {
      try {
        const res = await fetchWithRetry(feed.url, { headers: { 'User-Agent': 'CozyDispatchBot/1.0 (+https://cozydispatch.pages.dev)' } }, 3);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const entries = parseFeed(await res.text());
        let kept = 0;
        for (const e of entries) {
          if (nowTs - e.publishedTs > 60 * 86400) continue;
          const matched = matchers.filter((m) => m.re.test(e.title));
          const topics = TOPIC_PATTERNS.filter((t) => t.re.test(e.title));
          if (matched.length === 0 && topics.length === 0) continue;
          const isCozy = matched.some((m) => m.isCozy) || topics.some((t) => t.cozy);
          const isIndie = matched.some((m) => m.isIndie) || topics.some((t) => t.indie);
          const url = canonicalUrl(e.url);
          rows.push([
            `n-${(await sha256Hex(url)).slice(0, 20)}`, 'news', e.title.slice(0, 300), e.summary, url, feed.name, e.author,
            e.image ?? matched[0]?.image ?? null, e.publishedTs, isCozy, isIndie,
            JSON.stringify(matched.slice(0, 5).map((m) => m.appId)), nowIso
          ]);
          kept++;
        }
        feeds[feed.name] = { fetched: entries.length, kept };
        log(`  ${feed.name}: ${kept}/${entries.length} relevant`);
      } catch (err: any) {
        feeds[feed.name] = { fetched: 0, kept: 0, error: String(err?.message || err) };
        log(`  ${feed.name}: failed (${err?.message || err})`);
      }
    }

    // Developer announcements for the most popular released games in each section.
    const topGames = (
      await db
        .prepare(`SELECT app_id, title, is_cozy, is_indie FROM (
                    SELECT * FROM games WHERE is_cozy = 1 AND is_coming_soon = 0 ORDER BY popularity LIMIT 50)
                  UNION SELECT app_id, title, is_cozy, is_indie FROM (
                    SELECT * FROM games WHERE is_indie = 1 AND is_cozy = 0 AND is_coming_soon = 0 ORDER BY popularity LIMIT 50)`)
        .all<{ app_id: number; title: string; is_cozy: number; is_indie: number }>()
    ).results;
    let updates = 0;
    for (const g of topGames) {
      const items = await getAppAnnouncements(g.app_id, 3).catch(() => []);
      for (const n of items) {
        if (nowTs - n.date > 45 * 86400) continue;
        const { text, image } = cleanSteamAnnouncement(n.contents);
        rows.push([
          `u-${n.gid}`, 'update', stripHtml(n.title).slice(0, 300), text, n.url, g.title, n.author ?? null, image,
          n.date, Boolean(g.is_cozy), Boolean(g.is_indie), JSON.stringify([g.app_id]), nowIso
        ]);
        updates++;
      }
    }
    log(`  Developer updates: ${updates} from ${topGames.length} games`);

    // De-duplicate by id (the same story can appear in two feeds).
    const unique = [...new Map(rows.map((r) => [r[0] as string, r])).values()];
    await upsertRows(db, 'articles', ARTICLE_COLUMNS, 'id', unique, ['created_at']);

    const removed = await db.prepare('DELETE FROM articles WHERE published_ts < ?').bind(nowTs - 120 * 86400).run();
    const result: NewsSyncResult = { feeds, updates, removedOld: Number(removed.meta?.changes ?? 0) };
    await recordSyncRun(db, 'news', startedAt, 'success', { ...result, articles: unique.length });
    return result;
  } catch (err: any) {
    await recordSyncRun(db, 'news', startedAt, 'error', {}, String(err?.message || err)).catch(() => {});
    throw err;
  }
}
