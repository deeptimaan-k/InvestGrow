/*
  # Update Referral Earnings System

  1. Changes
    - Modify process_referral_earnings function to only process first investment
    - Add first_investment_date to profiles table
    - Update constraints and indexes

  2. Features
    - Track user's first investment date
    - Prevent duplicate referral earnings
    - Maintain referral chain integrity

  3. Security
    - Maintain existing RLS policies
    - Ensure data consistency
*/

-- Add first_investment_date to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_investment_date TIMESTAMPTZ;

-- Add a comment separately to avoid syntax errors
COMMENT ON COLUMN profiles.first_investment_date IS 'Date of user''s first active investment';

-- Create an index for quick lookups on first_investment_date
CREATE INDEX IF NOT EXISTS idx_profiles_first_investment_date
ON profiles(first_investment_date);

-- Drop and recreate the process_referral_earnings function
CREATE OR REPLACE FUNCTION process_referral_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_investment investments%ROWTYPE;
  v_referral referrals%ROWTYPE;
  v_is_first_investment BOOLEAN;
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
    FOR v_referral IN 
      SELECT r.*, rl.commission_rate
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
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to run process_referral_earnings function on investment insert
DROP TRIGGER IF EXISTS trg_process_referral_earnings ON investments;

CREATE TRIGGER trg_process_referral_earnings
AFTER INSERT ON investments
FOR EACH ROW
EXECUTE FUNCTION process_referral_earnings();