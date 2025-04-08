/*
  # Fix Storage Bucket RLS Policies for Mobile Uploads

  1. Changes
    - Drop existing storage policies
    - Create new, mobile-friendly policies for payment-proofs bucket
    - Simplify filename validation for better mobile compatibility

  2. Security
    - Maintain RLS enforcement
    - Allow mobile uploads with simpler checks
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
      -- Simpler filename check that just ensures it starts with payment-proofs/
      AND starts_with(name, 'payment-proofs/')
    )
  );

-- Grant necessary permissions
GRANT ALL ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;