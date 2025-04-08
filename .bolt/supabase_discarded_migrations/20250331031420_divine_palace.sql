/*
  # Fix Investment RLS Policies

  1. Changes
    - Drop existing investment policies
    - Create new, properly scoped policies for investments table
    - Ensure proper user_id validation on insert

  2. Security
    - Maintain strict RLS enforcement
    - Allow users to create their own investments
    - Prevent unauthorized access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create own investments" ON investments;
DROP POLICY IF EXISTS "Users can view own investments" ON investments;
DROP POLICY IF EXISTS "Users can update own pending investments" ON investments;
DROP POLICY IF EXISTS "Admins can manage all investments" ON investments;

-- Recreate policies with proper checks
CREATE POLICY "Users can create own investments"
  ON investments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    status = 'pending_proof' AND
    amount > 0
  );

CREATE POLICY "Users can view own investments"
  ON investments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own pending investments"
  ON investments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending_proof')
  WITH CHECK (auth.uid() = user_id AND status = 'pending_proof');

CREATE POLICY "Admins can manage all investments"
  ON investments FOR ALL
  TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');