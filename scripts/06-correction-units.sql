-- Central correction units managed by system admins.
CREATE TABLE IF NOT EXISTS correction_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correction_units_active ON correction_units(is_active, sort_order, name);

INSERT INTO correction_units (name, sort_order)
VALUES
  ('إدارة الصيدلة والمستلزمات', 10),
  ('إدارة صيانة الأجهزة الطبية', 20),
  ('إدارة صيانة التكييفات', 30),
  ('إدارة مكافحة العدوى', 40),
  ('إدارة الجودة', 50),
  ('إدارة السلامة والصحة المهنية', 60),
  ('إدارة التراخيص', 70),
  ('إدارة متابعة غياب الموظفين', 80),
  ('إدارة الشؤون القانونية', 90),
  ('إدارة الأمن والسلامة', 100),
  ('إدارة التغذية', 110),
  ('إدارة النفايات الطبية', 120)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE correction_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "correction_units_select" ON correction_units;
CREATE POLICY "correction_units_select" ON correction_units
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "correction_units_insert" ON correction_units;
CREATE POLICY "correction_units_insert" ON correction_units
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND level <= 2
    )
  );

DROP POLICY IF EXISTS "correction_units_update" ON correction_units;
CREATE POLICY "correction_units_update" ON correction_units
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND level <= 2
    )
  );
