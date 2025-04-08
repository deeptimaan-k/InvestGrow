/*
  # Complete Payment Proof System

  1. Tables
    - payment_proofs (stores proof metadata and status)

  2. Features
    - File upload tracking
    - Admin approval workflow
    - Secure file storage

  3. Security
    - Row Level Security (RLS)
    - Storage policies
    - Permission handling
*/

-- Begin transaction
BEGIN;

-- Recreate payment_proofs table
DROP TABLE IF EXISTS payment_proofs CASCADE;
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

-- Create RLS policies
CREATE POLICY "Users can view own payment proofs"
  ON payment_proofs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payment proofs"
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

CREATE POLICY "Users can update own pending payment proofs"
  ON payment_proofs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can manage all payment proofs"
  ON payment_proofs FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Storage bucket setup
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('payment-proofs', 'payment-proofs', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Storage policies
DROP POLICY IF EXISTS "Users can view own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own payment proofs" ON storage.objects;

CREATE POLICY "Users can view own payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      EXISTS (
        SELECT 1 FROM payment_proofs p
        WHERE p.file_path = name
        AND p.user_id = auth.uid()
      )
      OR auth.jwt()->>'role' = 'admin'
    )
  );

CREATE POLICY "Users can upload own payment proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND starts_with(name, 'payment-proofs/')
    AND (
      lower(right(name, 4)) IN ('.jpg', '.png', '.pdf')
      OR lower(right(name, 5)) = '.jpeg'
    )
  );

CREATE POLICY "Users can delete own payment proofs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      EXISTS (
        SELECT 1 FROM payment_proofs p
        WHERE p.file_path = name
        AND p.user_id = auth.uid()
        AND p.status = 'pending'
      )
      OR auth.jwt()->>'role' = 'admin'
    )
  );

-- Grant permissions
GRANT ALL ON TABLE payment_proofs TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;

COMMIT;