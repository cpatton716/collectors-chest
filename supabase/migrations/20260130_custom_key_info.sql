-- =============================================
-- Custom Key Info with Approval Flow
-- Separates user-added key info from approved database key info
-- =============================================

-- Add custom_key_info column to comics table
-- This stores user-added key info that only the owner can see until approved
ALTER TABLE comics
ADD COLUMN IF NOT EXISTS custom_key_info TEXT[] DEFAULT '{}';

-- Add custom_key_info_status to track approval status per-comic
-- NULL = no custom key info
-- 'pending' = awaiting admin review
-- 'approved' = approved and merged into key_info
-- 'rejected' = rejected by admin
ALTER TABLE comics
ADD COLUMN IF NOT EXISTS custom_key_info_status TEXT
CHECK (custom_key_info_status IS NULL OR custom_key_info_status IN ('pending', 'approved', 'rejected'));

-- Index for finding comics with pending custom key info (for admin moderation)
CREATE INDEX IF NOT EXISTS idx_comics_custom_key_info_pending
ON comics(custom_key_info_status)
WHERE custom_key_info_status = 'pending';
