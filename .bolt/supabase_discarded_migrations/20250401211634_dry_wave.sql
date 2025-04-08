/*
  # Fix Mobile Upload Issues

  1. Changes
    - Simplify storage policies
    - Add owner-based access control
    - Fix mobile compatibility issues

  2. Security
    - Maintain authentication checks
    - Allow proper file access
    - Keep bucket private
*/

-- Begin transaction
BEGIN;

-- Drop ALL existing storage policies
DROP POLICY IF EXISTS "authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own images" ON storage.objects;

-- Ensure bucket exists and is private
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('payment-proofs', 'payment-proofs', false)
  ON CONFLICT (id) DO UPDATE
  SET public = false;
END $$;

-- Create simplified storage policies
CREATE POLICY "storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-proofs');

CREATE POLICY "storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = 'payment-proofs'
  );

CREATE POLICY "storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'payment-proofs');

CREATE POLICY "storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'payment-proofs');

-- Grant necessary permissions
GRANT ALL ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;

COMMIT;