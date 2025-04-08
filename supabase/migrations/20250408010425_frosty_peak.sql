/*
  # Add file size column to test uploads table

  1. Changes
    - Add file_size column to test_uploads table
    - Add check constraint to ensure positive file size
*/

-- Add file size column
ALTER TABLE test_uploads 
ADD COLUMN file_size BIGINT NOT NULL CHECK (file_size > 0);

-- Add index for file size queries
CREATE INDEX idx_test_uploads_file_size ON test_uploads(file_size);