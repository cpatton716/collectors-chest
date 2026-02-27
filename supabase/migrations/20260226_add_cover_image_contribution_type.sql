-- Add 'cover_image' to the community_contributions contribution_type CHECK constraint
-- This allows awarding Creator Credits when a community cover submission is approved

ALTER TABLE community_contributions
  DROP CONSTRAINT IF EXISTS community_contributions_contribution_type_check;

ALTER TABLE community_contributions
  ADD CONSTRAINT community_contributions_contribution_type_check
  CHECK (contribution_type IN ('key_info', 'cover_image'));
