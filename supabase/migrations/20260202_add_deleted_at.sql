-- Add deleted_at column for soft delete support
ALTER TABLE comics
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_comics_deleted_at ON comics(deleted_at);

-- Comment explaining the soft delete pattern
COMMENT ON COLUMN comics.deleted_at IS 'Soft delete timestamp. Records with non-null value are considered deleted.';
