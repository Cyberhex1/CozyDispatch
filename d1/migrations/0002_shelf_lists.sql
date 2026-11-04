-- Shelf statuses and notes, plus public game lists.
-- Apply in production with: npm run db:migrate:remote

-- Each saved game can carry a reading-list style status and a short private note.
ALTER TABLE user_wishlist ADD COLUMN status TEXT NOT NULL DEFAULT 'want'; -- want | playing | finished
ALTER TABLE user_wishlist ADD COLUMN note TEXT NOT NULL DEFAULT '';

-- Lists a member curates ("My cozy autumn picks"). Anyone with the link can view one;
-- only the owner can change it. The id is random and doubles as the share link.
CREATE TABLE IF NOT EXISTS game_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  app_ids_json TEXT NOT NULL DEFAULT '[]', -- ordered, as the owner arranged them
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_game_lists_user ON game_lists(user_id, updated_at DESC);
