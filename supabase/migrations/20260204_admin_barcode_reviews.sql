-- Migration: Admin barcode review table
-- Date: February 4, 2026
-- Purpose: Create review queue for low-confidence barcode detections

-- ============================================
-- 1. Create admin_barcode_reviews table
-- ============================================

CREATE TABLE IF NOT EXISTS admin_barcode_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to barcode catalog entry
  barcode_catalog_id UUID NOT NULL REFERENCES barcode_catalog(id) ON DELETE CASCADE,

  -- Detection data
  detected_upc TEXT NOT NULL,
  corrected_upc TEXT,
  cover_image_url TEXT NOT NULL,

  -- Display info (denormalized for admin convenience)
  comic_title TEXT,
  comic_issue TEXT,

  -- Review status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'corrected', 'rejected')),
  admin_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  -- Who resolved it
  resolved_by UUID REFERENCES profiles(id)
);

-- ============================================
-- 2. Create indexes
-- ============================================

-- Fast lookup by barcode catalog entry
CREATE INDEX IF NOT EXISTS idx_barcode_reviews_catalog_id ON admin_barcode_reviews(barcode_catalog_id);

-- Filter by status (most common: pending reviews)
CREATE INDEX IF NOT EXISTS idx_barcode_reviews_status ON admin_barcode_reviews(status);

-- Sort by creation date (newest first for review queue)
CREATE INDEX IF NOT EXISTS idx_barcode_reviews_created_at ON admin_barcode_reviews(created_at DESC);

-- ============================================
-- 3. Enable RLS and create policies
-- ============================================

ALTER TABLE admin_barcode_reviews ENABLE ROW LEVEL SECURITY;

-- Admins can view all reviews
CREATE POLICY "Admins can view barcode reviews"
  ON admin_barcode_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
      AND is_admin = TRUE
    )
  );

-- Admins can update reviews (approve, reject, correct)
CREATE POLICY "Admins can update barcode reviews"
  ON admin_barcode_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
      AND is_admin = TRUE
    )
  );

-- Service role can insert (from API routes)
CREATE POLICY "Service role can insert barcode reviews"
  ON admin_barcode_reviews FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Service role has full access for cleanup operations
CREATE POLICY "Service role full access to barcode reviews"
  ON admin_barcode_reviews FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 4. Comments for documentation
-- ============================================

COMMENT ON TABLE admin_barcode_reviews IS 'Queue for admin review of low-confidence barcode detections';
COMMENT ON COLUMN admin_barcode_reviews.barcode_catalog_id IS 'Links to the barcode_catalog entry being reviewed';
COMMENT ON COLUMN admin_barcode_reviews.detected_upc IS 'The UPC as detected by AI from the cover scan';
COMMENT ON COLUMN admin_barcode_reviews.corrected_upc IS 'Corrected UPC if admin found detection was wrong';
COMMENT ON COLUMN admin_barcode_reviews.cover_image_url IS 'Cover image for visual verification';
COMMENT ON COLUMN admin_barcode_reviews.comic_title IS 'Comic title for display in review queue';
COMMENT ON COLUMN admin_barcode_reviews.comic_issue IS 'Issue number for display in review queue';
COMMENT ON COLUMN admin_barcode_reviews.status IS 'pending=needs review, approved=UPC correct, corrected=UPC fixed, rejected=invalid entry';
COMMENT ON COLUMN admin_barcode_reviews.admin_notes IS 'Optional notes from reviewing admin';
COMMENT ON COLUMN admin_barcode_reviews.resolved_at IS 'When the review was completed';
COMMENT ON COLUMN admin_barcode_reviews.resolved_by IS 'Admin who completed the review';
