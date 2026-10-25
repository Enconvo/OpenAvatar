-- Migration number: 0001 	 2026-10-24T22:28:59.073Z
-- Avatars people send to the gallery. Each waits as `pending` until a person approves it (it then joins the gallery's
-- files) or declines it (with a note saying why). Nothing identifies the sender beyond the credit they typed.
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  avatar_id TEXT NOT NULL,
  name TEXT NOT NULL,
  author TEXT,
  license TEXT NOT NULL,
  document TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  note TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE INDEX submissions_queue ON submissions (status, created_at);
-- One avatar (by its document id) waits in the queue or sits in the gallery once.
CREATE UNIQUE INDEX submissions_open ON submissions (avatar_id) WHERE status IN ('pending', 'approved');
