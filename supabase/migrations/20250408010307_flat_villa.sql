/*
  # Add test uploads storage bucket

  1. New Storage Bucket
    - test-uploads (private bucket for test file uploads)

  2. Security
    - Private bucket (not public)
    - Storage policies for authenticated users
*/

-- Create storage bucket for test uploads
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('test-uploads', 'test-uploads', false)
  ON CONFLICT (id) DO UPDATE
  SET public = false;
END $$;

-- Create storage policies
CREATE POLICY "Allow authenticated users to view test uploads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'test-uploads');

CREATE POLICY "Allow authenticated users to insert test uploads"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'test-uploads');

CREATE POLICY "Allow authenticated users to update test uploads"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'test-uploads');

CREATE POLICY "Allow authenticated users to delete test uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'test-uploads');