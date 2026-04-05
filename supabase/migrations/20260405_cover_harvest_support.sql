-- Migration: cover_harvest_support.sql
-- Supports cover image harvesting from graded book scans

-- 1. Add variant column to cover_images
ALTER TABLE cover_images ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT '';

-- 2. Backfill existing rows
UPDATE cover_images SET variant = '' WHERE variant IS NULL;

-- 3. Remove duplicate approved covers (keep most recently approved)
DELETE FROM cover_images a
USING cover_images b
WHERE a.title_normalized = b.title_normalized
  AND a.issue_number = b.issue_number
  AND COALESCE(a.variant, '') = COALESCE(b.variant, '')
  AND a.status = 'approved'
  AND b.status = 'approved'
  AND a.approved_at < b.approved_at;

-- 4. Partial unique index for dedup (one approved cover per title+issue+variant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cover_images_unique_approved
ON cover_images (title_normalized, issue_number, COALESCE(variant, ''))
WHERE status = 'approved';

-- 5. System harvest profile (sentinel row for automated operations)
INSERT INTO profiles (id, clerk_user_id, display_name, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'system_harvest', 'System Harvest', NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. Add cover_harvested tracking to scan_analytics
ALTER TABLE scan_analytics ADD COLUMN IF NOT EXISTS cover_harvested BOOLEAN DEFAULT FALSE;
