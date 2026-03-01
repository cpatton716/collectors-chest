-- Scan analytics table for cost tracking and performance monitoring
CREATE TABLE IF NOT EXISTS scan_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scan_method text NOT NULL DEFAULT 'camera',
  estimated_cost_cents numeric NOT NULL DEFAULT 0,
  ai_calls_made integer NOT NULL DEFAULT 0,
  metadata_cache_hit boolean NOT NULL DEFAULT false,
  ebay_lookup boolean NOT NULL DEFAULT false,
  duration_ms integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  subscription_tier text NOT NULL DEFAULT 'guest',
  error_type text
);

-- Composite index for date-range aggregation (primary query pattern)
CREATE INDEX idx_scan_analytics_scanned_at ON scan_analytics (scanned_at);

-- Index for per-user queries with date filtering
CREATE INDEX idx_scan_analytics_profile ON scan_analytics (profile_id, scanned_at);

-- RLS: admin-only read, service role insert
ALTER TABLE scan_analytics ENABLE ROW LEVEL SECURITY;

-- No select policy for regular users — only service role can read
-- Admin read access handled via supabaseAdmin in API routes

-- Aggregate function for average cost (avoids fetching all rows)
CREATE OR REPLACE FUNCTION get_avg_scan_cost(since timestamptz DEFAULT NULL)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(AVG(estimated_cost_cents), 0)
  FROM scan_analytics
  WHERE (since IS NULL OR scanned_at >= since);
$$;

-- Data retention note: ~1MB/year at 10K scans/month.
-- Revisit if scan volume exceeds 50K/month.
