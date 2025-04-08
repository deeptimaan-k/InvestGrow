/*
  # Withdrawals System

  1. Tables
    - withdrawals
    - withdrawal_settings

  2. Features
    - Admin approval flow
    - Validation checks
    - RLS for secure user access
*/

-- Create withdrawal settings table
CREATE TABLE withdrawal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_withdrawal_amount DECIMAL(12,2) NOT NULL DEFAULT 1000,
  max_withdrawal_amount DECIMAL(12,2) NOT NULL DEFAULT 100000,
  processing_time_hours INTEGER NOT NULL DEFAULT 24,
  withdrawal_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  min_balance_required DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create withdrawals table
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  bank_details_id UUID NOT NULL REFERENCES bank_details(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')
  ),
  admin_notes TEXT,
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_created_at ON withdrawals(created_at);

-- Enable RLS
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_settings ENABLE ROW LEVEL SECURITY;

-- Default settings
INSERT INTO withdrawal_settings (
  min_withdrawal_amount,
  max_withdrawal_amount,
  processing_time_hours,
  withdrawal_fee_percent,
  min_balance_required
) VALUES (
  1000,
  100000,
  24,
  0,
  0
);

-- Function: Check withdrawal eligibility
CREATE OR REPLACE FUNCTION check_withdrawal_eligibility(
  p_user_id UUID,
  p_amount DECIMAL
)
RETURNS TABLE (
  eligible BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings withdrawal_settings%ROWTYPE;
  v_total_earnings DECIMAL;
  v_pending_withdrawals DECIMAL;
BEGIN
  SELECT * INTO v_settings FROM withdrawal_settings LIMIT 1;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_earnings
  FROM earnings
  WHERE user_id = p_user_id AND status = 'paid';

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdrawals
  FROM withdrawals
  WHERE user_id = p_user_id AND status IN ('pending', 'processing');

  IF p_amount < v_settings.min_withdrawal_amount THEN
    RETURN QUERY SELECT false, 'Amount is below minimum withdrawal limit';
    RETURN;
  END IF;

  IF p_amount > v_settings.max_withdrawal_amount THEN
    RETURN QUERY SELECT false, 'Amount exceeds maximum withdrawal limit';
    RETURN;
  END IF;

  IF (v_total_earnings - v_pending_withdrawals - p_amount) < v_settings.min_balance_required THEN
    RETURN QUERY SELECT false, 'Insufficient available balance';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'Withdrawal request eligible';
END;
$$;

-- Function: Process withdrawal (admin only)
CREATE OR REPLACE FUNCTION process_withdrawal(
  p_withdrawal_id UUID,
  p_status TEXT,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (auth.jwt()->>'role' = 'admin') THEN
    RAISE EXCEPTION 'Only admins can process withdrawals';
  END IF;

  UPDATE withdrawals
  SET 
    status = p_status,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    processed_by = auth.uid(),
    processed_at = CASE WHEN p_status IN ('completed', 'rejected') THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_withdrawal_id;
END;
$$;

-- RLS Policies: withdrawal_settings
CREATE POLICY "Anyone can view withdrawal settings"
  ON withdrawal_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify withdrawal settings"
  ON withdrawal_settings FOR ALL
  TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

-- RLS Policies: withdrawals
CREATE POLICY "Users can view own withdrawals"
  ON withdrawals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create withdrawal requests"
  ON withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel pending withdrawals"
  ON withdrawals FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = user_id AND status = 'cancelled'
  );

CREATE POLICY "Admins can manage all withdrawals"
  ON withdrawals FOR ALL
  TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

-- Permissions
GRANT ALL ON TABLE withdrawals TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE withdrawal_settings TO postgres, anon, authenticated, service_role;
