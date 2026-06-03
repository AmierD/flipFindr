-- Run this in the Supabase SQL Editor to set up the database.

-- 1. Request counter (singleton row — only id=1 ever exists)
CREATE TABLE IF NOT EXISTS request_counter (
  id            integer PRIMARY KEY DEFAULT 1,
  request_count integer NOT NULL DEFAULT 0,
  last_reset    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the singleton row
INSERT INTO request_counter (id, request_count, last_reset)
VALUES (1, 0, now())
ON CONFLICT (id) DO NOTHING;

-- 2. Listings search cache
CREATE TABLE IF NOT EXISTS listings_cache (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key  text NOT NULL UNIQUE,
  response   jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-expire: index on created_at for TTL filtering
CREATE INDEX IF NOT EXISTS idx_listings_cache_created_at ON listings_cache (created_at);

-- 3. AVM result cache
CREATE TABLE IF NOT EXISTS avm_cache (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude   float NOT NULL,
  longitude  float NOT NULL,
  response   jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (latitude, longitude)
);

CREATE INDEX IF NOT EXISTS idx_avm_cache_created_at ON avm_cache (created_at);

-- 4. Row-Level Security
-- The app uses the service role key server-side, which bypasses RLS.
-- Enable RLS to block direct client access to these tables.
ALTER TABLE request_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE avm_cache ENABLE ROW LEVEL SECURITY;

-- No public access policies: only the service role (server-side) can read/write.
