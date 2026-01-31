-- ============================================================================
-- REPUTATION SYSTEM MIGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS transaction_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sale', 'auction', 'trade')),
  transaction_id UUID NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating_type TEXT NOT NULL CHECK (rating_type IN ('positive', 'negative')),
  comment TEXT,
  seller_response TEXT,
  seller_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_reviewer_transaction UNIQUE (reviewer_id, transaction_id, transaction_type)
);

CREATE INDEX IF NOT EXISTS idx_feedback_reviewee ON transaction_feedback(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reviewer ON transaction_feedback(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_transaction ON transaction_feedback(transaction_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON transaction_feedback(created_at DESC);

CREATE TABLE IF NOT EXISTS community_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contribution_type TEXT NOT NULL CHECK (contribution_type IN ('key_info')),
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contributions_user ON community_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_type ON community_contributions(contribution_type);

CREATE TABLE IF NOT EXISTS feedback_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sale', 'auction', 'trade')),
  transaction_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'seller')),
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  feedback_left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_reminder UNIQUE (transaction_id, transaction_type, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reminders_pending ON feedback_reminders(user_id) WHERE feedback_left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_due ON feedback_reminders(last_reminder_at, reminder_count) WHERE feedback_left_at IS NULL;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS community_contribution_count INTEGER DEFAULT 0;

ALTER TABLE transaction_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_select_policy" ON transaction_feedback FOR SELECT USING (TRUE);
CREATE POLICY "feedback_insert_policy" ON transaction_feedback FOR INSERT WITH CHECK (reviewer_id = public.current_profile_id());
CREATE POLICY "feedback_update_policy" ON transaction_feedback FOR UPDATE USING (reviewer_id = public.current_profile_id() OR reviewee_id = public.current_profile_id());

CREATE POLICY "contributions_select_policy" ON community_contributions FOR SELECT USING (TRUE);

CREATE POLICY "reminders_select_policy" ON feedback_reminders FOR SELECT USING (user_id = public.current_profile_id());

CREATE OR REPLACE FUNCTION update_contribution_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET community_contribution_count = community_contribution_count + 1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET community_contribution_count = GREATEST(community_contribution_count - 1, 0) WHERE id = OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_contribution_count ON community_contributions;
CREATE TRIGGER trigger_update_contribution_count
  AFTER INSERT OR DELETE ON community_contributions
  FOR EACH ROW EXECUTE FUNCTION update_contribution_count();

CREATE OR REPLACE FUNCTION update_feedback_ratings()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.rating_type = 'positive' THEN
      UPDATE profiles SET positive_ratings = positive_ratings + 1 WHERE id = NEW.reviewee_id;
    ELSE
      UPDATE profiles SET negative_ratings = negative_ratings + 1 WHERE id = NEW.reviewee_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.rating_type != NEW.rating_type THEN
    IF NEW.rating_type = 'positive' THEN
      UPDATE profiles SET positive_ratings = positive_ratings + 1, negative_ratings = GREATEST(negative_ratings - 1, 0) WHERE id = NEW.reviewee_id;
    ELSE
      UPDATE profiles SET positive_ratings = GREATEST(positive_ratings - 1, 0), negative_ratings = negative_ratings + 1 WHERE id = NEW.reviewee_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_feedback_ratings ON transaction_feedback;
CREATE TRIGGER trigger_update_feedback_ratings
  AFTER INSERT OR UPDATE ON transaction_feedback
  FOR EACH ROW EXECUTE FUNCTION update_feedback_ratings();
