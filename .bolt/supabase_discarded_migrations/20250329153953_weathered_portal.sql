/*
  # Fix Profile Creation Trigger
  
  This migration fixes the profile creation trigger by:
  1. Adding better error handling
  2. Ensuring the trigger runs with proper permissions
  3. Adding logging for debugging
  4. Fixing the metadata access
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create improved handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_referral_code text;
  referrer_code text;
  meta_data json;
BEGIN
  -- Log the incoming data for debugging
  RAISE LOG 'New user data: id=%, metadata=%', new.id, new.raw_user_meta_data;

  -- Safely handle metadata
  meta_data := COALESCE(new.raw_user_meta_data, '{}'::json);
  
  -- Generate new referral code
  new_referral_code := generate_referral_code();
  
  -- Get referrer code if provided
  referrer_code := meta_data->>'referral_code';

  -- Create profile with explicit column list
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    referral_code,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    meta_data->>'full_name',
    COALESCE(meta_data->>'role', 'agent'),
    new_referral_code,
    now(),
    now()
  );

  -- Log successful profile creation
  RAISE LOG 'Profile created for user: id=%, referral_code=%', new.id, new_referral_code;

  -- Process referral if code provided
  IF referrer_code IS NOT NULL AND referrer_code != '' THEN
    BEGIN
      PERFORM process_referral(referrer_code, new.id);
      RAISE LOG 'Referral processed for user: id=%, referrer_code=%', new.id, referrer_code;
    EXCEPTION
      WHEN others THEN
        RAISE LOG 'Error processing referral: id=%, referrer_code=%, error=%', new.id, referrer_code, SQLERRM;
    END;
  END IF;

  RETURN new;
EXCEPTION
  WHEN others THEN
    -- Log the error details
    RAISE LOG 'Error in handle_new_user: id=%, error=%', new.id, SQLERRM;
    RETURN new;
END;
$$;

-- Recreate the trigger with proper timing
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

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