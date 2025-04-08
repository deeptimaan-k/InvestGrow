/*
  # Fix Payment Proofs RLS Policies

  1. Changes
    - Drop existing payment proofs policies
    - Create new, properly scoped policies
    - Fix insert permissions for payment proofs

  2. Security
    - Maintain strict RLS enforcement
    - Allow users to create payment proofs for their own investments
    - Prevent unauthorized access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own payment proofs" ON payment_proofs;
DROP POLICY IF EXISTS "Users can upload own payment proofs" ON payment_proofs;
DROP POLICY IF EXISTS "Admins can manage all payment proofs" ON payment_proofs;

-- Recreate policies with proper checks
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