-- Add scan_path and barcode_extracted columns to scan_analytics
ALTER TABLE scan_analytics
  ADD COLUMN IF NOT EXISTS scan_path TEXT DEFAULT 'full-pipeline',
  ADD COLUMN IF NOT EXISTS barcode_extracted BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_scan_analytics_scan_path
  ON scan_analytics (scan_path);
