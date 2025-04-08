/*
  # Fix Investment RLS Policies

  1. Drop existing policies
  2. Recreate policies with correct checks
  3. Remove incorrect use of OLD in WITH CHECK
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create own investments" ON investments;
DROP POLICY IF EXISTS "Users can view own investments" ON investments;
DROP POLICY IF EXISTS "Users can update own pending investments" ON investments;
DROP POLICY IF EXISTS "Admins can manage all investments" ON investments;

-- Ensure RLS is enabled
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- Allow users to create investments with correct status
CREATE POLICY "Users can create own investments"
  ON investments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND status = 'pending_proof'
  );

-- Allow users to view their own investments
CREATE POLICY "Users can view own investments"
  ON investments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to update only their own pending investments
CREATE POLICY "Users can update own pending investments"
  ON investments FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND status = 'pending_proof'
  )
  WITH CHECK (
    auth.uid() = user_id AND status IN ('pending_proof', 'pending_approval')
  );

-- Allow admins to manage all investments
CREATE POLICY "Admins can manage all investments"
  ON investments FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');
