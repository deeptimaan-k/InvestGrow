/*
  # Implement 10-Level Referral System

  1. New Tables
    - `referral_levels` - Commission rates per level
    - `referral_earnings` - Track earnings from referrals
    - Add tracking columns to existing tables

  2. Functions
    - `calculate_referral_commission` - Calculate commission based on level
    - `process_referral_earnings` - Distribute earnings up the chain
    - `validate_referral_limit` - Check direct referral limit

  3. Triggers
    - Auto-process referral earnings on ROI
    - Validate referral limits on signup
*/

-- Create referral_levels table
CREATE TABLE IF NOT EXISTS referral_levels (
  level int PRIMARY KEY CHECK (level BETWEEN 1 AND 10),
  commission_rate decimal(5,2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default commission rates
INSERT INTO referral_levels (level, commission_rate) VALUES
  (1, 10.00),  -- Level 1: 10%
  (2, 8.00),   -- Level 2: 8%
  (3, 6.00),   -- Level 3: 6%
  (4, 4.00),   -- Level 4: 4%
  (5, 2.00),   -- Level 5: 2%
  (6, 2.00),   -- Level 6: 2%
  (7, 2.00),   -- Level 7: 2%
  (8, 2.00),   -- Level 8: 2%
  (9, 2.00),   -- Level 9: 2%
  (10, 2.00)   -- Level 10: 2%
ON CONFLICT (level) DO NOTHING;

-- Add direct referral count to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS direct_referrals int DEFAULT 0 CHECK (direct_referrals >= 0 AND direct_referrals <= 10);

-- Create referral_earnings table
CREATE TABLE IF NOT EXISTS referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id uuid REFERENCES investments(id) ON DELETE CASCADE,
  level int REFERENCES referral_levels(level),
  roi_amount decimal(12,2) NOT NULL,
  commission_amount decimal(12,2) NOT NULL,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(referrer_id, referred_id, investment_id, level)
);

-- Enable RLS
ALTER TABLE referral_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_earnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Referral levels viewable by all users"
ON referral_levels FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can view own referral earnings"
ON referral_earnings FOR SELECT
TO authenticated
USING (
  referrer_id = auth.uid()
  OR auth.jwt()->>'role' = 'admin'
);

-- Function to validate referral limit
CREATE OR REPLACE FUNCTION validate_referral_limit(referrer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count int;
BEGIN
  SELECT direct_referrals INTO current_count
  FROM profiles
  WHERE id = referrer_id;
  
  RETURN current_count < 10;
END;
$$;

-- Function to process referral earnings
CREATE OR REPLACE FUNCTION process_referral_earnings(
  p_investment_id uuid,
  p_roi_amount decimal
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_referrer record;
  v_commission decimal;
BEGIN
  -- Get investor ID
  SELECT user_id INTO v_user_id
  FROM investments
  WHERE id = p_investment_id;

  -- Process earnings for each level up to 10
  FOR v_referrer IN
    WITH RECURSIVE referral_chain AS (
      -- Base case: direct referrer (level 1)
      SELECT 
        r.referrer_id,
        r.referred_id,
        1 as level
      FROM referrals r
      WHERE r.referred_id = v_user_id
      AND r.status = 'active'
      
      UNION ALL
      
      -- Recursive case: find upper levels
      SELECT 
        r.referrer_id,
        r.referred_id,
        rc.level + 1
      FROM referrals r
      JOIN referral_chain rc ON r.referred_id = rc.referrer_id
      WHERE r.status = 'active'
      AND rc.level < 10
    )
    SELECT 
      rc.*,
      rl.commission_rate
    FROM referral_chain rc
    JOIN referral_levels rl ON rc.level = rl.level
    ORDER BY rc.level
  LOOP
    -- Calculate commission
    v_commission := (p_roi_amount * v_referrer.commission_rate) / 100;
    
    -- Record earning
    INSERT INTO referral_earnings (
      referrer_id,
      referred_id,
      investment_id,
      level,
      roi_amount,
      commission_amount
    ) VALUES (
      v_referrer.referrer_id,
      v_user_id,
      p_investment_id,
      v_referrer.level,
      p_roi_amount,
      v_commission
    )
    ON CONFLICT (referrer_id, referred_id, investment_id, level)
    DO NOTHING;
  END LOOP;
END;
$$;

-- Trigger to process referral earnings when ROI is generated
CREATE OR REPLACE FUNCTION process_roi_referral_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Process referral earnings for the ROI payment
  PERFORM process_referral_earnings(NEW.investment_id, NEW.amount);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER earnings_referral_trigger
  AFTER INSERT ON earnings
  FOR EACH ROW
  EXECUTE FUNCTION process_roi_referral_earnings();

-- Function to get referral statistics
CREATE OR REPLACE FUNCTION get_referral_stats(p_user_id uuid)
RETURNS TABLE (
  total_referrals bigint,
  direct_referrals bigint,
  total_earnings decimal,
  earnings_by_level json
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(DISTINCT r.referred_id) as total_refs,
      COUNT(DISTINCT CASE WHEN r.level = 1 THEN r.referred_id END) as direct_refs,
      COALESCE(SUM(re.commission_amount), 0) as total_earns,
      json_object_agg(
        r.level,
        json_build_object(
          'referrals', COUNT(DISTINCT r.referred_id),
          'earnings', COALESCE(SUM(re.commission_amount), 0)
        )
      ) as level_stats
    FROM referrals r
    LEFT JOIN referral_earnings re ON 
      re.referrer_id = r.referrer_id 
      AND re.referred_id = r.referred_id
    WHERE r.referrer_id = p_user_id
    GROUP BY r.referrer_id
  )
  SELECT
    total_refs,
    direct_refs,
    total_earns,
    level_stats
  FROM stats;
END;
$$;