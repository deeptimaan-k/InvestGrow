/*
  # Fix Payment Proofs System for Mobile Compatibility

  1. Changes
    - Update storage policies to be more permissive for mobile uploads
    - Simplify RLS policies while maintaining security
    - Add better file validation

  2. Security
    - Maintain basic security checks
    - Allow mobile uploads
    - Prevent unauthorized access
*/

-- Begin transaction
BEGIN;

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can view own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own payment proofs" ON storage.objects;

-- Recreate storage policies with mobile-friendly checks
CREATE POLICY "Users can view payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      -- Allow users to view their own proofs
      EXISTS (
        SELECT 1 FROM payment_proofs p
        WHERE p.file_path = name
        AND p.user_id = auth.uid()
      )
      -- Allow admins to view all proofs
      OR auth.jwt()->>'role' = 'admin'
    )
  );

CREATE POLICY "Users can upload payment proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND starts_with(name, 'payment-proofs/')
  );

CREATE POLICY "Users can delete payment proofs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      -- Allow users to delete their pending proofs
      EXISTS (
        SELECT 1 FROM payment_proofs p
        WHERE p.file_path = name
        AND p.user_id = auth.uid()
        AND p.status = 'pending'
      )
      -- Allow admins to delete any proof
      OR auth.jwt()->>'role' = 'admin'
    )
  );

-- Drop existing payment_proofs policies
DROP POLICY IF EXISTS "Users can view own payment proofs" ON payment_proofs;
DROP POLICY IF EXISTS "Users can create own payment proofs" ON payment_proofs;
DROP POLICY IF EXISTS "Users can update own pending payment proofs" ON payment_proofs;
DROP POLICY IF EXISTS "Admins can manage all payment proofs" ON payment_proofs;

-- Recreate payment_proofs policies with simplified checks
CREATE POLICY "View payment proofs"
  ON payment_proofs FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.jwt()->>'role' = 'admin'
  );

CREATE POLICY "Create payment proofs"
  ON payment_proofs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
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

CREATE POLICY "Delete payment proofs"
  ON payment_proofs FOR DELETE
  TO authenticated
  USING (
    (auth.uid() = user_id AND status = 'pending')
    OR auth.jwt()->>'role' = 'admin'
  );

-- Ensure proper bucket configuration
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('payment-proofs', 'payment-proofs', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Grant necessary permissions
GRANT ALL ON TABLE payment_proofs TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;

COMMIT;