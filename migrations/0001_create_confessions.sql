CREATE TABLE IF NOT EXISTS confessions (
  session_hash TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_confessions_created_at
  ON confessions (created_at DESC);
