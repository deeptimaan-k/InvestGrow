/*
  # Fix Referral System Implementation

  1. Changes
    - Add referrals table for tracking relationships
    - Add referral code generation function
    - Update profiles table with referral tracking
    - Add functions for referral processing
  
  2. Security
    - Maintain RLS protection
    - Validate referral relationships
*/

-- Drop existing function and policy if they exist
DROP FUNCTION IF EXISTS get_referral_tree(uuid) CASCADE;
DROP POLICY IF EXISTS "Users can view their referral tree" ON referrals;

-- Create referrals table if not exists
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  level int NOT NULL CHECK (level >= 1 AND level <= 10),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(referred_id)
);

-- Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing referral tree
CREATE POLICY "Users can view their referral tree"
ON referrals
FOR SELECT
TO authenticated
USING (
  auth.uid() = referrer_id 
  OR auth.uid() = referred_id 
  OR auth.jwt()->>'role' = 'admin'
);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  chars text[] := '{A,B,C,D,E,F,G,H,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z,2,3,4,5,6,7,8,9}';
  result text := '';
  i integer := 0;
  code_exists boolean;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || chars[1+random()*(array_length(chars, 1)-1)];
    END LOOP;
    
    SELECT EXISTS (
      SELECT 1 FROM profiles WHERE referral_code = result
    ) INTO code_exists;
    
    IF NOT code_exists THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$;

-- Function to process referral
CREATE OR REPLACE FUNCTION process_referral(
  referrer_code text,
  new_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_id uuid;
  current_level int;
  current_referrer uuid;
  max_level int := 10;
BEGIN
  -- Get referrer's ID
  SELECT id INTO referrer_id
  FROM profiles
  WHERE referral_code = referrer_code;
  
  IF referrer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid referral code';
  END IF;
  
  -- Create direct (level 1) referral
  INSERT INTO referrals (referrer_id, referred_id, level)
  VALUES (referrer_id, new_user_id, 1);
  
  -- Process upper levels (2-10)
  current_level := 1;
  current_referrer := referrer_id;
  
  WHILE current_level < max_level LOOP
    -- Find next level referrer
    SELECT referrer_id INTO current_referrer
    FROM referrals
    WHERE referred_id = current_referrer
    AND status = 'active';
    
    -- Exit if no more referrers found
    IF current_referrer IS NULL THEN
      EXIT;
    END IF;
    
    -- Create next level referral
    current_level := current_level + 1;
    
    INSERT INTO referrals (referrer_id, referred_id, level)
    VALUES (current_referrer, new_user_id, current_level);
  END LOOP;
END;
$$;

-- Function to get referral tree
CREATE OR REPLACE FUNCTION get_referral_tree(p_user_id uuid)
RETURNS TABLE (
  referrer_id uuid,
  referred_id uuid,
  level int,
  referred_name text,
  investment_amount numeric,
  monthly_roi numeric,
  commission numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE tree AS (
    -- Get direct referrals
    SELECT 
      r.referrer_id,
      r.referred_id,
      r.level,
      p.full_name as referred_name,
      COALESCE(i.amount, 0) as investment_amount,
      COALESCE(i.amount * 0.05, 0) as monthly_roi,
      COALESCE(i.amount * 0.05 * rl.commission_rate / 100, 0) as commission,
      r.created_at
    FROM referrals r
    LEFT JOIN profiles p ON p.id = r.referred_id
    LEFT JOIN investments i ON i.user_id = r.referred_id AND i.status = 'active'
    LEFT JOIN referral_levels rl ON rl.level = r.level
    WHERE r.referrer_id = p_user_id
    AND r.status = 'active'
    
    UNION ALL
    
    -- Get indirect referrals
    SELECT 
      r.referrer_id,
      r.referred_id,
      r.level,
      p.full_name,
      COALESCE(i.amount, 0),
      COALESCE(i.amount * 0.05, 0),
      COALESCE(i.amount * 0.05 * rl.commission_rate / 100, 0),
      r.created_at
    FROM referrals r
    JOIN tree t ON r.referrer_id = t.referred_id
    LEFT JOIN profiles p ON p.id = r.referred_id
    LEFT JOIN investments i ON i.user_id = r.referred_id AND i.status = 'active'
    LEFT JOIN referral_levels rl ON rl.level = r.level
    WHERE r.status = 'active'
  )
  SELECT * FROM tree
  ORDER BY level, created_at;
END;
$$;
