CREATE TABLE IF NOT EXISTS reactions (
  track_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  emoji TEXT NOT NULL CHECK (emoji IN ('fire', 'heart', 'eyes', 'melt')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (track_id, token_hash)
);

CREATE INDEX IF NOT EXISTS reactions_by_track ON reactions (track_id, emoji);

CREATE TABLE IF NOT EXISTS guestbook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  day_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  last_at INTEGER NOT NULL
);
