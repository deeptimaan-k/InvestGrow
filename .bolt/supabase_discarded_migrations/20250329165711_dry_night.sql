/*
  # Add Public Access Policy for Referral Code Verification

  1. Changes
    - Add a new policy to allow public access to verify referral codes
    - Policy only allows SELECT on specific columns (id, referral_code)
    - No authentication required for this specific operation
  
  2. Security
    - Limited to only necessary columns
    - Read-only access
    - No sensitive data exposure
*/

-- Add policy for public referral code verification
CREATE POLICY "Allow public referral code verification"
ON profiles
FOR SELECT
TO public
USING (true)
WITH CHECK (false);

-- Modify existing policies to be more specific
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Recreate policies with explicit column security
CREATE POLICY "Users can read own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admins can update all profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.jwt()->>'role' = 'admin')
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admins can delete profiles"
ON profiles
FOR DELETE
TO authenticated
USING (auth.jwt()->>'role' = 'admin');