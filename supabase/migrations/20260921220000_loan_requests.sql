-- Tabla para solicitudes de préstamos
CREATE TABLE IF NOT EXISTS loan_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  principal DECIMAL(10,2) NOT NULL CHECK (principal > 0),
  interest_rate DECIMAL(5,2) DEFAULT 20 CHECK (interest_rate >= 0),
  days INTEGER NOT NULL CHECK (days > 0),
  purpose TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_loan_requests_client_id ON loan_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_loan_requests_status ON loan_requests(status);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_loan_requests_updated_at ON loan_requests;
CREATE TRIGGER update_loan_requests_updated_at BEFORE UPDATE ON loan_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas de seguridad
DROP POLICY IF EXISTS "Users can insert loan_requests" ON loan_requests;
CREATE POLICY "Users can insert loan_requests" ON loan_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = client_id::text);

DROP POLICY IF EXISTS "Users can view own loan_requests" ON loan_requests;
CREATE POLICY "Users can view own loan_requests" ON loan_requests
  FOR SELECT TO authenticated
  USING (auth.uid()::text = client_id::text);

DROP POLICY IF EXISTS "Admins can view all loan_requests" ON loan_requests;
CREATE POLICY "Admins can view all loan_requests" ON loan_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update loan_requests" ON loan_requests;
CREATE POLICY "Admins can update loan_requests" ON loan_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
