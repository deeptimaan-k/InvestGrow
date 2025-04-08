/*
  # Profile and KYC System

  1. Tables
    - bank_details (user bank account information)
    - identity_proofs (KYC documents like PAN and Aadhar)
    - kyc_verifications (KYC verification status and history)

  2. Features
    - Secure bank details storage
    - Document verification workflow
    - KYC status tracking
    - Admin verification system

  3. Security
    - Row Level Security (RLS)
    - Proper permission handling
    - Secure document storage
*/

-- Begin transaction
BEGIN;

-- Create tables
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

CREATE TABLE kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES profiles(id),
  verification_date TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Add KYC status to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending' 
CHECK (kyc_status IN ('pending', 'verified', 'rejected'));

-- Create indexes
CREATE INDEX idx_bank_details_user_id ON bank_details(user_id);
CREATE INDEX idx_identity_proofs_user_id ON identity_proofs(user_id);
CREATE INDEX idx_kyc_verifications_user_id ON kyc_verifications(user_id);
CREATE INDEX idx_identity_proofs_status ON identity_proofs(status);
CREATE INDEX idx_kyc_verifications_status ON kyc_verifications(status);

-- Enable Row Level Security
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;

-- Create storage bucket for KYC documents
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('kyc-documents', 'kyc-documents', false)
  ON CONFLICT (id) DO UPDATE
  SET public = false;
END $$;

-- Create Functions

-- Validate bank details
CREATE OR REPLACE FUNCTION validate_bank_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate IFSC code format
  IF NOT (NEW.ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
    RAISE EXCEPTION 'Invalid IFSC code format';
  END IF;

  -- Set user_id to authenticated user on insert
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
  END IF;

  -- Update timestamp
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

-- Validate identity proof
CREATE OR REPLACE FUNCTION validate_identity_proof()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set user_id to authenticated user on insert
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
  END IF;

  -- Validate document numbers
  CASE NEW.document_type
    WHEN 'pan_card' THEN
      IF NOT (NEW.document_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$') THEN
        RAISE EXCEPTION 'Invalid PAN card number format';
      END IF;
    WHEN 'aadhar_card' THEN
      IF NOT (NEW.document_number ~ '^\d{12}$') THEN
        RAISE EXCEPTION 'Invalid Aadhar card number format';
      END IF;
  END CASE;

  -- Update timestamp
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

-- Update KYC status
CREATE OR REPLACE FUNCTION update_kyc_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update profile KYC status when all documents are verified
  IF EXISTS (
    SELECT 1 FROM identity_proofs
    WHERE user_id = NEW.user_id
    AND status = 'verified'
    GROUP BY user_id
    HAVING count(*) = 2  -- Both PAN and Aadhar are verified
  ) THEN
    UPDATE profiles
    SET 
      kyc_status = 'verified',
      updated_at = now()
    WHERE id = NEW.user_id;

    -- Create or update KYC verification record
    INSERT INTO kyc_verifications (
      user_id,
      status,
      verified_by,
      verification_date
    ) VALUES (
      NEW.user_id,
      'verified',
      auth.uid(),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      status = 'verified',
      verified_by = auth.uid(),
      verification_date = now(),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Create Triggers
CREATE TRIGGER validate_bank_details_trigger
  BEFORE INSERT OR UPDATE ON bank_details
  FOR EACH ROW
  EXECUTE FUNCTION validate_bank_details();

CREATE TRIGGER validate_identity_proof_trigger
  BEFORE INSERT OR UPDATE ON identity_proofs
  FOR EACH ROW
  EXECUTE FUNCTION validate_identity_proof();

CREATE TRIGGER update_kyc_status_trigger
  AFTER UPDATE OF status ON identity_proofs
  FOR EACH ROW
  WHEN (NEW.status = 'verified')
  EXECUTE FUNCTION update_kyc_status();

-- Create Policies

-- Bank Details Policies
CREATE POLICY "Users can view own bank details"
  ON bank_details FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank details"
  ON bank_details FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM bank_details
      WHERE user_id = auth.uid()
      AND verified = true
    )
  );

CREATE POLICY "Users can update unverified bank details"
  ON bank_details FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND verified = false
  );

-- Identity Proofs Policies
CREATE POLICY "Users can view own identity proofs"
  ON identity_proofs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own identity proofs"
  ON identity_proofs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM identity_proofs
      WHERE user_id = auth.uid()
      AND document_type = identity_proofs.document_type
      AND status = 'verified'
    )
  );

CREATE POLICY "Users can update pending identity proofs"
  ON identity_proofs FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- KYC Verifications Policies
CREATE POLICY "Users can view own KYC verification"
  ON kyc_verifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Storage Policies
CREATE POLICY "Users can upload KYC documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = 'kyc-documents'
  );

CREATE POLICY "Users can view own KYC documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (
      EXISTS (
        SELECT 1 FROM identity_proofs
        WHERE file_path = name
        AND user_id = auth.uid()
      )
      OR auth.jwt()->>'role' = 'admin'
    )
  );

-- Admin Policies
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

CREATE POLICY "Admins can manage all KYC verifications"
  ON kyc_verifications FOR ALL
  TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

-- Grant necessary permissions
GRANT ALL ON TABLE bank_details TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE identity_proofs TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE kyc_verifications TO postgres, anon, authenticated, service_role;

COMMIT;