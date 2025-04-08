/*
  # Fix Storage Bucket RLS Policies

  1. Changes
    - Drop existing storage policies
    - Create new, properly scoped policies for payment-proofs bucket
    - Fix file upload permissions

  2. Security
    - Maintain strict RLS enforcement
    - Allow users to upload payment proofs
    - Prevent unauthorized access
*/

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can view own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own payment proofs" ON storage.objects;

-- Create storage policies with proper checks
CREATE POLICY "Users can view own payment proofs"
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

CREATE POLICY "Users can upload own payment proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (
      -- Ensure file is in payment-proofs folder
      position('payment-proofs/' in name) = 1
      -- Check file size (5MB max)
      AND coalesce((metadata->>'size')::int, 0) <= 5242880
      -- Check file extension
      AND (
        lower(right(name, 4)) IN ('.jpg', '.png', '.pdf')
        OR lower(right(name, 5)) = '.jpeg'
      )
      -- Extract user ID from filename and verify it matches auth.uid()
      AND split_part(name, '_', 1) = 'payment-proofs/' || auth.uid()
    )
  );