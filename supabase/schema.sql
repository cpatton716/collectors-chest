-- Supabase Schema for Comic Tracker
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (linked to Clerk users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups by clerk_user_id
CREATE INDEX idx_profiles_clerk_user_id ON profiles(clerk_user_id);

-- Lists table (user's custom lists)
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lists_user_id ON lists(user_id);

-- Comics table (collection items)
CREATE TABLE comics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Comic details
  title TEXT,
  issue_number TEXT,
  variant TEXT,
  publisher TEXT,
  cover_artist TEXT,
  writer TEXT,
  interior_artist TEXT,
  release_year TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),

  -- Grading info
  is_slabbed BOOLEAN DEFAULT FALSE,
  grading_company TEXT,
  grade TEXT,
  is_signature_series BOOLEAN DEFAULT FALSE,
  signed_by TEXT,

  -- Price data (stored as JSONB for flexibility)
  price_data JSONB,

  -- Collection item fields
  cover_image_url TEXT,
  condition_grade DECIMAL,
  condition_label TEXT,
  is_graded BOOLEAN DEFAULT FALSE,
  purchase_price DECIMAL,
  purchase_date DATE,
  notes TEXT,
  for_sale BOOLEAN DEFAULT FALSE,
  asking_price DECIMAL,
  average_price DECIMAL,
  date_added TIMESTAMPTZ DEFAULT NOW(),
  is_starred BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comics_user_id ON comics(user_id);
CREATE INDEX idx_comics_for_sale ON comics(for_sale) WHERE for_sale = TRUE;

-- Comic-List junction table (many-to-many)
CREATE TABLE comic_lists (
  comic_id UUID REFERENCES comics(id) ON DELETE CASCADE,
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comic_id, list_id)
);

-- Sales records
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Comic snapshot at time of sale
  comic_title TEXT,
  comic_issue_number TEXT,
  comic_variant TEXT,
  comic_publisher TEXT,
  cover_image_url TEXT,

  -- Sale details
  purchase_price DECIMAL,
  sale_price DECIMAL NOT NULL,
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  profit DECIMAL,
  buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_sale_date ON sales(sale_date);

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE comics ENABLE ROW LEVEL SECURITY;
ALTER TABLE comic_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Lists: Users can only manage their own lists
CREATE POLICY "Users can view own lists" ON lists
  FOR SELECT USING (user_id IN (
    SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

CREATE POLICY "Users can insert own lists" ON lists
  FOR INSERT WITH CHECK (user_id IN (
    SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

CREATE POLICY "Users can update own lists" ON lists
  FOR UPDATE USING (user_id IN (
    SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

CREATE POLICY "Users can delete own lists" ON lists
  FOR DELETE USING (user_id IN (
    SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- Comics: Users can view their own + for-sale comics from others
CREATE POLICY "Users can view own comics" ON comics
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
    OR for_sale = TRUE
  );

CREATE POLICY "Users can insert own comics" ON comics
  FOR INSERT WITH CHECK (user_id IN (
    SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

CREATE POLICY "Users can update own comics" ON comics
  FOR UPDATE USING (user_id IN (
    SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

CREATE POLICY "Users can delete own comics" ON comics
  FOR DELETE USING (user_id IN (
    SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- Comic Lists: Users can manage their own comic-list associations
CREATE POLICY "Users can view own comic_lists" ON comic_lists
  FOR SELECT USING (comic_id IN (
    SELECT id FROM comics WHERE user_id IN (
      SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  ));

CREATE POLICY "Users can insert own comic_lists" ON comic_lists
  FOR INSERT WITH CHECK (comic_id IN (
    SELECT id FROM comics WHERE user_id IN (
      SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  ));

CREATE POLICY "Users can delete own comic_lists" ON comic_lists
  FOR DELETE USING (comic_id IN (
    SELECT id FROM comics WHERE user_id IN (
      SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  ));

-- Sales: Users can view/manage their own sales
CREATE POLICY "Users can view own sales" ON sales
  FOR SELECT USING (user_id IN (
    SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

CREATE POLICY "Users can insert own sales" ON sales
  FOR INSERT WITH CHECK (user_id IN (
    SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comics_updated_at
  BEFORE UPDATE ON comics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create default lists for new users
CREATE OR REPLACE FUNCTION create_default_lists()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO lists (user_id, name, description, is_default) VALUES
    (NEW.id, 'My Collection', 'All comics in your collection', TRUE),
    (NEW.id, 'Want List', 'Comics you want to acquire', TRUE),
    (NEW.id, 'For Sale', 'Comics you''re selling', TRUE);
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to create default lists when a new profile is created
CREATE TRIGGER create_default_lists_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_lists();

-- Barcode catalog table (community-submitted barcode mappings)
CREATE TABLE barcode_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX idx_barcode_catalog_comic_id ON barcode_catalog(comic_id);
CREATE INDEX idx_barcode_catalog_raw_barcode ON barcode_catalog(raw_barcode);
CREATE INDEX idx_barcode_catalog_series ON barcode_catalog(upc_prefix, item_number);
CREATE INDEX idx_barcode_catalog_status ON barcode_catalog(status);

-- Enable RLS on barcode_catalog
ALTER TABLE barcode_catalog ENABLE ROW LEVEL SECURITY;

-- Barcode catalog policies
CREATE POLICY "Users can view own submitted barcodes" ON barcode_catalog
  FOR SELECT USING (submitted_by IN (
    SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

CREATE POLICY "Admins can view all barcodes" ON barcode_catalog
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
      AND is_admin = TRUE
    )
  );

CREATE POLICY "Service role can insert barcodes" ON barcode_catalog
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update barcodes" ON barcode_catalog
  FOR UPDATE USING (auth.role() = 'service_role');

-- ============================================
-- Admin Barcode Reviews (low-confidence alert queue)
-- ============================================

CREATE TABLE admin_barcode_reviews (
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

-- Indexes for admin_barcode_reviews
CREATE INDEX idx_barcode_reviews_catalog_id ON admin_barcode_reviews(barcode_catalog_id);
CREATE INDEX idx_barcode_reviews_status ON admin_barcode_reviews(status);
CREATE INDEX idx_barcode_reviews_created_at ON admin_barcode_reviews(created_at DESC);

-- Enable RLS on admin_barcode_reviews
ALTER TABLE admin_barcode_reviews ENABLE ROW LEVEL SECURITY;

-- Admin barcode review policies
CREATE POLICY "Admins can view barcode reviews" ON admin_barcode_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
      AND is_admin = TRUE
    )
  );

CREATE POLICY "Admins can update barcode reviews" ON admin_barcode_reviews
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
      AND is_admin = TRUE
    )
  );

CREATE POLICY "Service role can insert barcode reviews" ON admin_barcode_reviews
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access to barcode reviews" ON admin_barcode_reviews
  FOR ALL USING (auth.role() = 'service_role');
