DROP POLICY IF EXISTS "Users can upload own payment proofs" ON payment_proofs;

CREATE POLICY "Users can upload own payment proofs"
  ON payment_proofs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1
      FROM investments i
      WHERE i.id = investment_id
      AND i.user_id = auth.uid()
      AND i.status = 'pending_proof'
    )
  );
