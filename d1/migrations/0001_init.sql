-- CozyDispatch D1 schema (Cloudflare D1 / SQLite).
-- Apply in production with: npx wrangler d1 migrations apply cozydispatch-db --remote
-- Local dev applies this automatically (src/server/db/localSqlite.ts).

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  hash_iterations INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT 'sprout',
  bio TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Only a SHA-256 hash of the session token is stored, so a database leak
-- does not leak usable sessions.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_wishlist (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (user_id, app_id)
);

CREATE TABLE IF NOT EXISTS user_bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (user_id, article_id)
);

-- Fixed-window counters for login / signup / subscribe throttling.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Newsletter (double opt-in)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | unsubscribed
  source TEXT NOT NULL DEFAULT 'footer',
  confirm_token_hash TEXT,
  confirm_sent_at TEXT,
  unsubscribe_token TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  last_sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirm ON newsletter_subscribers(confirm_token_hash);

-- Delivery log only: no message bodies, no tokens.
CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL COLLATE NOCASE,
  template TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL, -- sent | failed | skipped
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log(created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_issues (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  intro TEXT NOT NULL,
  app_ids_json TEXT NOT NULL DEFAULT '[]',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Game catalog (filled by scripts/sync.ts from the Steam store APIs)
-- Every value here comes from Steam; nothing is guessed. Unknown = NULL.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
  app_id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  developers_json TEXT NOT NULL DEFAULT '[]',
  publishers_json TEXT NOT NULL DEFAULT '[]',
  asset_base TEXT,              -- e.g. steam/apps/413150/ (asset_url_format prefix)
  asset_version TEXT,           -- ?t= cache buster
  header_file TEXT,
  capsule_file TEXT,
  hero_file TEXT,
  release_ts INTEGER,           -- unix seconds, NULL if unknown
  release_label TEXT,           -- Steam's own text for unreleased games ("Q4 2026")
  is_coming_soon INTEGER NOT NULL DEFAULT 0,
  is_early_access INTEGER NOT NULL DEFAULT 0,
  is_free INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER,          -- US store price, NULL if not purchasable
  original_price_cents INTEGER,
  discount_pct INTEGER NOT NULL DEFAULT 0,
  discount_ends_ts INTEGER,
  review_count INTEGER NOT NULL DEFAULT 0,
  review_percent INTEGER,       -- % positive, NULL if too few reviews
  review_label TEXT,            -- Steam label, e.g. "Very Positive"
  deck_compat INTEGER NOT NULL DEFAULT 0, -- Steam: 0 unknown, 1 unsupported, 2 playable, 3 verified
  tags_json TEXT NOT NULL DEFAULT '[]',   -- Steam user tags, most-voted first
  is_cozy INTEGER NOT NULL DEFAULT 0,
  is_indie INTEGER NOT NULL DEFAULT 0,
  is_horror INTEGER NOT NULL DEFAULT 0,
  genres_json TEXT NOT NULL DEFAULT '[]', -- site genre ids derived from tags
  popularity INTEGER NOT NULL DEFAULT 0,  -- lower = more popular on Steam right now
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_games_cozy ON games(is_cozy, popularity);
CREATE INDEX IF NOT EXISTS idx_games_indie ON games(is_indie, popularity);
CREATE INDEX IF NOT EXISTS idx_games_release ON games(release_ts DESC);
CREATE INDEX IF NOT EXISTS idx_games_reviews ON games(review_count DESC);
CREATE INDEX IF NOT EXISTS idx_games_discount ON games(discount_pct DESC);
CREATE INDEX IF NOT EXISTS idx_games_updated ON games(updated_at);

-- ---------------------------------------------------------------------------
-- News & developer updates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,           -- news (press RSS) | update (Steam developer announcement)
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  author TEXT,
  image_url TEXT,
  published_ts INTEGER NOT NULL,
  is_cozy INTEGER NOT NULL DEFAULT 0,
  is_indie INTEGER NOT NULL DEFAULT 0,
  app_ids_json TEXT NOT NULL DEFAULT '[]', -- catalog games the article mentions
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_ts DESC);
CREATE INDEX IF NOT EXISTS idx_articles_kind ON articles(kind, published_ts DESC);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,         -- catalog | news
  status TEXT NOT NULL,         -- success | error
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  stats_json TEXT NOT NULL DEFAULT '{}',
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_runs_target ON sync_runs(target, finished_at DESC);
