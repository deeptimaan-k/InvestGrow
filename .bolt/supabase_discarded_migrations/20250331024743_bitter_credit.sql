/*
  # Complete Investment Platform Backend

  This migration contains the complete backend setup for the investment platform,
  including all tables, functions, triggers, and security policies.

  1. Tables
    - profiles (user profiles and referral info)
    - investments (user investments)
    - earnings (ROI payments)
    - referrals (referral relationships)
    - referral_levels (commission rates)
    - payment_proofs (investment verification)

  2. Features
    - Multi-level referral system (up to 10 levels)
    - Investment approval workflow
    - ROI calculation and distribution
    - Payment proof verification
    - Comprehensive security policies

  3. Security
    - Row Level Security (RLS) on all tables
    - Proper permission handling
    - Secure file storage policies
*/

-- Begin transaction
BEGIN;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create tables first
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  referral_code TEXT UNIQUE NOT NULL,
  referrer_code TEXT,
  direct_referrals INTEGER DEFAULT 0 CHECK (direct_referrals >= 0 AND direct_referrals <= 10),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  two_factor_pending BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMPTZ,
  login_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE referral_levels (
  level INTEGER PRIMARY KEY CHECK (level BETWEEN 1 AND 10),
  commission_rate DECIMAL(5,2) NOT NULL CHECK (commission_rate BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referred_id, level)
);

CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (
    status IN ('pending_proof', 'pending_approval', 'active', 'completed', 'rejected', 'cancelled')
  ),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payout_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  roi_amount DECIMAL(12,2) NOT NULL,
  commission_amount DECIMAL(12,2) NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referrer_id, referred_id, investment_id, level)
);

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
CREATE INDEX idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX idx_profiles_referrer_code ON profiles(referrer_code);
CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE INDEX idx_earnings_user_id ON earnings(user_id);
CREATE INDEX idx_earnings_investment_id ON earnings(investment_id);
CREATE INDEX idx_referral_earnings_referrer_id ON referral_earnings(referrer_id);
CREATE INDEX idx_payment_proofs_investment_id ON payment_proofs(investment_id);

-- Insert default commission rates
INSERT INTO referral_levels (level, commission_rate) VALUES
  (1, 10.00),  -- 10% for direct referrals
  (2, 8.00),   -- 8% for level 2
  (3, 6.00),   -- 6% for level 3
  (4, 4.00),   -- 4% for level 4
  (5, 2.00),   -- 2% for level 5
  (6, 2.00),   -- 2% for levels 6-10
  (7, 2.00),
  (8, 2.00),
  (9, 2.00),
  (10, 2.00);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_levels ENABLE ROW LEVEL SECURITY;

-- Create Functions

-- Generate unique referral code
CREATE OR REPLACE FUNCTION generate_unique_referral_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := 'RF' || UPPER(SUBSTRING(MD5(p_user_id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
    
    SELECT EXISTS (
      SELECT 1 FROM profiles WHERE referral_code = v_code
    ) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- Handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_code TEXT;
  v_referrer_id UUID;
  v_referral_code TEXT;
  v_current_referrer_id UUID;
  v_level INTEGER;
BEGIN
  -- Generate unique referral code
  v_referral_code := generate_unique_referral_code(new.id);

  -- Get referrer code from metadata
  v_referrer_code := NULLIF(TRIM(COALESCE(
    new.raw_user_meta_data->>'referrer_code',
    new.raw_user_meta_data->>'referral_code',
    ''
  )), '');

  -- Create profile
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    referrer_code,
    referral_code,
    direct_referrals,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    COALESCE(TRIM(new.raw_user_meta_data->>'full_name'), ''),
    COALESCE(TRIM(new.raw_user_meta_data->>'role'), 'agent'),
    v_referrer_code,
    v_referral_code,
    0,
    now(),
    now()
  );

  -- Process referral if code exists
  IF v_referrer_code IS NOT NULL THEN
    -- Find and validate referrer
    SELECT id INTO v_referrer_id
    FROM profiles
    WHERE referral_code = v_referrer_code
    AND direct_referrals < 10;

    IF v_referrer_id IS NOT NULL THEN
      -- Process referral chain
      WITH RECURSIVE referral_chain AS (
        -- Base case: direct referrer
        SELECT 
          id,
          referrer_code,
          1 as level
        FROM profiles
        WHERE id = v_referrer_id
        
        UNION ALL
        
        -- Recursive case: get upper level referrers
        SELECT
          p.id,
          p.referrer_code,
          rc.level + 1
        FROM referral_chain rc
        JOIN profiles p ON p.referral_code = rc.referrer_code
        WHERE rc.level < 10
      )
      INSERT INTO referrals (
        referrer_id,
        referred_id,
        level,
        created_at
      )
      SELECT 
        id,
        new.id,
        level,
        now()
      FROM referral_chain;

      -- Update direct referrer's count
      UPDATE profiles
      SET 
        direct_referrals = COALESCE(direct_referrals, 0) + 1,
        updated_at = now()
      WHERE id = v_referrer_id;
    END IF;
  END IF;

  RETURN new;
END;
$$;

-- Validate investment
CREATE OR REPLACE FUNCTION validate_investment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status != 'pending_proof' THEN
    RAISE EXCEPTION 'Status must be pending_proof on insert';
  END IF;

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  RETURN NEW;
END;
$$;

-- Process referral earnings
CREATE OR REPLACE FUNCTION process_referral_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_investment investments%ROWTYPE;
  v_referral referrals%ROWTYPE;
BEGIN
  SELECT * INTO v_investment FROM investments WHERE id = NEW.id;

  FOR v_referral IN 
    SELECT r.*, rl.commission_rate
    FROM referrals r
    JOIN referral_levels rl ON r.level = rl.level
    WHERE r.referred_id = v_investment.user_id
  LOOP
    INSERT INTO referral_earnings (
      referrer_id,
      referred_id,
      investment_id,
      level,
      roi_amount,
      commission_amount,
      earned_at
    ) VALUES (
      v_referral.referrer_id,
      v_referral.referred_id,
      NEW.id,
      v_referral.level,
      NEW.amount,
      (NEW.amount * (v_referral.commission_rate / 100))::DECIMAL(12,2),
      NEW.start_date
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Approve investment
CREATE OR REPLACE FUNCTION approve_investment(
  p_investment_id UUID,
  p_approved BOOLEAN,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update investment status
  UPDATE investments
  SET 
    status = CASE 
      WHEN p_approved THEN 'active'
      ELSE 'rejected'
    END,
    start_date = CASE 
      WHEN p_approved THEN now()
      ELSE NULL
    END,
    end_date = CASE 
      WHEN p_approved THEN now() + interval '40 months'
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_investment_id;

  -- Update payment proof status
  UPDATE payment_proofs
  SET 
    status = CASE 
      WHEN p_approved THEN 'approved'
      ELSE 'rejected'
    END,
    admin_notes = p_admin_notes,
    updated_at = now()
  WHERE investment_id = p_investment_id;

  -- If approved, create earnings records
  IF p_approved THEN
    INSERT INTO earnings (
      investment_id,
      user_id,
      amount,
      payout_date
    )
    SELECT 
      i.id,
      i.user_id,
      i.amount * 0.05,  -- 5% monthly ROI
      date_trunc('month', i.start_date) + interval '1 month' * generate_series(1, 40)
    FROM investments i
    WHERE i.id = p_investment_id;
  END IF;
END;
$$;

-- Get referral stats
CREATE OR REPLACE FUNCTION get_referral_stats(p_user_id UUID)
RETURNS TABLE (
  total_referrals INTEGER,
  direct_referrals INTEGER,
  total_earnings DECIMAL,
  earnings_by_level JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earnings_by_level JSONB;
BEGIN
  WITH level_stats AS (
    SELECT 
      r.level,
      COUNT(DISTINCT r.referred_id) as referral_count,
      COALESCE(SUM(re.commission_amount), 0) as level_earnings
    FROM referrals r
    LEFT JOIN referral_earnings re ON 
      re.referrer_id = r.referrer_id AND 
      re.referred_id = r.referred_id
    WHERE r.referrer_id = p_user_id
    GROUP BY r.level
  )
  SELECT 
    jsonb_object_agg(
      level,
      jsonb_build_object(
        'referrals', referral_count,
        'earnings', level_earnings
      )
    )
  INTO v_earnings_by_level
  FROM level_stats;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM referrals WHERE referrer_id = p_user_id)::INTEGER,
    (SELECT COUNT(*) FROM referrals WHERE referrer_id = p_user_id AND level = 1)::INTEGER,
    COALESCE((SELECT SUM(commission_amount) FROM referral_earnings WHERE referrer_id = p_user_id), 0),
    COALESCE(v_earnings_by_level, '{}'::JSONB);
END;
$$;

-- Get referral tree
CREATE OR REPLACE FUNCTION get_referral_tree(p_user_id UUID)
RETURNS TABLE (
  referrer_id UUID,
  referred_id UUID,
  level INTEGER,
  referred_name TEXT,
  investment_amount DECIMAL,
  monthly_roi DECIMAL,
  commission DECIMAL,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE referral_chain AS (
    SELECT 
      r.referrer_id,
      r.referred_id,
      r.level,
      p.full_name AS referred_name,
      i.amount AS investment_amount,
      COALESCE(i.amount * 0.05, 0) AS monthly_roi,
      COALESCE(i.amount * 0.05 * (rl.commission_rate / 100), 0) AS commission,
      r.created_at
    FROM referrals r
    JOIN profiles p ON p.id = r.referred_id
    LEFT JOIN investments i ON i.user_id = r.referred_id AND i.status = 'active'
    JOIN referral_levels rl ON rl.level = r.level
    WHERE r.referrer_id = p_user_id
  )
  SELECT * FROM referral_chain
  ORDER BY level, created_at;
END;
$$;

-- Create security policies

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow public referral code verification"
  ON profiles FOR SELECT
  TO public
  USING (true);

-- Referrals policies
CREATE POLICY "Users can view their referral tree"
  ON referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Investments policies
CREATE POLICY "Users can view own investments"
  ON investments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own investments"
  ON investments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending_proof'
    AND amount > 0
  );

CREATE POLICY "Users can update own pending investments"
  ON investments FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND status = 'pending_proof'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending_proof'
  );

-- Earnings policies
CREATE POLICY "Users can view own earnings"
  ON earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Referral earnings policies
CREATE POLICY "Users can view own referral earnings"
  ON referral_earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id);

-- Payment proofs policies
CREATE POLICY "Users can view own payment proofs"
  ON payment_proofs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upload own payment proofs"
  ON payment_proofs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Referral levels policies
CREATE POLICY "Anyone can view referral levels"
  ON referral_levels FOR SELECT
  TO authenticated
  USING (true);

-- Admin policies
CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admins can manage all investments"
  ON investments FOR ALL
  TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admins can manage all payment proofs"
  ON payment_proofs FOR ALL
  TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

-- Create triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER validate_investment_trigger
  BEFORE INSERT OR UPDATE ON investments
  FOR EACH ROW
  EXECUTE FUNCTION validate_investment();

CREATE TRIGGER process_referral_earnings_trigger
  AFTER INSERT ON investments
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION process_referral_earnings();

-- Create payment-proofs bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('payment-proofs', 'payment-proofs')
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can view own payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      EXISTS (
        SELECT 1 FROM payment_proofs p
        WHERE p.file_path = storage.objects.name
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
    AND position('payment-proofs/' in name) = 1
    AND coalesce((metadata->>'size')::int, 0) <= 5242880
    AND (
      lower(right(name, 4)) IN ('.jpg', '.png', '.pdf')
      OR lower(right(name, 5)) = '.jpeg'
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Commit transaction
COMMIT;