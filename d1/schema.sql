-- CozyDispatch Production Cloudflare D1 Database Schema
-- Compatible with Cloudflare D1 and SQLite3

-- 1. Users & Core Authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  hash_algorithm TEXT DEFAULT 'pbkdf2_sha256',
  created_at TEXT NOT NULL,
  last_synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. User Profiles & Preferences
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  gamer_tag TEXT,
  avatar_icon TEXT DEFAULT 'sprout',
  bio TEXT,
  favorite_vibe TEXT,
  member_since TEXT,
  preferences_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

-- 3. Sessions (Multi-device, Revocable Tokens)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at);

-- 4. User Wishlist Items
CREATE TABLE IF NOT EXISTS user_wishlist (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  notify_on_sale INTEGER DEFAULT 1,
  notify_on_release INTEGER DEFAULT 1,
  priority TEXT DEFAULT 'high',
  custom_notes TEXT,
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_user_wishlist_user ON user_wishlist(user_id);

-- 5. User Bookmarked News Articles
CREATE TABLE IF NOT EXISTS user_bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  bookmarked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON user_bookmarks(user_id);

-- 6. User Notifications
CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  game_id TEXT,
  game_title TEXT,
  game_cover TEXT,
  discount_percent INTEGER,
  sale_price TEXT,
  original_price TEXT,
  store_url TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id, created_at DESC);

-- 7. Newsletter Subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  subscribed_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'footer_signup',
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'unsubscribed'
  welcome_email_sent INTEGER DEFAULT 0,
  welcome_email_sent_at TEXT,
  unsubscribe_token TEXT UNIQUE NOT NULL,
  last_newsletter_sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_token ON newsletter_subscribers(unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON newsletter_subscribers(status);

-- 8. Email Outbox & Audit Logs
CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL COLLATE NOCASE,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL, -- 'delivered' | 'failed'
  sent_at TEXT NOT NULL,
  html_content TEXT,
  text_content TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_recipient ON email_outbox(recipient);
CREATE INDEX IF NOT EXISTS idx_outbox_sent_at ON email_outbox(sent_at DESC);

-- 9. Game Catalog (D1 Persistent Storage for Steam & Hand-Curated Games)
CREATE TABLE IF NOT EXISTS games_catalog (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  developer TEXT,
  publisher TEXT,
  short_description TEXT,
  full_description TEXT,
  header_image TEXT,
  capsule_image TEXT,
  price_original REAL,
  price_current REAL,
  discount_percent INTEGER DEFAULT 0,
  is_free INTEGER DEFAULT 0,
  release_date TEXT,
  steam_deck_status TEXT DEFAULT 'Unknown',
  steam_deck_notes TEXT,
  cozy_score REAL,
  rating_score REAL,
  review_count INTEGER DEFAULT 0,
  review_sentiment TEXT,
  categories_json TEXT DEFAULT '[]',
  tags_json TEXT DEFAULT '[]',
  vibes_json TEXT DEFAULT '[]',
  raw_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_rating ON games_catalog(rating_score DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_cozy ON games_catalog(cozy_score DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_deck ON games_catalog(steam_deck_status);

-- 10. News Articles (D1 Persistent Storage for RSS & Steam News)
CREATE TABLE IF NOT EXISTS news_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  image_url TEXT,
  author TEXT,
  read_time_minutes INTEGER DEFAULT 3,
  tags_json TEXT DEFAULT '[]',
  related_game_id TEXT,
  related_game_title TEXT,
  gemini_enriched INTEGER DEFAULT 0,
  gemini_summary TEXT,
  gemini_bullets_json TEXT DEFAULT '[]',
  gemini_sentiment TEXT,
  steam_deck_impact TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category);

-- 11. Incremental Sync & Ingestion State Tracking
CREATE TABLE IF NOT EXISTS ingestion_state (
  key TEXT PRIMARY KEY, -- 'news' | 'catalog' | 'rankings' | 'system'
  status TEXT NOT NULL DEFAULT 'idle',
  last_run_at TEXT,
  last_success_at TEXT,
  items_processed INTEGER DEFAULT 0,
  new_items_count INTEGER DEFAULT 0,
  updated_items_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  last_error TEXT,
  known_ids_json TEXT DEFAULT '[]',
  content_hashes_json TEXT DEFAULT '{}',
  updated_at TEXT NOT NULL
);
