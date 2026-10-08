/** Game and article shapes returned by the API (shared with the frontend). */
import type { DeckStatus } from './steam';

export interface Game {
  appId: number;
  slug: string;
  title: string;
  description: string | null;
  developers: string[];
  publishers: string[];
  headerImage: string | null;
  capsuleImage: string | null;
  heroImage: string | null;
  /** ISO date when Steam has a date; for unreleased games may be a target date. */
  releaseDate: string | null;
  /** Steam's own wording for vague dates ("Q4 2026", "Coming soon"). */
  releaseLabel: string | null;
  comingSoon: boolean;
  earlyAccess: boolean;
  isFree: boolean;
  /** US store price in cents; null if not purchasable yet. */
  price: number | null;
  originalPrice: number | null;
  discountPct: number;
  discountEndsAt: string | null;
  reviewCount: number;
  reviewPercent: number | null;
  reviewLabel: string | null;
  deck: DeckStatus;
  /** Steam community tags, most-voted first. */
  tags: string[];
  cozy: boolean;
  indie: boolean;
  horror: boolean;
  genres: string[];
  storeUrl: string;
}

export interface Article {
  id: string;
  kind: 'news' | 'update';
  title: string;
  summary: string;
  url: string;
  source: string;
  author: string | null;
  imageUrl: string | null;
  publishedAt: string;
  cozy: boolean;
  indie: boolean;
  appIds: number[];
}

export type GameSort = 'popular' | 'rating' | 'newest' | 'discount' | 'price' | 'upcoming';

export interface GameQuery {
  section?: 'cozy' | 'indie';
  genre?: string;
  q?: string;
  deck?: 'verified' | 'playable';
  sale?: boolean;
  free?: boolean;
  sort?: GameSort;
  page?: number;
  limit?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface HomeFeed {
  lead: Game | null;
  newReleases: Game[];
  cozyPopular: Game[];
  indiePopular: Game[];
  deals: Game[];
  upcoming: Game[];
  news: Article[];
  updates: Article[];
  stats: SiteStats;
}

export interface SiteStats {
  games: number;
  cozy: number;
  indie: number;
  catalogUpdatedAt: string | null;
  newsUpdatedAt: string | null;
}
