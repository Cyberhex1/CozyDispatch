/**
 * Catalog sync: discovers cozy and indie games on Steam, classifies them from
 * their Steam community tags, applies a quality bar, and upserts the result.
 *
 * Every field written comes from Steam. Nothing is estimated or invented: if
 * Steam doesn't say, the column stays NULL / "unknown".
 */
import type { ID1Database } from '../server/db/d1Client';
import { classifyTags } from '../shared/genres';
import {
  fetchTagNames,
  queryByTag,
  SORT_POPULAR,
  SORT_RELEASE_DESC,
  type SteamStoreItem,
  type TagQuery
} from './steamStore';
import { recordSyncRun, upsertRows, type SqlValue } from './sqlWrite';

const TAG = {
  cozy: 97376,
  wholesome: 552282,
  farming: 87918,
  lifeSim: 10235,
  relaxing: 1654,
  cute: 4726,
  indie: 492
};

/** What we ask Steam for. Popular-sorted, so `max` keeps the best of broad tags. */
export const DISCOVERY_QUERIES: TagQuery[] = [
  { label: 'Cozy', tagId: TAG.cozy, sort: SORT_POPULAR, max: 10_000 },
  { label: 'Wholesome', tagId: TAG.wholesome, sort: SORT_POPULAR, max: 10_000 },
  { label: 'Farming Sim', tagId: TAG.farming, sort: SORT_POPULAR, max: 10_000 },
  { label: 'Life Sim', tagId: TAG.lifeSim, sort: SORT_POPULAR, max: 8_000 },
  { label: 'Relaxing', tagId: TAG.relaxing, sort: SORT_POPULAR, max: 4_000 },
  { label: 'Cute', tagId: TAG.cute, sort: SORT_POPULAR, max: 3_000 },
  { label: 'Indie', tagId: TAG.indie, sort: SORT_POPULAR, max: 8_000 },
  // Steam's tag search only matches a game's strongest tags, so well-known
  // indies whose "Indie" tag ranks low (Phasmophobia, DREDGE) never show up
  // under Indie. These broader lists catch them; classification still decides.
  { label: 'Horror', tagId: 1667, sort: SORT_POPULAR, max: 2_000 },
  { label: 'Psychological Horror', tagId: 1721, sort: SORT_POPULAR, max: 1_000 },
  { label: 'Roguelite', tagId: 3959, sort: SORT_POPULAR, max: 1_500 },
  { label: 'Roguelike', tagId: 1716, sort: SORT_POPULAR, max: 1_500 },
  { label: 'Puzzle', tagId: 1664, sort: SORT_POPULAR, max: 2_000 },
  { label: 'Story Rich', tagId: 1742, sort: SORT_POPULAR, max: 2_000 },
  { label: 'Exploration', tagId: 3834, sort: SORT_POPULAR, max: 2_000 },
  { label: 'Platformer', tagId: 1625, sort: SORT_POPULAR, max: 1_500 },
  { label: 'Pixel Graphics', tagId: 3964, sort: SORT_POPULAR, max: 2_000 },
  { label: 'Atmospheric', tagId: 4166, sort: SORT_POPULAR, max: 2_000 },
  { label: 'Co-op', tagId: 1685, sort: SORT_POPULAR, max: 1_500 },
  { label: 'Simulation', tagId: 599, sort: SORT_POPULAR, max: 3_000 },
  { label: 'Strategy', tagId: 9, sort: SORT_POPULAR, max: 1_500 },
  // New releases (newest first; includes some upcoming dates)
  { label: 'Indie: newest', tagId: TAG.indie, sort: SORT_RELEASE_DESC, max: 2_000 },
  { label: 'Cozy: newest', tagId: TAG.cozy, sort: SORT_RELEASE_DESC, max: 1_000 },
  // Most-anticipated upcoming games
  { label: 'Cozy: upcoming', tagId: TAG.cozy, sort: SORT_POPULAR, max: 300, comingSoonOnly: true },
  { label: 'Wholesome: upcoming', tagId: TAG.wholesome, sort: SORT_POPULAR, max: 200, comingSoonOnly: true },
  { label: 'Farming: upcoming', tagId: TAG.farming, sort: SORT_POPULAR, max: 200, comingSoonOnly: true },
  { label: 'Life Sim: upcoming', tagId: TAG.lifeSim, sort: SORT_POPULAR, max: 200, comingSoonOnly: true },
  { label: 'Indie: upcoming', tagId: TAG.indie, sort: SORT_POPULAR, max: 500, comingSoonOnly: true }
];

/**
 * Hand-curated corrections for well-known independent games that Steam players
 * don't tag "Indie" in their top 20 tags. Editorial calls, kept deliberately short.
 */
export const INDIE_OVERRIDES = new Set<number>([
  1966720 // Lethal Company (solo developer Zeekerss, self-published)
]);

/** Quality bar: keeps the catalog to games people actually play or are waiting for. */
export const QUALITY = {
  minReviewsCozy: 30,
  minReviewsIndie: 150,
  minPercentPositive: 50,
  newReleaseDays: 45,
  minReviewsNewRelease: 5,
  maxUpcomingRank: 150
};

export const GAME_COLUMNS = [
  'app_id', 'slug', 'title', 'short_description', 'developers_json', 'publishers_json',
  'asset_base', 'asset_version', 'header_file', 'capsule_file', 'hero_file',
  'release_ts', 'release_label', 'is_coming_soon', 'is_early_access', 'is_free',
  'price_cents', 'original_price_cents', 'discount_pct', 'discount_ends_ts',
  'review_count', 'review_percent', 'review_label', 'deck_compat', 'tags_json',
  'is_cozy', 'is_indie', 'is_horror', 'genres_json', 'popularity', 'first_seen_at', 'updated_at'
] as const;

export interface GameRow {
  appId: number;
  title: string;
  isCozy: boolean;
  isIndie: boolean;
  values: SqlValue[];
}

function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'game';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Mirrors how Steam itself displays an unreleased game's date. */
export function releaseLabel(release: SteamStoreItem['release']): string | null {
  if (!release) return null;
  if (release.custom_release_date_message) return release.custom_release_date_message;
  if (!release.is_coming_soon) return null;
  if (release.coming_soon_display === 'text_comingsoon') return 'Coming soon';
  if (release.coming_soon_display === 'text_tba') return 'To be announced';
  const ts = release.steam_release_date;
  if (!ts) return 'Coming soon';
  const d = new Date(ts * 1000);
  switch (release.coming_soon_display) {
    case 'date_month': return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    case 'date_quarter': return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
    case 'date_year': return String(d.getUTCFullYear());
    default: return null; // date_full: the exact date is shown from release_ts
  }
}

/** Splits Steam's asset_url_format ("steam/apps/413150/${FILENAME}?t=123") into base + version. */
function assetParts(format?: string): { base: string | null; version: string | null } {
  if (!format) return { base: null, version: null };
  const [pathPart, query] = format.split('?');
  const base = pathPart.replace('${FILENAME}', '');
  const version = query ? new URLSearchParams(query).get('t') : null;
  return { base, version };
}

function cents(value?: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface Candidate {
  item: SteamStoreItem;
  /** Best (lowest) position across popularity-sorted lists. */
  popularity: number;
  /** Best position in an upcoming list, if any. */
  upcomingRank: number | null;
}

export function toGameRow(c: Candidate, tagNames: Map<number, string>, nowIso: string, nowTs: number): GameRow | null {
  const it = c.item;
  const appId = it.appid ?? it.id;
  if (!appId || it.success !== 1 || it.visible === false || (it.type ?? 0) !== 0 || !it.name) return null;

  const tags = (it.tags ?? [])
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .map((t) => tagNames.get(t.tagid))
    .filter((t): t is string => Boolean(t));
  const cls = classifyTags(INDIE_OVERRIDES.has(appId) && !tags.includes('Indie') ? [...tags, 'Indie'] : tags);
  if (cls.isAdult || !(cls.isCozy || cls.isIndie)) return null;

  const reviews = it.reviews?.summary_filtered;
  const reviewCount = reviews?.review_count ?? 0;
  const reviewPercent = reviews && reviews.review_score > 0 ? reviews.percent_positive : null;
  const comingSoon = Boolean(it.release?.is_coming_soon);
  const releaseTs = it.release?.steam_release_date || null;

  // Quality bar
  if (comingSoon) {
    if (c.upcomingRank === null || c.upcomingRank > QUALITY.maxUpcomingRank) return null;
  } else {
    const ageDays = releaseTs ? (nowTs - releaseTs) / 86400 : Infinity;
    const isNew = ageDays <= QUALITY.newReleaseDays;
    const minReviews = isNew ? QUALITY.minReviewsNewRelease : cls.isCozy ? QUALITY.minReviewsCozy : QUALITY.minReviewsIndie;
    if (reviewCount < minReviews) return null;
    if (reviewPercent !== null && reviewPercent < QUALITY.minPercentPositive && !isNew) return null;
  }

  const purchase = it.best_purchase_option;
  const price = cents(purchase?.final_price_in_cents);
  const original = cents(purchase?.original_price_in_cents) ?? price;
  const discountEnds = purchase?.active_discounts?.map((d) => d.discount_end_date ?? 0).filter(Boolean).sort()[0] ?? null;
  const { base, version } = assetParts(it.assets?.asset_url_format);
  const isFree = Boolean(it.is_free) && !comingSoon;

  const values: SqlValue[] = [
    appId,
    slugify(it.name),
    it.name,
    it.basic_info?.short_description ?? null,
    JSON.stringify((it.basic_info?.developers ?? []).map((d) => d.name)),
    JSON.stringify((it.basic_info?.publishers ?? []).map((d) => d.name)),
    base,
    version,
    it.assets?.header ?? null,
    it.assets?.main_capsule ?? null,
    it.assets?.library_hero ?? it.assets?.hero_capsule ?? null,
    releaseTs,
    releaseLabel(it.release),
    comingSoon,
    Boolean(it.is_early_access || it.release?.is_early_access),
    isFree,
    isFree ? 0 : price,
    isFree ? 0 : original,
    purchase?.discount_pct ?? 0,
    discountEnds,
    reviewCount,
    reviewPercent,
    reviews && reviews.review_score > 0 ? reviews.review_score_label : null,
    it.platforms?.steam_deck_compat_category ?? 0,
    JSON.stringify(tags),
    cls.isCozy,
    cls.isIndie,
    cls.isHorror,
    JSON.stringify(cls.genres),
    c.popularity,
    nowIso, // first_seen_at (kept on update)
    nowIso
  ];
  return { appId, title: it.name, isCozy: cls.isCozy, isIndie: cls.isIndie, values };
}

export interface CatalogSyncResult {
  discovered: number;
  kept: number;
  cozy: number;
  indie: number;
  removedStale: number;
  queries: Record<string, number>;
}

export async function syncCatalog(db: ID1Database, log: (msg: string) => void = () => {}): Promise<CatalogSyncResult> {
  const startedAt = new Date();
  try {
    const tagNames = await fetchTagNames();
    const candidates = new Map<number, Candidate>();
    const queries: Record<string, number> = {};

    for (const q of DISCOVERY_QUERIES) {
      const items = await queryByTag(q);
      queries[q.label] = items.length;
      log(`  ${q.label}: ${items.length} games`);
      items.forEach((item, index) => {
        const appId = item.appid ?? item.id;
        if (!appId) return;
        const rank = index + 1;
        const existing = candidates.get(appId);
        const popularity = q.sort === SORT_POPULAR && !q.comingSoonOnly ? rank : 100_000 + rank;
        if (!existing) {
          candidates.set(appId, { item, popularity, upcomingRank: q.comingSoonOnly ? rank : null });
        } else {
          existing.popularity = Math.min(existing.popularity, popularity);
          if (q.comingSoonOnly) existing.upcomingRank = Math.min(existing.upcomingRank ?? Infinity, rank);
        }
      });
    }

    const nowIso = startedAt.toISOString();
    const nowTs = Math.floor(startedAt.getTime() / 1000);
    const rows = [...candidates.values()]
      .map((c) => toGameRow(c, tagNames, nowIso, nowTs))
      .filter((r): r is GameRow => r !== null);

    if (rows.length < 500) {
      // A tiny result almost certainly means Steam returned partial data; don't overwrite a good catalog.
      throw new Error(`Only ${rows.length} games passed the filters; refusing to write a partial catalog.`);
    }

    await upsertRows(db, 'games', [...GAME_COLUMNS], 'app_id', rows.map((r) => r.values), ['first_seen_at']);

    // Games that dropped out of every list (delisted, fell below the bar) are
    // removed once they've been missing for a week, so one bad run can't empty the site.
    const cutoff = new Date(startedAt.getTime() - 7 * 86400_000).toISOString();
    const removed = await db.prepare('DELETE FROM games WHERE updated_at < ?').bind(cutoff).run();

    const result: CatalogSyncResult = {
      discovered: candidates.size,
      kept: rows.length,
      cozy: rows.filter((r) => r.isCozy).length,
      indie: rows.filter((r) => r.isIndie).length,
      removedStale: Number(removed.meta?.changes ?? 0),
      queries
    };
    await recordSyncRun(db, 'catalog', startedAt, 'success', { ...result });
    return result;
  } catch (err: any) {
    await recordSyncRun(db, 'catalog', startedAt, 'error', {}, String(err?.message || err)).catch(() => {});
    throw err;
  }
}
