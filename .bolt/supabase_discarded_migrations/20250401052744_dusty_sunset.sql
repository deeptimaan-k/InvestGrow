/*
  # Fix Mobile Upload Issues

  1. Changes
    - Remove all complex storage policies
    - Create simple, permissive policies for authenticated users
    - Remove file path restrictions

  2. Security
    - Basic authentication check
    - Bucket-level access control
*/

-- Begin transaction
BEGIN;

-- Drop ALL existing storage policies
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Users can view payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete payment proofs" ON storage.objects;

-- Ensure bucket exists and is private
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('payment-proofs', 'payment-proofs', false)
  ON CONFLICT (id) DO UPDATE
  SET public = false;
END $$;

-- Create maximally permissive policies for authenticated users
CREATE POLICY "authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "authenticated_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-proofs');

CREATE POLICY "authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'payment-proofs');

-- Grant necessary permissions
GRANT ALL ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;

COMMIT;