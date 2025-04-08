/*
  # Add upload source column to test uploads table

  1. Changes
    - Add upload_source column to test_uploads table to track where uploads come from
    - Add default value for better data consistency
    - Add index for efficient querying
*/

-- Add upload source column
ALTER TABLE test_uploads 
ADD COLUMN upload_source TEXT NOT NULL DEFAULT 'mobile_test';

-- Add index for upload source queries
CREATE INDEX idx_test_uploads_upload_source ON test_uploads(upload_source);