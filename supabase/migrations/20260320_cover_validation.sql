-- Cover Image Validation Pipeline Migration
-- Run in Supabase SQL Editor BEFORE deploying the application code.
-- Date: 2026-03-20

-- ============================================================
-- STEP 1: Add new columns to comic_metadata
-- ============================================================

ALTER TABLE comic_metadata ADD COLUMN IF NOT EXISTS cover_source TEXT;
ALTER TABLE comic_metadata ADD COLUMN IF NOT EXISTS cover_validated BOOLEAN DEFAULT false;

-- ============================================================
-- STEP 2: Deduplicate rows that will conflict after normalization
-- Then normalize all titles and issue numbers.
-- Both steps MUST run atomically.
-- ============================================================

BEGIN;

-- Step 2a: Deduplicate — keep the row with highest lookup_count per normalized key
DELETE FROM comic_metadata
WHERE id NOT IN (
  SELECT DISTINCT ON (
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(issue_number), '#', '', 'g'), '[[:space:]]+', ' ', 'g'))
  ) id
  FROM comic_metadata
  ORDER BY
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(issue_number), '#', '', 'g'), '[[:space:]]+', ' ', 'g')),
    lookup_count DESC, cover_image_url IS NULL ASC, updated_at DESC
);

-- Step 2b: Normalize titles and issue numbers
-- Title: lowercase, strip non-alphanumeric (except hyphens/spaces), collapse whitespace
-- Issue: lowercase, strip ALL # characters (not just leading), collapse whitespace
UPDATE comic_metadata
SET title = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
    issue_number = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(issue_number), '#', '', 'g'), '[[:space:]]+', ' ', 'g'));

COMMIT;

-- ============================================================
-- STEP 3: Add functional uniqueness index (safety net)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_comic_metadata_unique_normalized
ON comic_metadata (
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(issue_number), '#', '', 'g'), '[[:space:]]+', ' ', 'g'))
);

-- ============================================================
-- STEP 4: Clear unreliable Open Library covers from user comics
-- ============================================================

UPDATE comics
SET cover_image_url = NULL
WHERE cover_image_url LIKE '%openlibrary.org%';
