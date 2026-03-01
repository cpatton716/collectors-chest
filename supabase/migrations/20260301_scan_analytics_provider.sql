-- Add provider tracking columns to scan_analytics
-- Part of Scan Resilience Phase 1: Multi-Provider Fallback
ALTER TABLE scan_analytics
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'anthropic',
  ADD COLUMN IF NOT EXISTS fallback_used boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_reason text;
