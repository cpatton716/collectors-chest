-- ============================================================================
-- BARCODE CATALOG MIGRATION
-- Date: February 4, 2026
-- Purpose: Store community-submitted barcode mappings for comic identification
-- ============================================================================

-- Create barcode_catalog table
CREATE TABLE IF NOT EXISTS barcode_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comic_id UUID NOT NULL REFERENCES comics(id) ON DELETE CASCADE,

  -- Full barcode as scanned (e.g., "76194137691200521")
  raw_barcode TEXT NOT NULL,

  -- Parsed barcode components
  upc_prefix TEXT,       -- First 5 digits - publisher identifier (e.g., "76194")
  item_number TEXT,      -- Next 6 digits - series identifier
  check_digit TEXT,      -- 1 digit - validation
  addon_issue TEXT,      -- 3 digits from add-on - issue number
  addon_variant TEXT,    -- 2 digits from add-on - variant code

  -- Quality tracking
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  status TEXT CHECK (status IN ('auto_approved', 'pending_review', 'approved', 'rejected')) DEFAULT 'pending_review',

  -- Submission tracking
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for looking up barcodes by comic
CREATE INDEX IF NOT EXISTS idx_barcode_catalog_comic_id ON barcode_catalog(comic_id);

-- Index for looking up by raw barcode (exact match)
CREATE INDEX IF NOT EXISTS idx_barcode_catalog_raw_barcode ON barcode_catalog(raw_barcode);

-- Composite index for series lookup (publisher + series identifier)
CREATE INDEX IF NOT EXISTS idx_barcode_catalog_series ON barcode_catalog(upc_prefix, item_number);

-- Index for admin review queries
CREATE INDEX IF NOT EXISTS idx_barcode_catalog_status ON barcode_catalog(status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE barcode_catalog ENABLE ROW LEVEL SECURITY;

-- Users can view their own submitted barcodes
CREATE POLICY "barcode_catalog_select_own" ON barcode_catalog
  FOR SELECT
  USING (
    submitted_by = public.current_profile_id()
  );

-- Admins can view all barcodes
CREATE POLICY "barcode_catalog_select_admin" ON barcode_catalog
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.current_profile_id()
      AND is_admin = TRUE
    )
  );

-- Service role can insert (used by API)
CREATE POLICY "barcode_catalog_insert_service" ON barcode_catalog
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Service role can update (for review workflow)
CREATE POLICY "barcode_catalog_update_service" ON barcode_catalog
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE barcode_catalog IS 'Community-submitted barcode mappings for comic identification';
COMMENT ON COLUMN barcode_catalog.raw_barcode IS 'Full barcode as scanned (e.g., "76194137691200521")';
COMMENT ON COLUMN barcode_catalog.upc_prefix IS 'First 5 digits - publisher identifier';
COMMENT ON COLUMN barcode_catalog.item_number IS 'Next 6 digits - series identifier';
COMMENT ON COLUMN barcode_catalog.check_digit IS '1 digit - validation checksum';
COMMENT ON COLUMN barcode_catalog.addon_issue IS '3 digits from add-on - issue number';
COMMENT ON COLUMN barcode_catalog.addon_variant IS '2 digits from add-on - variant code';
COMMENT ON COLUMN barcode_catalog.confidence IS 'AI confidence level in the comic identification';
COMMENT ON COLUMN barcode_catalog.status IS 'Review status: auto_approved (high confidence), pending_review, approved, rejected';
