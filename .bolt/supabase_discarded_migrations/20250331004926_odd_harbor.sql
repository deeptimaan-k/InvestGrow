ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referrer_code TEXT REFERENCES public.profiles(referral_code),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (referred_id)
);
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  payout_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  roi_amount DECIMAL(12,2) NOT NULL,
  commission_amount DECIMAL(12,2) NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referrer_id, referred_id, investment_id, level)
);
CREATE TABLE IF NOT EXISTS public.referral_levels (
  level INTEGER PRIMARY KEY CHECK (level BETWEEN 1 AND 10),
  commission_rate DECIMAL(5,2) NOT NULL CHECK (commission_rate BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default commission rates
INSERT INTO public.referral_levels (level, commission_rate) VALUES
  (1, 10.00),
  (2, 8.00),
  (3, 6.00),
  (4, 4.00),
  (5, 2.00),
  (6, 2.00),
  (7, 2.00),
  (8, 2.00),
  (9, 2.00),
  (10, 2.00)
ON CONFLICT (level) DO NOTHING;

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
  -- Get investment details
  SELECT * INTO v_investment FROM investments WHERE id = NEW.id;

  -- Process referral earnings up to 10 levels
  FOR v_referral IN 
    SELECT r.*, rl.commission_rate
    FROM referrals r
    JOIN referral_levels rl ON r.level = rl.level
    WHERE r.referred_id = v_investment.user_id
  LOOP
    -- Insert earnings for each referral level
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
      NEW.payout_date
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger: Process referral earnings when an investment is made
CREATE TRIGGER trigger_referral_earnings
AFTER INSERT ON investments
FOR EACH ROW
EXECUTE FUNCTION process_referral_earnings();

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


ALTER TABLE referral_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their referral tree"
ON referrals
FOR SELECT
TO authenticated
USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can view their own referral earnings"
ON referral_earnings
FOR SELECT
TO authenticated
USING (auth.uid() = referrer_id);

CREATE OR REPLACE FUNCTION ensure_referral_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_existing_count INTEGER;
  v_new_referral_code TEXT;
BEGIN
  -- Generate a unique referral code
  SELECT 'RF' || LEFT(md5(random()::TEXT), 8) INTO v_new_referral_code;

  -- If referrer_code is provided, find referrer's user ID
  IF NEW.referrer_code IS NOT NULL THEN
    SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = NEW.referrer_code;
    
    -- Ensure valid referrer exists
    IF v_referrer_id IS NULL THEN
      RAISE EXCEPTION 'Invalid referrer code!';
    END IF;

    -- Prevent duplicate referral entries
    SELECT COUNT(*) INTO v_existing_count 
    FROM referrals WHERE referred_id = NEW.id;

    IF v_existing_count = 0 THEN
      -- Insert into referrals table
      INSERT INTO referrals (referrer_id, referred_id, level, created_at)
      VALUES (v_referrer_id, NEW.id, 1, now());
    END IF;
  END IF;

  -- Assign unique referral code to new user
  NEW.referral_code = v_new_referral_code;

  RETURN NEW;
END;
$$;
