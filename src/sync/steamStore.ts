/**
 * Thin client for Steam's public store web APIs (no API key required).
 * Workers-safe: uses fetch only.
 */

export interface SteamStoreItem {
  id: number;
  appid?: number;
  type?: number;
  success?: number;
  visible?: boolean;
  name?: string;
  store_url_path?: string;
  is_free?: boolean;
  is_early_access?: boolean;
  tagids?: number[];
  tags?: { tagid: number; weight: number }[];
  basic_info?: {
    short_description?: string;
    developers?: { name: string }[];
    publishers?: { name: string }[];
  };
  reviews?: {
    summary_filtered?: { review_count: number; percent_positive: number; review_score: number; review_score_label: string };
  };
  assets?: {
    asset_url_format?: string;
    header?: string;
    main_capsule?: string;
    library_hero?: string;
    hero_capsule?: string;
    last_modified?: number;
  };
  release?: {
    steam_release_date?: number;
    is_coming_soon?: boolean;
    is_early_access?: boolean;
    coming_soon_display?: string;
    custom_release_date_message?: string;
  };
  platforms?: { steam_deck_compat_category?: number };
  best_purchase_option?: {
    final_price_in_cents?: string;
    original_price_in_cents?: string;
    discount_pct?: number;
    active_discounts?: { discount_end_date?: number }[];
  };
}

const CONTEXT = { language: 'english', country_code: 'US' };
const DATA_REQUEST = {
  include_assets: true,
  include_release: true,
  include_platforms: true,
  include_tag_count: 20,
  include_reviews: true,
  include_basic_info: true
};

/** StoreQuery sort orders observed on the public API. */
export const SORT_POPULAR = 10;
export const SORT_RELEASE_DESC = 20;

export async function fetchWithRetry(url: string, init: RequestInit = {}, attempts = 5): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(45_000) });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} from ${new URL(url).host}`);
      } else {
        return res;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 1500 * 2 ** i));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function callApi<T>(path: string, input: unknown): Promise<T> {
  const url = `https://api.steampowered.com/${path}?input_json=${encodeURIComponent(JSON.stringify(input))}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`Steam ${path} returned HTTP ${res.status}`);
  const body = (await res.json()) as { response?: T };
  if (!body.response) throw new Error(`Steam ${path} returned no response body`);
  return body.response;
}

export async function fetchTagNames(): Promise<Map<number, string>> {
  const res = await fetchWithRetry('https://api.steampowered.com/IStoreService/GetTagList/v1/?language=english');
  const body = (await res.json()) as { response: { tags: { tagid: number; name: string }[] } };
  return new Map(body.response.tags.map((t) => [t.tagid, t.name]));
}

export interface TagQuery {
  /** Human label for logs. */
  label: string;
  tagId: number;
  sort: number;
  /** Stop after this many results (Steam pages are 1000 items). */
  max: number;
  comingSoonOnly?: boolean;
}

/** Pages through a tag query, returning full store items in Steam's order. */
export async function queryByTag(q: TagQuery): Promise<SteamStoreItem[]> {
  const out: SteamStoreItem[] = [];
  const pageSize = 1000;
  for (let start = 0; start < q.max; start += pageSize) {
    const res = await callApi<{ metadata: { total_matching_records: number }; store_items?: SteamStoreItem[] }>(
      'IStoreQueryService/Query/v1/',
      {
        query: {
          start,
          count: Math.min(pageSize, q.max - start),
          sort: q.sort,
          filters: {
            type_filters: { include_games: true },
            tagids_must_match: [{ tagids: [q.tagId] }],
            ...(q.comingSoonOnly ? { coming_soon_only: true } : {})
          }
        },
        context: CONTEXT,
        data_request: DATA_REQUEST
      }
    );
    const items = res.store_items || [];
    out.push(...items);
    if (items.length === 0 || start + pageSize >= res.metadata.total_matching_records) break;
  }
  return out;
}

/** Fetches full store items for specific app ids (batches of 100). */
export async function getItems(appIds: number[]): Promise<SteamStoreItem[]> {
  const out: SteamStoreItem[] = [];
  for (let i = 0; i < appIds.length; i += 100) {
    const res = await callApi<{ store_items?: SteamStoreItem[] }>('IStoreBrowseService/GetItems/v1/', {
      ids: appIds.slice(i, i + 100).map((appid) => ({ appid })),
      context: CONTEXT,
      data_request: DATA_REQUEST
    });
    out.push(...(res.store_items || []));
  }
  return out;
}

export interface SteamNewsItem {
  gid: string;
  title: string;
  url: string;
  author?: string;
  contents: string;
  date: number;
  feedname: string;
  appid: number;
}

/** Developer announcements for one app (official Steam community announcements only). */
export async function getAppAnnouncements(appId: number, count = 3): Promise<SteamNewsItem[]> {
  const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=${count}&maxlength=600&feeds=steam_community_announcements&format=json`;
  const res = await fetchWithRetry(url);
  if (!res.ok) return [];
  const body = (await res.json()) as { appnews?: { newsitems?: SteamNewsItem[] } };
  return body.appnews?.newsitems || [];
}
