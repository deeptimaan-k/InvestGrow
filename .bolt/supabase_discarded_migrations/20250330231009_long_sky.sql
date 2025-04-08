/*
  # Fix Referral Code Generation

  1. Changes
    - Update handle_new_user function to generate referral code
    - Add index for faster referral code lookups
    - Add constraint to ensure referral code is unique
  
  2. Security
    - Maintain RLS protection
    - Ensure referral code uniqueness
*/

-- Add unique constraint and index for referral_code
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_referral_code_key,
ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);

-- Drop existing function
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Recreate handle_new_user function with referral code generation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_referral_code text;
  referrer_code text;
BEGIN
  -- Generate new unique referral code
  new_referral_code := generate_referral_code();
  
  -- Get referrer code from metadata if provided
  referrer_code := NULLIF(new.raw_user_meta_data->>'referral_code', '');

  -- Create profile
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    referral_code,
    direct_referrals,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'agent'),
    new_referral_code,
    0,
    now(),
    now()
  );

  -- Process referral if code provided
  IF referrer_code IS NOT NULL THEN
    BEGIN
      PERFORM process_referral(referrer_code, new.id);
    EXCEPTION
      WHEN others THEN
        -- Log error but don't stop profile creation
        RAISE LOG 'Error processing referral: id=%, referrer_code=%, error=%', 
          new.id, referrer_code, SQLERRM;
    END;
  END IF;

  -- Log successful profile creation
  RAISE LOG 'Profile created: id=%, referral_code=%', new.id, new_referral_code;
  
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user: id=%, error=%', new.id, SQLERRM;
    RETURN new;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Verify trigger is properly installed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    RAISE EXCEPTION 'Trigger was not created successfully';
  END IF;
END
$$;