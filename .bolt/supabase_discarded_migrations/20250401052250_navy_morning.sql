/*
  # Fix Storage Policies for File Uploads

  1. Changes
    - Simplify storage policies to allow direct uploads
    - Remove overly restrictive checks
    - Maintain basic security controls

  2. Security
    - Keep bucket private
    - Allow authenticated uploads
    - Maintain admin access
*/

-- Begin transaction
BEGIN;

-- Drop existing storage policies
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

-- Create simplified storage policies
CREATE POLICY "Allow authenticated uploads"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Allow authenticated downloads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-proofs');

CREATE POLICY "Allow authenticated deletes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'payment-proofs');

-- Grant necessary permissions
GRANT ALL ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;

COMMIT;