-- Cover Images Community Database
-- Stores admin-approved cover images for reuse across all users

CREATE TABLE IF NOT EXISTS cover_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title_normalized TEXT NOT NULL,
  issue_number TEXT NOT NULL,
  image_url TEXT NOT NULL,
  submitted_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  source_query TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- Fast lookups by title + issue + status
CREATE INDEX IF NOT EXISTS idx_cover_images_lookup
  ON cover_images(title_normalized, issue_number, status);

CREATE INDEX IF NOT EXISTS idx_cover_images_status
  ON cover_images(status, created_at DESC);

-- Enable RLS
ALTER TABLE cover_images ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved covers
CREATE POLICY "Anyone can read approved covers"
  ON cover_images FOR SELECT
  USING (status = 'approved');

-- Users can read their own pending/rejected covers
CREATE POLICY "Users can read own covers"
  ON cover_images FOR SELECT
  USING (
    submitted_by IN (
      SELECT id FROM profiles
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Admins can read all covers
CREATE POLICY "Admins can read all covers"
  ON cover_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
      AND is_admin = TRUE
    )
  );

-- Admins can update covers (approve/reject)
CREATE POLICY "Admins can update covers"
  ON cover_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
      AND is_admin = TRUE
    )
  );

-- Service role full access (API routes use supabaseAdmin)
CREATE POLICY "Service role full access to cover images"
  ON cover_images FOR ALL
  USING (auth.role() = 'service_role');
