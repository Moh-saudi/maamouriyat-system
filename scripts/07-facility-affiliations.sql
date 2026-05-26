-- Central reference table for facility owning/affiliated entities.
-- The governorate is the geographic location; this table is the administrative owner/affiliation.

CREATE TABLE IF NOT EXISTS facility_affiliations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL UNIQUE,
  affiliation_type TEXT NOT NULL CHECK (affiliation_type IN ('directorate', 'central_entity', 'authority', 'other')),
  governorate_code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_affiliations_active
  ON facility_affiliations(is_active, affiliation_type, sort_order, name);

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS affiliation_id UUID REFERENCES facility_affiliations(id);

CREATE INDEX IF NOT EXISTS idx_facilities_affiliation
  ON facilities(affiliation_id);

INSERT INTO facility_affiliations (code, name, affiliation_type, governorate_code, sort_order)
VALUES
  ('DIR-CAI', 'مديرية الشؤون الصحية بالقاهرة', 'directorate', 'CAI', 10),
  ('DIR-GIZ', 'مديرية الشؤون الصحية بالجيزة', 'directorate', 'GIZ', 20),
  ('DIR-KAL', 'مديرية الشؤون الصحية بالقليوبية', 'directorate', 'KAL', 30),
  ('DIR-ALX', 'مديرية الشؤون الصحية بالإسكندرية', 'directorate', 'ALX', 40),
  ('DIR-BHR', 'مديرية الشؤون الصحية بالبحيرة', 'directorate', 'BHR', 50),
  ('DIR-MTR', 'مديرية الشؤون الصحية بمطروح', 'directorate', 'MTR', 60),
  ('DIR-DMT', 'مديرية الشؤون الصحية بدمياط', 'directorate', 'DMT', 70),
  ('DIR-DAK', 'مديرية الشؤون الصحية بالدقهلية', 'directorate', 'DAK', 80),
  ('DIR-KFS', 'مديرية الشؤون الصحية بكفر الشيخ', 'directorate', 'KFS', 90),
  ('DIR-GHB', 'مديرية الشؤون الصحية بالغربية', 'directorate', 'GHB', 100),
  ('DIR-MNF', 'مديرية الشؤون الصحية بالمنوفية', 'directorate', 'MNF', 110),
  ('DIR-SHR', 'مديرية الشؤون الصحية بالشرقية', 'directorate', 'SHR', 120),
  ('DIR-PTS', 'مديرية الشؤون الصحية ببورسعيد', 'directorate', 'PTS', 130),
  ('DIR-ISM', 'مديرية الشؤون الصحية بالإسماعيلية', 'directorate', 'ISM', 140),
  ('DIR-SUZ', 'مديرية الشؤون الصحية بالسويس', 'directorate', 'SUZ', 150),
  ('DIR-NSI', 'مديرية الشؤون الصحية بشمال سيناء', 'directorate', 'NSI', 160),
  ('DIR-SSI', 'مديرية الشؤون الصحية بجنوب سيناء', 'directorate', 'SSI', 170),
  ('DIR-BNS', 'مديرية الشؤون الصحية ببني سويف', 'directorate', 'BNS', 180),
  ('DIR-FYM', 'مديرية الشؤون الصحية بالفيوم', 'directorate', 'FYM', 190),
  ('DIR-MIN', 'مديرية الشؤون الصحية بالمنيا', 'directorate', 'MIN', 200),
  ('DIR-AST', 'مديرية الشؤون الصحية بأسيوط', 'directorate', 'AST', 210),
  ('DIR-SHG', 'مديرية الشؤون الصحية بسوهاج', 'directorate', 'SHG', 220),
  ('DIR-QNA', 'مديرية الشؤون الصحية بقنا', 'directorate', 'QNA', 230),
  ('DIR-LXR', 'مديرية الشؤون الصحية بالأقصر', 'directorate', 'LXR', 240),
  ('DIR-ASN', 'مديرية الشؤون الصحية بأسوان', 'directorate', 'ASN', 250),
  ('DIR-RS', 'مديرية الشؤون الصحية بالبحر الأحمر', 'directorate', 'RS', 260),
  ('DIR-WJD', 'مديرية الشؤون الصحية بالوادي الجديد', 'directorate', 'WJD', 270),
  ('MOHP-HQ', 'ديوان عام وزارة الصحة والسكان', 'central_entity', NULL, 300),
  ('MHS-SECRETARIAT', 'الأمانة العامة للصحة النفسية وعلاج الإدمان', 'central_entity', NULL, 310),
  ('SMC-SECRETARIAT', 'أمانة المراكز الطبية المتخصصة', 'central_entity', NULL, 320),
  ('HIO', 'الهيئة العامة للتأمين الصحي', 'authority', NULL, 330),
  ('UHIA', 'الهيئة العامة للرعاية الصحية', 'authority', NULL, 340),
  ('EAO', 'هيئة الإسعاف المصرية', 'authority', NULL, 350),
  ('CURATIVE-ORG', 'المؤسسة العلاجية', 'central_entity', NULL, 360)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  affiliation_type = EXCLUDED.affiliation_type,
  governorate_code = EXCLUDED.governorate_code,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

ALTER TABLE facility_affiliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facility_affiliations_select" ON facility_affiliations;
CREATE POLICY "facility_affiliations_select" ON facility_affiliations
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "facility_affiliations_insert" ON facility_affiliations;
CREATE POLICY "facility_affiliations_insert" ON facility_affiliations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND level <= 2
    )
  );

DROP POLICY IF EXISTS "facility_affiliations_update" ON facility_affiliations;
CREATE POLICY "facility_affiliations_update" ON facility_affiliations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND level <= 2
    )
  );
