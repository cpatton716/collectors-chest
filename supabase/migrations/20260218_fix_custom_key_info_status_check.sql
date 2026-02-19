-- =============================================
-- Fix custom_key_info_status CHECK constraint
-- Add 'partially_approved' as a valid status value
-- Used when admin approves some items and rejects others
-- =============================================

-- Drop the existing inline CHECK constraint
-- Postgres names inline CHECK constraints as: {table}_{column}_check
ALTER TABLE comics
DROP CONSTRAINT IF EXISTS comics_custom_key_info_status_check;

-- Re-add with 'partially_approved' included
ALTER TABLE comics
ADD CONSTRAINT comics_custom_key_info_status_check
CHECK (custom_key_info_status IS NULL OR custom_key_info_status IN ('pending', 'approved', 'rejected', 'partially_approved'));
