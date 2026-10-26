-- Migration number: 0002 	 2026-10-25T23:44:42.343Z
-- Tokens for the API (/api/v1/…, src/api.js). Only a token's SHA-256 is kept; the token itself is shown once, when it
-- is made, and `prefix` is how it is shown afterwards. A token without a monthly limit (Enconvo's own) is never cut
-- off; one made on /developers/ gets the free calls.
CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  name TEXT,
  monthly_limit INTEGER CHECK (monthly_limit IS NULL OR monthly_limit > 0),
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
-- The calls each token made in a calendar month (UTC, `YYYY-MM`).
CREATE TABLE api_usage (
  token_id TEXT NOT NULL REFERENCES api_tokens (id),
  month TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (token_id, month)
);
-- How many tokens one address made today, under a salted hash of the address and the day; earlier days are deleted.
CREATE TABLE token_issues (
  address TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (address, day)
);
