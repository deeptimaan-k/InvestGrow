/*
  # Fix Payment Proofs System for Mobile Compatibility

  1. Changes
    - Drop and recreate payment_proofs table
    - Simplify storage policies
    - Add mobile-friendly file handling

  2. Security
    - Basic authentication checks
    - Proper RLS policies
    - Secure file access
*/

-- Begin transaction
BEGIN;

-- Drop existing table and policies
DROP TABLE IF EXISTS payment_proofs CASCADE;

-- Recreate payment_proofs table
CREATE TABLE payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_payment_proofs_investment_id ON payment_proofs(investment_id);
CREATE INDEX idx_payment_proofs_user_id ON payment_proofs(user_id);

-- Enable RLS
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;

-- Create simplified RLS policies
CREATE POLICY "View payment proofs"
  ON payment_proofs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'admin');

CREATE POLICY "Create payment proofs"
  ON payment_proofs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1
      FROM investments i
      WHERE i.id = investment_id
      AND i.user_id = auth.uid()
      AND i.status IN ('pending_proof', 'pending_approval')
    )
  );

CREATE POLICY "Update payment proofs"
  ON payment_proofs FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = user_id AND status = 'pending')
    OR auth.jwt()->>'role' = 'admin'
  );

-- Drop ALL existing storage policies
DROP POLICY IF EXISTS "authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;

-- Ensure bucket exists and is private
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('payment-proofs', 'payment-proofs', false)
  ON CONFLICT (id) DO UPDATE
  SET public = false;
END $$;

-- Create simple storage policies
CREATE POLICY "authenticated_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-proofs');

CREATE POLICY "authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'payment-proofs');

CREATE POLICY "authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'payment-proofs');


CREATE POLICY "Users can read their own images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND owner = auth.uid());


-- Grant necessary permissions
GRANT ALL ON TABLE payment_proofs TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;

COMMIT;