-- Tabla para grupos de préstamos rotativos (SòL)
CREATE TABLE IF NOT EXISTS sol_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  months INTEGER NOT NULL CHECK (months > 0),
  monthly_amount DECIMAL(10,2) NOT NULL CHECK (monthly_amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para miembros de los grupos SòL
CREATE TABLE IF NOT EXISTS sol_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES sol_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  order_index INTEGER NOT NULL,
  hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para pagos de los grupos SòL
CREATE TABLE IF NOT EXISTS sol_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES sol_groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES sol_members(id) ON DELETE CASCADE,
  month_number INTEGER NOT NULL CHECK (month_number > 0),
  amount DECIMAL(10,2) DEFAULT 0,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_sol_members_group_id ON sol_members(group_id);
CREATE INDEX IF NOT EXISTS idx_sol_payments_group_id ON sol_payments(group_id);
CREATE INDEX IF NOT EXISTS idx_sol_payments_member_id ON sol_payments(member_id);
CREATE INDEX IF NOT EXISTS idx_sol_payments_month_number ON sol_payments(month_number);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Eliminar triggers si existen y recrearlos
DROP TRIGGER IF EXISTS update_sol_groups_updated_at ON sol_groups;
CREATE TRIGGER update_sol_groups_updated_at BEFORE UPDATE ON sol_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sol_members_updated_at ON sol_members;
CREATE TRIGGER update_sol_members_updated_at BEFORE UPDATE ON sol_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sol_payments_updated_at ON sol_payments;
CREATE TRIGGER update_sol_payments_updated_at BEFORE UPDATE ON sol_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Agregar campo hidden si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sol_members' AND column_name = 'hidden'
    ) THEN
        ALTER TABLE sol_members ADD COLUMN hidden BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Actualizar políticas para permitir upsert en sol_payments
DROP POLICY IF EXISTS "Users can insert sol_payments" ON sol_payments;
CREATE POLICY "Users can insert sol_payments" ON sol_payments
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update sol_payments" ON sol_payments;
CREATE POLICY "Users can update sol_payments" ON sol_payments
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Agregar políticas para eliminar en sol_groups
DROP POLICY IF EXISTS "Users can delete sol_groups" ON sol_groups;
CREATE POLICY "Users can delete sol_groups" ON sol_groups
  FOR DELETE TO authenticated
  USING (true);

-- Agregar políticas para eliminar en sol_members
DROP POLICY IF EXISTS "Users can delete sol_members" ON sol_members;
CREATE POLICY "Users can delete sol_members" ON sol_members
  FOR DELETE TO authenticated
  USING (true);

-- Agregar políticas para eliminar en sol_payments
DROP POLICY IF EXISTS "Users can delete sol_payments" ON sol_payments;
CREATE POLICY "Users can delete sol_payments" ON sol_payments
  FOR DELETE TO authenticated
  USING (true);