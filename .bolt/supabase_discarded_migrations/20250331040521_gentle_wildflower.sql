/*
  # Fix Referral Earnings Processing

  1. Changes
    - Fix variable declarations in process_referral_earnings function
    - Properly handle commission_rate field
    - Ensure correct record structure in FOR loop

  2. Features
    - Maintain first investment tracking
    - Prevent duplicate referral earnings
    - Process commission rates correctly

  3. Security
    - Maintain existing RLS policies
    - Ensure data consistency
*/

-- Add first_investment_date to profiles table if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_investment_date TIMESTAMPTZ;

-- Add a comment separately to avoid syntax errors
COMMENT ON COLUMN profiles.first_investment_date IS 'Date of user''s first active investment';

-- Create an index for quick lookups on first_investment_date if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_profiles_first_investment_date
ON profiles(first_investment_date);

-- Drop and recreate the process_referral_earnings function with proper variable handling
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
  -- Get the investment details
  SELECT * INTO v_investment 
  FROM investments 
  WHERE id = NEW.id;

  -- Check if this is the user's first investment and update first_investment_date if not set
  UPDATE profiles
  SET first_investment_date = COALESCE(first_investment_date, NEW.start_date)
  WHERE id = v_investment.user_id
  RETURNING first_investment_date = NEW.start_date INTO v_is_first_investment;

  -- Only process referral earnings if this is the user's first investment
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
      -- Ensure no existing earnings for this referrer-referred pair
      AND NOT EXISTS (
        SELECT 1 
        FROM referral_earnings re 
        WHERE re.referrer_id = r.referrer_id 
        AND re.referred_id = r.referred_id
      )
    LOOP
      -- Insert referral earnings with explicit field references
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_process_referral_earnings ON investments;

-- Create trigger to run process_referral_earnings function on investment activation
CREATE TRIGGER trg_process_referral_earnings
AFTER INSERT ON investments
FOR EACH ROW
EXECUTE FUNCTION process_referral_earnings();