-- Phase 1: organizational structure, governorates, and mission destination model.
-- Idempotent migration: safe to run more than once.

CREATE TABLE IF NOT EXISTS organizational_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('sector', 'central_administration', 'general_administration', 'supervisory_unit')),
  parent_id UUID REFERENCES organizational_units(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 0 AND 4),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_units_parent ON organizational_units(parent_id);
CREATE INDEX IF NOT EXISTS idx_org_units_type ON organizational_units(unit_type);
CREATE INDEX IF NOT EXISTS idx_org_units_active ON organizational_units(is_active);

CREATE TABLE IF NOT EXISTS governorates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  region TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governorates_active ON governorates(is_active);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS org_unit_id UUID REFERENCES organizational_units(id),
  ADD COLUMN IF NOT EXISTS employee_code TEXT,
  ADD COLUMN IF NOT EXISTS mobile TEXT;

CREATE INDEX IF NOT EXISTS idx_users_org_unit ON users(org_unit_id);

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS governorate_id UUID REFERENCES governorates(id),
  ADD COLUMN IF NOT EXISTS org_unit_id UUID REFERENCES organizational_units(id),
  ADD COLUMN IF NOT EXISTS facility_code TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT;

CREATE INDEX IF NOT EXISTS idx_facilities_governorate ON facilities(governorate_id);
CREATE INDEX IF NOT EXISTS idx_facilities_org_unit ON facilities(org_unit_id);

ALTER TABLE missions
  ALTER COLUMN facility_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS org_unit_id UUID REFERENCES organizational_units(id),
  ADD COLUMN IF NOT EXISTS destination_type TEXT DEFAULT 'facility' CHECK (destination_type IN ('facility', 'governorate')),
  ADD COLUMN IF NOT EXISTS target_facility_id UUID REFERENCES facilities(id),
  ADD COLUMN IF NOT EXISTS target_governorate_id UUID REFERENCES governorates(id),
  ADD COLUMN IF NOT EXISTS visit_purpose TEXT,
  ADD COLUMN IF NOT EXISTS actual_facility_id UUID REFERENCES facilities(id),
  ADD COLUMN IF NOT EXISTS actual_governorate_id UUID REFERENCES governorates(id),
  ADD COLUMN IF NOT EXISTS destination_changed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS change_reason TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

UPDATE missions
SET target_facility_id = COALESCE(target_facility_id, facility_id)
WHERE facility_id IS NOT NULL;

UPDATE missions
SET actual_facility_id = COALESCE(actual_facility_id, target_facility_id)
WHERE target_facility_id IS NOT NULL
  AND actual_facility_id IS NULL
  AND status IN ('completed', 'closed');

CREATE INDEX IF NOT EXISTS idx_missions_org_unit ON missions(org_unit_id);
CREATE INDEX IF NOT EXISTS idx_missions_destination_type ON missions(destination_type);
CREATE INDEX IF NOT EXISTS idx_missions_target_facility ON missions(target_facility_id);
CREATE INDEX IF NOT EXISTS idx_missions_target_governorate ON missions(target_governorate_id);
CREATE INDEX IF NOT EXISTS idx_missions_actual_facility ON missions(actual_facility_id);
CREATE INDEX IF NOT EXISTS idx_missions_actual_governorate ON missions(actual_governorate_id);
CREATE INDEX IF NOT EXISTS idx_missions_review_status ON missions(review_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'missions_destination_target_check'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_destination_target_check CHECK (
        (destination_type = 'facility' AND target_facility_id IS NOT NULL)
        OR
        (destination_type = 'governorate' AND target_governorate_id IS NOT NULL)
        OR
        status = 'draft'
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'missions_change_reason_check'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_change_reason_check CHECK (
        destination_changed = FALSE
        OR
        NULLIF(BTRIM(change_reason), '') IS NOT NULL
      );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS mission_destination_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES users(id) NOT NULL,
  original_facility_id UUID REFERENCES facilities(id),
  original_governorate_id UUID REFERENCES governorates(id),
  new_facility_id UUID REFERENCES facilities(id),
  new_governorate_id UUID REFERENCES governorates(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destination_changes_mission ON mission_destination_changes(mission_id);
CREATE INDEX IF NOT EXISTS idx_destination_changes_user ON mission_destination_changes(changed_by);

CREATE OR REPLACE FUNCTION log_mission_destination_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    OLD.actual_facility_id IS DISTINCT FROM NEW.actual_facility_id
    OR OLD.actual_governorate_id IS DISTINCT FROM NEW.actual_governorate_id
  ) AND NEW.destination_changed = TRUE THEN
    INSERT INTO mission_destination_changes (
      mission_id,
      changed_by,
      original_facility_id,
      original_governorate_id,
      new_facility_id,
      new_governorate_id,
      reason
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.assigned_user_id, OLD.assigned_user_id),
      OLD.actual_facility_id,
      OLD.actual_governorate_id,
      NEW.actual_facility_id,
      NEW.actual_governorate_id,
      NEW.change_reason
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mission_destination_change ON missions;
CREATE TRIGGER trg_mission_destination_change
  AFTER UPDATE OF actual_facility_id, actual_governorate_id, destination_changed, change_reason ON missions
  FOR EACH ROW
  EXECUTE FUNCTION log_mission_destination_change();

CREATE OR REPLACE FUNCTION update_organization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_units_updated ON organizational_units;
CREATE TRIGGER trg_org_units_updated
  BEFORE UPDATE ON organizational_units
  FOR EACH ROW EXECUTE FUNCTION update_organization_updated_at();

DROP TRIGGER IF EXISTS trg_governorates_updated ON governorates;
CREATE TRIGGER trg_governorates_updated
  BEFORE UPDATE ON governorates
  FOR EACH ROW EXECUTE FUNCTION update_organization_updated_at();

ALTER TABLE organizational_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE governorates ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_destination_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_units_read_authenticated" ON organizational_units;
CREATE POLICY "org_units_read_authenticated" ON organizational_units
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "governorates_read_authenticated" ON governorates;
CREATE POLICY "governorates_read_authenticated" ON governorates
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "facilities_read_authenticated" ON facilities;
CREATE POLICY "facilities_read_authenticated" ON facilities
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "users_read_authenticated" ON users;
CREATE POLICY "users_read_authenticated" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "destination_changes_select" ON mission_destination_changes;
CREATE POLICY "destination_changes_select" ON mission_destination_changes
  FOR SELECT USING (
    changed_by = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
  );

DROP POLICY IF EXISTS "destination_changes_insert" ON mission_destination_changes;
CREATE POLICY "destination_changes_insert" ON mission_destination_changes
  FOR INSERT WITH CHECK (
    changed_by = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
  );

INSERT INTO organizational_units (code, name, unit_type, parent_id, level, sort_order)
VALUES ('TH-SECTOR', 'قطاع الطب العلاجي', 'sector', NULL, 0, 1)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  unit_type = EXCLUDED.unit_type,
  parent_id = EXCLUDED.parent_id,
  level = EXCLUDED.level,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

WITH sector AS (
  SELECT id FROM organizational_units WHERE code = 'TH-SECTOR'
)
INSERT INTO organizational_units (code, name, unit_type, parent_id, level, sort_order)
SELECT code, name, unit_type, sector.id, level, sort_order
FROM sector
CROSS JOIN (VALUES
  ('TH-CA-CURATIVE', 'الإدارة المركزية للشئون العلاجية', 'central_administration', 1, 1),
  ('TH-CA-BLOOD-PLASMA', 'الإدارة المركزية لعمليات الدم وتجميع البلازما', 'central_administration', 1, 2),
  ('TH-CA-EMERGENCY-CRITICAL', 'الإدارة المركزية للطوارئ والرعاية الحرجة', 'central_administration', 1, 3),
  ('TH-CA-SPECIALIZED-CENTERS', 'الإدارة المركزية لأمانة المراكز الطبية المتخصصة', 'central_administration', 1, 4),
  ('TH-SUP-MEDICAL-CONVOYS', 'إدارة القوافل الطبية', 'supervisory_unit', 1, 5),
  ('TH-SUP-THERAPEUTIC-NUTRITION', 'إدارة التغذية العلاجية', 'supervisory_unit', 1, 6)
) AS units(code, name, unit_type, level, sort_order)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  unit_type = EXCLUDED.unit_type,
  parent_id = EXCLUDED.parent_id,
  level = EXCLUDED.level,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

WITH parents AS (
  SELECT code, id FROM organizational_units
)
INSERT INTO organizational_units (code, name, unit_type, parent_id, level, sort_order)
SELECT child.code, child.name, 'general_administration', parent.id, 2, child.sort_order
FROM (VALUES
  ('TH-GA-SPECIALIZED-MEDICAL-COUNCILS', 'الإدارة العامة للمجالس الطبية المتخصصة', 'TH-CA-CURATIVE', 1),
  ('TH-GA-RADIOLOGY', 'الإدارة العامة للأشعة', 'TH-CA-CURATIVE', 2),
  ('TH-GA-DENTISTRY', 'الإدارة العامة لشئون طب الأسنان', 'TH-CA-CURATIVE', 3),
  ('TH-GA-HOSPITALS', 'الإدارة العامة لشئون المستشفيات', 'TH-CA-CURATIVE', 4),
  ('TH-GA-PHYSICAL-THERAPY', 'الإدارة العامة للعلاج الطبيعي', 'TH-CA-CURATIVE', 5),
  ('TH-GA-PHARMACEUTICAL-AFFAIRS', 'الإدارة العامة للشئون الصيدلية', 'TH-CA-CURATIVE', 6),
  ('TH-GA-BLOOD-CENTERS', 'الإدارة العامة لمراكز عمليات الدم', 'TH-CA-BLOOD-PLASMA', 1),
  ('TH-GA-PLASMA-COLLECTION', 'الإدارة العامة لتجميع البلازما', 'TH-CA-BLOOD-PLASMA', 2),
  ('TH-GA-STANDARDS-EVAL-OPS', 'الإدارة العامة للمعايير والتقييم الفني ومتابعة التشغيل', 'TH-CA-BLOOD-PLASMA', 3),
  ('TH-GA-HEALTH-MOBILIZATION', 'الإدارة العامة للتعبئة الصحية', 'TH-CA-EMERGENCY-CRITICAL', 1),
  ('TH-GA-OPERATIONS', 'الإدارة العامة للتشغيل والعمليات', 'TH-CA-EMERGENCY-CRITICAL', 2),
  ('TH-GA-EMERGENCY-CRITICAL-SPECIALTIES', 'الإدارة العامة للطوارئ والتخصصات الطبية الحرجة', 'TH-CA-EMERGENCY-CRITICAL', 3),
  ('TH-GA-SPECIALIZED-MEDICAL-CARE', 'الإدارة العامة للرعاية الطبية المتخصصة', 'TH-CA-SPECIALIZED-CENTERS', 1),
  ('TH-GA-FINANCE-ADMIN', 'الإدارة العامة للشئون المالية والإدارية', 'TH-CA-SPECIALIZED-CENTERS', 2)
) AS child(code, name, parent_code, sort_order)
JOIN parents parent ON parent.code = child.parent_code
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  unit_type = EXCLUDED.unit_type,
  parent_id = EXCLUDED.parent_id,
  level = EXCLUDED.level,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO governorates (code, name, region)
VALUES
  ('CAI', 'القاهرة', 'القاهرة الكبرى'),
  ('GIZ', 'الجيزة', 'القاهرة الكبرى'),
  ('QAL', 'القليوبية', 'القاهرة الكبرى'),
  ('ALX', 'الإسكندرية', 'الإسكندرية'),
  ('BEH', 'البحيرة', 'الدلتا'),
  ('MAT', 'مطروح', 'الساحل الشمالي'),
  ('DKA', 'الدقهلية', 'الدلتا'),
  ('KFS', 'كفر الشيخ', 'الدلتا'),
  ('GHB', 'الغربية', 'الدلتا'),
  ('MNF', 'المنوفية', 'الدلتا'),
  ('SHR', 'الشرقية', 'الدلتا'),
  ('DAM', 'دمياط', 'القناة والدلتا'),
  ('PTS', 'بورسعيد', 'القناة'),
  ('ISM', 'الإسماعيلية', 'القناة'),
  ('SUZ', 'السويس', 'القناة'),
  ('NSI', 'شمال سيناء', 'سيناء'),
  ('SSI', 'جنوب سيناء', 'سيناء'),
  ('BNS', 'بني سويف', 'شمال الصعيد'),
  ('FYM', 'الفيوم', 'شمال الصعيد'),
  ('MNY', 'المنيا', 'شمال الصعيد'),
  ('AST', 'أسيوط', 'وسط الصعيد'),
  ('SHG', 'سوهاج', 'وسط الصعيد'),
  ('QNA', 'قنا', 'جنوب الصعيد'),
  ('LXR', 'الأقصر', 'جنوب الصعيد'),
  ('ASW', 'أسوان', 'جنوب الصعيد'),
  ('RSC', 'البحر الأحمر', 'البحر الأحمر'),
  ('WAD', 'الوادي الجديد', 'الصحراء الغربية')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  region = EXCLUDED.region,
  is_active = TRUE;

UPDATE users
SET org_unit_id = (SELECT id FROM organizational_units WHERE code = 'TH-SECTOR')
WHERE level <= 2
  AND org_unit_id IS NULL;

UPDATE users
SET org_unit_id = (SELECT id FROM organizational_units WHERE code = 'TH-CA-CURATIVE')
WHERE department IN ('التفتيش والمتابعة', 'الإدارة المركزية')
  AND org_unit_id IS NULL;

UPDATE users
SET org_unit_id = (SELECT id FROM organizational_units WHERE code = 'TH-GA-HOSPITALS')
WHERE department = 'إدارة التصحيح'
  AND org_unit_id IS NULL;
