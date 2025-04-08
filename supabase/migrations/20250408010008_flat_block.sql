/*
  # Add test uploads table

  1. New Tables
    - test_uploads
      - id (uuid, primary key)
      - file_path (text, not null)
      - file_type (text, not null)
      - created_at (timestamp with timezone)
      - updated_at (timestamp with timezone)

  2. Security
    - Enable RLS on test_uploads table
    - Add policies for authenticated users to:
      - View all test uploads
      - Create new test uploads
*/

-- Create test uploads table
CREATE TABLE IF NOT EXISTS test_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE test_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view test uploads"
  ON test_uploads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create test uploads"
  ON test_uploads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON TABLE test_uploads TO postgres, anon, authenticated, service_role;