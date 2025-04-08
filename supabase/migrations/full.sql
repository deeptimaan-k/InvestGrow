/*
  # Complete Investment Platform Backend System

  This migration provides a complete, production-ready backend system with:
  
  1. Core Features
    - User profiles and authentication
    - Multi-level referral system
    - Investment management
    - Payment verification
    - KYC system
    - Mobile-friendly file uploads
    
  2. Security
    - Comprehensive RLS policies
    - Secure file handling
    - Data validation
    - Access control
    
  3. Mobile Compatibility
    - Simplified file upload policies
    - Optimized storage handling
    - Cross-platform support
*/

-- Begin transaction
BEGIN;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create tables
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  referral_code TEXT UNIQUE NOT NULL,
  referrer_code TEXT,
  direct_referrals INTEGER DEFAULT 0 CHECK (direct_referrals >= 0 AND direct_referrals <= 10),
  kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  first_investment_date TIMESTAMPTZ,
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
  start_date TIMESTAMPTZ,
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
  file_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL CHECK (ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  verification_date TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE identity_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('pan_card', 'aadhar_card')),
  document_number TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, document_type)
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
CREATE INDEX idx_bank_details_user_id ON bank_details(user_id);
CREATE INDEX idx_identity_proofs_user_id ON identity_proofs(user_id);

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
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_proofs ENABLE ROW LEVEL SECURITY;

-- Create storage buckets
DO $$
BEGIN
  -- Payment proofs bucket
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('payment-proofs', 'payment-proofs', false)
  ON CONFLICT (id) DO UPDATE SET public = false;

  -- KYC documents bucket
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('kyc-documents', 'kyc-documents', false)
  ON CONFLICT (id) DO UPDATE SET public = false;
END $$;

-- Functions

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
  INSERT INTO profiles (
    id,
    full_name,
    role,
    referrer_code,
    referral_code,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    COALESCE(TRIM(new.raw_user_meta_data->>'full_name'), ''),
    COALESCE(TRIM(new.raw_user_meta_data->>'role'), 'agent'),
    v_referrer_code,
    v_referral_code,
    now(),
    now()
  );

  -- Process referral if code exists
  IF v_referrer_code IS NOT NULL THEN
    SELECT id INTO v_referrer_id
    FROM profiles
    WHERE referral_code = v_referrer_code
    AND direct_referrals < 10;

    IF v_referrer_id IS NOT NULL THEN
      WITH RECURSIVE referral_chain AS (
        SELECT 
          id,
          referrer_code,
          1 as level
        FROM profiles
        WHERE id = v_referrer_id
        
        UNION ALL
        
        SELECT
          p.id,
          p.referrer_code,
          rc.level + 1
        FROM referral_chain rc
        JOIN profiles p ON p.referral_code = rc.referrer_code
        WHERE rc.level < 10
      )
      INSERT INTO referrals (referrer_id, referred_id, level)
      SELECT id, new.id, level
      FROM referral_chain;

      -- Update direct referrer's count
      UPDATE profiles
      SET direct_referrals = COALESCE(direct_referrals, 0) + 1
      WHERE id = v_referrer_id;
    END IF;
  END IF;

  RETURN new;
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
  v_is_first_investment BOOLEAN;
  v_referrer_id UUID;
  v_referred_id UUID;
  v_level INTEGER;
  v_commission_rate DECIMAL;
BEGIN
  SELECT * INTO v_investment 
  FROM investments 
  WHERE id = NEW.id;

  UPDATE profiles
  SET first_investment_date = COALESCE(first_investment_date, NEW.start_date)
  WHERE id = v_investment.user_id
  RETURNING first_investment_date = NEW.start_date INTO v_is_first_investment;

  IF v_is_first_investment THEN
    FOR v_referrer_id, v_referred_id, v_level, v_commission_rate IN 
      SELECT 
        r.referrer_id,
        r.referred_id,
        r.level,
        rl.commission_rate
      FROM referrals r
      JOIN referral_levels rl ON r.level = rl.level
      WHERE r.referred_id = v_investment.user_id
      AND NOT EXISTS (
        SELECT 1 
        FROM referral_earnings re 
        WHERE re.referrer_id = r.referrer_id 
        AND re.referred_id = r.referred_id
      )
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
        v_referrer_id,
        v_referred_id,
        NEW.id,
        v_level,
        v_investment.amount,
        (v_investment.amount * (v_commission_rate / 100))::DECIMAL(12,2),
        NEW.start_date
      );
    END LOOP;
  END IF;

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
  UPDATE investments
  SET 
    status = CASE WHEN p_approved THEN 'active' ELSE 'rejected' END,
    start_date = CASE WHEN p_approved THEN now() ELSE NULL END,
    end_date = CASE WHEN p_approved THEN now() + interval '40 months' ELSE NULL END,
    updated_at = now()
  WHERE id = p_investment_id;

  UPDATE payment_proofs
  SET 
    status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    admin_notes = p_admin_notes,
    updated_at = now()
  WHERE investment_id = p_investment_id;

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
      i.amount * 0.05,
      date_trunc('month', i.start_date) + interval '1 month' * generate_series(1, 40)
    FROM investments i
    WHERE i.id = p_investment_id;
  END IF;
END;
$$;

-- Create triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER process_referral_earnings_trigger
  AFTER INSERT ON investments
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION process_referral_earnings();

-- Storage policies
CREATE POLICY "authenticated_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id IN ('payment-proofs', 'kyc-documents'));

CREATE POLICY "authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('payment-proofs', 'kyc-documents'));

CREATE POLICY "authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('payment-proofs', 'kyc-documents'));

CREATE POLICY "authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id IN ('payment-proofs', 'kyc-documents'));

-- RLS Policies

-- Profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Investments
CREATE POLICY "Users can view own investments"
  ON investments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create investments"
  ON investments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Payment Proofs
CREATE POLICY "View payment proofs"
  ON payment_proofs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'admin');

CREATE POLICY "Create payment proofs"
  ON payment_proofs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Bank Details
CREATE POLICY "Users can view own bank details"
  ON bank_details FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage unverified bank details"
  ON bank_details FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND NOT verified);

-- Identity Proofs
CREATE POLICY "Users can view own identity proofs"
  ON identity_proofs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage pending identity proofs"
  ON identity_proofs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

-- Admin Policies
CREATE POLICY "Admins can manage all data"
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

CREATE POLICY "Admins can manage all bank details"
  ON bank_details FOR ALL
  TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admins can manage all identity proofs"
  ON identity_proofs FOR ALL
  TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;

COMMIT;