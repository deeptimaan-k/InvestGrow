/*
  # KYC and Profile System
*/

BEGIN;

-- Enum types
CREATE TYPE document_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE document_type AS ENUM ('pan_card', 'aadhar_card');
CREATE TYPE kyc_status AS ENUM ('not_started', 'in_progress', 'verified', 'rejected');

-- Extend profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS kyc_status kyc_status DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kyc_rejected_reason TEXT,
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ;

-- bank_details table
CREATE TABLE IF NOT EXISTS bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- identity_proofs table
CREATE TABLE IF NOT EXISTS identity_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  document_number TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status document_status DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, document_type)
);

-- Enable RLS
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_proofs ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bank_details_user_id ON bank_details(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_proofs_user_id ON identity_proofs(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_proofs_status ON identity_proofs(status);

-- Policies: bank_details
CREATE POLICY "Users can view own bank details"
  ON bank_details FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank details"
  ON bank_details FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND NOT EXISTS (
      SELECT 1 FROM bank_details WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own bank details"
  ON bank_details FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND NOT verified);

-- Policies: identity_proofs
CREATE POLICY "Users can view own identity proofs"
  ON identity_proofs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own identity proofs"
  ON identity_proofs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND NOT EXISTS (
      SELECT 1 FROM identity_proofs AS ip
      WHERE ip.user_id = user_id AND ip.document_type = document_type
    )
  );

-- Admin access
CREATE POLICY "Admins can view all bank details"
  ON bank_details FOR SELECT TO authenticated
  USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admins can update bank details"
  ON bank_details FOR UPDATE TO authenticated
  USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admins can view all identity proofs"
  ON identity_proofs FOR SELECT TO authenticated
  USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admins can update identity proofs"
  ON identity_proofs FOR UPDATE TO authenticated
  USING (auth.jwt()->>'role' = 'admin');

-- Create KYC bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for KYC
CREATE POLICY "Users can upload own KYC documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = 'kyc-documents'
  );

CREATE POLICY "Users can view own KYC documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents' AND (
      auth.jwt()->>'role' = 'admin' OR
      EXISTS (
        SELECT 1 FROM identity_proofs
        WHERE file_path = name AND user_id = auth.uid()
      )
    )
  );

-- Profile completion function
CREATE OR REPLACE FUNCTION check_profile_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET 
    profile_completed = (
      COALESCE(full_name, '') != ''
      AND kyc_status = 'verified'
      AND EXISTS (
        SELECT 1 FROM bank_details
        WHERE user_id = NEW.id AND verified = true
      )
      AND EXISTS (
        SELECT 1 FROM identity_proofs
        WHERE user_id = NEW.id AND status = 'verified' AND document_type = 'pan_card'
      )
      AND EXISTS (
        SELECT 1 FROM identity_proofs
        WHERE user_id = NEW.id AND status = 'verified' AND document_type = 'aadhar_card'
      )
    ),
    profile_updated_at = CASE 
      WHEN profile_completed = false THEN NULL
      ELSE now()
    END
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Trigger for profile completion
DROP TRIGGER IF EXISTS check_profile_completion_trigger ON profiles;

CREATE TRIGGER check_profile_completion_trigger
  AFTER INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_profile_completion();

-- Permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

COMMIT;
