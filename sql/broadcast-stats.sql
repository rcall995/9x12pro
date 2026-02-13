-- broadcast_stats: Stores webhook-reported engagement metrics per broadcast
-- Run this in Supabase SQL Editor

-- 1. Create broadcast_stats table
CREATE TABLE IF NOT EXISTS broadcast_stats (
  broadcast_id TEXT PRIMARY KEY,
  sent INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  opened INTEGER DEFAULT 0,
  clicked INTEGER DEFAULT 0,
  bounced INTEGER DEFAULT 0,
  complained INTEGER DEFAULT 0,
  unsubscribed INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. RPC to atomically increment a stat column (upsert pattern)
CREATE OR REPLACE FUNCTION increment_broadcast_stat(
  p_broadcast_id TEXT,
  p_stat TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO broadcast_stats (broadcast_id, last_updated)
  VALUES (p_broadcast_id, now())
  ON CONFLICT (broadcast_id) DO NOTHING;

  EXECUTE format(
    'UPDATE broadcast_stats SET %I = %I + $1, last_updated = now() WHERE broadcast_id = $2',
    p_stat, p_stat
  ) USING p_amount, p_broadcast_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RLS: service_role has full access, authenticated users can SELECT
ALTER TABLE broadcast_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on broadcast_stats"
  ON broadcast_stats FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read broadcast_stats"
  ON broadcast_stats FOR SELECT
  USING (auth.role() = 'authenticated');

-- 4. Add contact_count column to email_broadcasts (for rate calculations)
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS contact_count INTEGER DEFAULT 0;
