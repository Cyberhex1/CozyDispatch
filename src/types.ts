export type GameCategory = 
  | 'cozy' 
  | 'indie' 
  | 'simulation' 
  | 'steam-deck' 
  | 'horror' 
  | 'cooking' 
  | 'job-sim' 
  | 'driving-sim' 
  | 'rpg' 
  | 'roguelike'
  | 'farming'
  | 'puzzle';

export type SoundscapeTrack = 'rain' | 'campfire' | 'forest' | 'cafe' | 'none';

export type MainSection = 'home' | 'browser' | 'categories' | 'catalogs' | 'deals' | 'news' | 'quiz';

export type BrowserFilterType = 'newly_released' | 'popular' | 'highly_rated' | 'hidden_gems' | 'deals' | 'all';

export type SteamDeckStatus = 'Verified' | 'Playable' | 'Unsupported' | 'Unknown';

export type PCStore = 'Steam' | 'Epic Games' | 'Both';

export interface CatalogShowcase {
  id: string;
  name: string;
  slug: string;
  logoBadge?: string;
  bannerImage: string;
  tagline: string;
  description: string;
  websiteUrl: string;
  steamPublisherUrl: string;
  featuredTags: string[];
  curatorQuote: string;
  establishedYear: string;
  catalogCount: number;
  highlightGameIds: string[];
}

export interface Game {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  coverImage: string;
  bannerImage: string;
  developer: string;
  publisher: string;
  publisherCatalog?: string; // e.g. 'Wholesome Direct', 'Fellow Traveller', 'Annapurna Interactive', etc.
  releaseDate: string;
  releaseStatus: 'released' | 'upcoming' | 'early_access';
  price: string;
  originalPrice?: string;
  salePrice?: string;
  discountPercent?: number;
  isOnSale?: boolean;
  saleEndsAt?: string;
  saleDurationDays?: number;
  isHistoricalLow?: boolean;
  storePlatform?: PCStore;
  steamStoreUrl: string;
  epicStoreUrl?: string;
  demoAvailable: boolean;
  steamDeckStatus: SteamDeckStatus;
  steamDeckNotes: string;
  cozyScore: number; // 1 to 10 scale
  category: GameCategory;
  tags: string[];
  artStyle?: string;
  primaryMood?: string;
  ratingScore: number; // e.g. 96 for 96%
  totalReviews: string; // e.g. "12,450"
  reviewSentiment: 'Overwhelmingly Positive' | 'Very Positive' | 'Positive' | 'Mostly Positive';
  platforms: Array<'PC' | 'Steam Deck' | 'Steam' | 'Epic Games' | 'Mac' | 'Linux'>;
  storeUrl: string;
  trailerVideoUrl?: string;
  vibes: string[]; // e.g. ["Warm Lighting", "No Death Penalty", "Satisfying Sounds", "Wholesome NPCs"]
  isFeaturedThisWeek: boolean;
  featuredReason?: string;
  isNewlyReleased?: boolean;
  isPopular?: boolean;
  isHighlyRated?: boolean;
  isHiddenGem?: boolean;
  gameplayStyle?: string;
  averagePlaytimeHours?: string;
}

export type NewsSource = 'IGN' | 'GameSpot' | 'Eurogamer' | 'PC Gamer' | 'Rock Paper Shotgun' | 'Nintendo Life' | 'Wholesome Games' | 'Daily Dispatch AI';

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  source: NewsSource;
  sourceLogoUrl?: string;
  sourceUrl: string;
  publishedAt: string;
  category: GameCategory | 'general';
  relatedGameId?: string;
  relatedGameTitle?: string;
  imageUrl: string;
  tags: string[];
  readTimeMinutes: number;
  takeaways: string[];
  isHot?: boolean;
  author: string;
}

export interface PatchNote {
  id: string;
  gameId: string;
  gameTitle: string;
  gameCover: string;
  version: string;
  releaseDate: string;
  summary: string;
  category: GameCategory;
  isMajorUpdate: boolean;
  highlights: {
    title: string;
    description: string;
    badge?: string;
  }[];
  detailedNotes: string[];
  sourceUrl: string;
  deckImprovements?: string;
}

export interface UpcomingRelease {
  id: string;
  gameTitle: string;
  gameId?: string;
  releaseDate: string;
  countdownDays: number;
  platforms: string[];
  hypeScore: number; // 1-100
  cozyVibeNotes: string;
  coverImage: string;
  developer: string;
  category: GameCategory;
  tags: string[];
  storeUrl?: string;
  expectedPrice?: string;
  isWishlistedByUser?: boolean;
}

export interface DailyDigest {
  date: string;
  headline: string;
  greeting: string;
  curatedPicks: {
    gameTitle: string;
    highlight: string;
    vibeTag: string;
  }[];
  industryWhispers: string[];
  communityVibeCheck: string;
  aiGenerated?: boolean;
}

export interface WishlistItem {
  gameId: string;
  addedAt: string;
  notifyOnSale: boolean;
  notifyOnRelease: boolean;
  targetDiscountPercent?: number;
  priority: 'high' | 'medium' | 'low';
  customNotes?: string;
}

export interface NotificationAlert {
  id: string;
  gameId?: string;
  gameTitle?: string;
  gameCover?: string;
  type: 'sale' | 'release' | 'patch' | 'wishlist';
  title: string;
  message: string;
  timestamp?: string;
  date?: string;
  isRead: boolean;
  discountPercent?: number;
  salePrice?: string;
  originalPrice?: string;
  storeUrl?: string;
}

export interface DiscoveryQuizAnswers {
  genres: string[];
  artStyle: string;
  moodVibe: string;
  gameplayMechanics: string[];
  handheldPreference: 'steam_deck_priority' | 'desktop_pc' | 'any_pc';
  storePreference?: 'steam_only' | 'epic_preferred' | 'any_store';
  pricePreference: 'any' | 'on_sale' | 'under_15' | 'under_10';
}

export interface QuizRecommendationResult {
  game: Game;
  matchScore: number; // e.g. 98
  matchHighlights: string[];
  vibeRationale: string;
  cozyFeatureMatch: string;
}

export interface UserPreferences {
  notifyOnPriceDrops: boolean;
  notifyOnReleases: boolean;
  notifyOnPatches: boolean;
  preferredGenres: string[];
  preferredStore: 'all' | 'steam' | 'epic';
  steamDeckOnly: boolean;
  minCozyScore: number;
  dailyDigestOptIn: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  gamerTag: string;
  avatarIcon: string;
  bio: string;
  favoriteVibe: string;
  memberSince: string;
  preferences: UserPreferences;
}

export interface CozyVibePreference {
  energyLevel: 'zen' | 'gentle' | 'active';
  setting: 'farm' | 'cafe' | 'forest' | 'village' | 'space' | 'ocean' | 'fantasy';
  gameplayFocus: 'farming' | 'building' | 'puzzle' | 'story' | 'collecting' | 'crafting';
  timeCommitment: 'short_bursts' | 'deep_dive' | 'idle';
  steamDeckRequired: boolean;
}
