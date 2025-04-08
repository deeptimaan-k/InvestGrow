/*
  # Complete Database Schema Fix

  This migration consolidates and fixes all database objects in the correct order:
  1. Tables (with proper constraints and defaults)
  2. Functions
  3. Triggers
  4. Indexes
  5. Policies
  6. Initial Data
*/

-- Clean up any existing objects to prevent conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS ensure_profile_referral_code ON profiles;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS generate_profile_referral_code();
DROP FUNCTION IF EXISTS generate_referral_code();
DROP FUNCTION IF EXISTS process_referral();
DROP FUNCTION IF EXISTS calculate_referral_commissions();

-- 1. Create Tables

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text DEFAULT 'agent',
  referral_code text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Investments table
CREATE TABLE IF NOT EXISTS investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Earnings table
CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid REFERENCES investments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  payout_date timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at timestamptz DEFAULT now()
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  level int NOT NULL CHECK (level BETWEEN 1 AND 10),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now()
);

-- Referral earnings table
CREATE TABLE IF NOT EXISTS referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id uuid REFERENCES investments(id) ON DELETE CASCADE,
  level int NOT NULL CHECK (level BETWEEN 1 AND 10),
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz DEFAULT now()
);

-- Commission configuration table
CREATE TABLE IF NOT EXISTS referral_commissions (
  level int PRIMARY KEY CHECK (level BETWEEN 1 AND 10),
  rate decimal(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create Functions

-- Generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text AS $$
DECLARE
  code text;
  exists_count int;
BEGIN
  LOOP
    -- Generate 8 character random code
    code := upper(substring(md5(random()::text) from 1 for 8));
    
    -- Check if code exists
    SELECT COUNT(*) INTO exists_count
    FROM profiles
    WHERE referral_code = code;
    
    EXIT WHEN exists_count = 0;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Process new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_referral_code text;
  referrer_code text;
BEGIN
  -- Generate new referral code
  new_referral_code := generate_referral_code();
  
  -- Get referrer code if provided
  referrer_code := new.raw_user_meta_data->>'referral_code';

  -- Create profile
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    referral_code,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'role', 'agent'),
    new_referral_code,
    now(),
    now()
  );

  -- Process referral if code provided
  IF referrer_code IS NOT NULL AND referrer_code != '' THEN
    PERFORM process_referral(referrer_code, new.id);
  END IF;

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process referral relationships
CREATE OR REPLACE FUNCTION process_referral(
  referrer_code text,
  new_user_id uuid
)
RETURNS void AS $$
DECLARE
  referrer_id uuid;
  current_id uuid;
  current_level int;
BEGIN
  -- Get referrer ID from code
  SELECT id INTO referrer_id
  FROM profiles
  WHERE referral_code = referrer_code;

  -- Validate referral
  IF referrer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid referral code';
  END IF;

  IF referrer_id = new_user_id THEN
    RAISE EXCEPTION 'Self-referral not allowed';
  END IF;

  -- Insert direct (level 1) referral
  INSERT INTO referrals (referrer_id, referred_id, level)
  VALUES (referrer_id, new_user_id, 1);

  -- Process upper levels (2-10)
  current_id := referrer_id;
  current_level := 2;

  WHILE current_level <= 10 LOOP
    -- Get next upline referrer
    SELECT referrer_id INTO current_id
    FROM referrals
    WHERE referred_id = current_id
    AND status = 'active';

    EXIT WHEN current_id IS NULL;

    -- Insert upper level referral
    INSERT INTO referrals (referrer_id, referred_id, level)
    VALUES (current_id, new_user_id, current_level);

    current_level := current_level + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Calculate and distribute referral commissions
CREATE OR REPLACE FUNCTION calculate_referral_commissions(
  investment_id uuid,
  roi_amount decimal
)
RETURNS void AS $$
DECLARE
  investor_id uuid;
  current_referrer record;
  commission_amount decimal;
BEGIN
  -- Get investor ID
  SELECT user_id INTO investor_id
  FROM investments
  WHERE id = investment_id;

  -- Process commissions for each level
  FOR current_referrer IN
    SELECT r.referrer_id, r.level, rc.rate
    FROM referrals r
    JOIN referral_commissions rc ON r.level = rc.level
    WHERE r.referred_id = investor_id
    AND r.status = 'active'
    ORDER BY r.level
  LOOP
    -- Calculate commission
    commission_amount := (roi_amount * current_referrer.rate) / 100;

    -- Insert commission earning
    INSERT INTO referral_earnings (
      referrer_id,
      referred_user_id,
      investment_id,
      level,
      amount
    ) VALUES (
      current_referrer.referrer_id,
      investor_id,
      investment_id,
      current_referrer.level,
      commission_amount
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Triggers

-- Create profile on user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Create Indexes

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_user_id ON earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_referrer_id ON referral_earnings(referrer_id);

-- 5. Enable RLS and Create Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
ON profiles FOR ALL
TO authenticated
USING (auth.jwt()->>'role' = 'admin');

-- Investments policies
CREATE POLICY "Users can read own investments"
ON investments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all investments"
ON investments FOR ALL
TO authenticated
USING (auth.jwt()->>'role' = 'admin');

-- Earnings policies
CREATE POLICY "Users can read own earnings"
ON earnings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all earnings"
ON earnings FOR ALL
TO authenticated
USING (auth.jwt()->>'role' = 'admin');

-- Referrals policies
CREATE POLICY "Users can view their referral tree"
ON referrals FOR SELECT
TO authenticated
USING (
  auth.uid() = referrer_id
  OR auth.uid() = referred_id
  OR auth.jwt()->>'role' = 'admin'
);

-- Referral earnings policies
CREATE POLICY "Users can read own referral earnings"
ON referral_earnings FOR SELECT
TO authenticated
USING (auth.uid() = referrer_id);

CREATE POLICY "Admins can manage all referral earnings"
ON referral_earnings FOR ALL
TO authenticated
USING (auth.jwt()->>'role' = 'admin');

-- Commission rates policies
CREATE POLICY "All users can view commission rates"
ON referral_commissions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can modify commission rates"
ON referral_commissions FOR ALL
TO authenticated
USING (auth.jwt()->>'role' = 'admin')
WITH CHECK (auth.jwt()->>'role' = 'admin');

-- 6. Insert Initial Data

-- Insert default commission rates if they don't exist
INSERT INTO referral_commissions (level, rate)
VALUES
  (1, 10.00),  -- Level 1: 10%
  (2, 5.00),   -- Level 2: 5%
  (3, 3.00),   -- Level 3: 3%
  (4, 1.00),   -- Level 4: 1%
  (5, 1.00),   -- Level 5: 1%
  (6, 1.00),   -- Level 6: 1%
  (7, 1.00),   -- Level 7: 1%
  (8, 1.00),   -- Level 8: 1%
  (9, 1.00),   -- Level 9: 1%
  (10, 1.00)   -- Level 10: 1%
ON CONFLICT (level) DO NOTHING;

-- Backfill missing referral codes
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN 
    SELECT id 
    FROM profiles 
    WHERE referral_code IS NULL
  LOOP
    UPDATE profiles 
    SET referral_code = generate_referral_code(),
        updated_at = now()
    WHERE id = profile_record.id;
  END LOOP;
END $$;