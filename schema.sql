-- ==========================================
-- نظام إدارة المأموريات - وزارة الصحة والسكان
-- الخطوة 1: إنشاء الجداول
-- ==========================================

-- جدول المحافظات
CREATE TABLE governorates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_governorates_active ON governorates(is_active);

-- جدول الوحدات التنظيمية (الإدارات والأقسام)
CREATE TABLE organizational_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  parent_id UUID REFERENCES organizational_units(id),
  level INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_units_parent ON organizational_units(parent_id);
CREATE INDEX idx_org_units_level ON organizational_units(level);
CREATE INDEX idx_org_units_active ON organizational_units(is_active);

-- جدول المستخدمين
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  job_title TEXT,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 7),
  department TEXT,
  direct_manager_id UUID REFERENCES users(id),
  is_lateral BOOLEAN DEFAULT FALSE,
  lateral_type TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_level ON users(level);
CREATE INDEX idx_users_manager ON users(direct_manager_id);
CREATE INDEX idx_users_auth ON users(auth_id);

-- جدول المنشآت الصحية
CREATE TABLE facilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  address TEXT NOT NULL,
  governorate_id UUID REFERENCES governorates(id),
  org_unit_id UUID REFERENCES organizational_units(id),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  gps_radius_meters INTEGER DEFAULT 200,
  phone TEXT,
  responsible_dept TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_facilities_type ON facilities(facility_type);
CREATE INDEX idx_facilities_active ON facilities(is_active);
CREATE INDEX idx_facilities_governorate ON facilities(governorate_id);

-- جدول قوائم الفحص الرئيسية
CREATE TABLE checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول أقسام قوائم الفحص
CREATE TABLE checklist_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- جدول بنود قوائم الفحص
CREATE TABLE checklist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID REFERENCES checklist_sections(id) ON DELETE CASCADE,
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  answer_type TEXT DEFAULT 'yes_no',
  is_required BOOLEAN DEFAULT TRUE,
  violation_priority TEXT DEFAULT 'medium',
  correction_dept TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_checklist_items_checklist ON checklist_items(checklist_id);
CREATE INDEX idx_checklist_items_section ON checklist_items(section_id);

-- جدول عدادات الأرقام التسلسلية (بديل آمن بدلاً من COUNT)
CREATE TABLE serial_counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- جدول المأموريات
CREATE TABLE missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  serial_number TEXT UNIQUE NOT NULL,

  -- التكليف
  assigned_user_id UUID REFERENCES users(id) NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  approved_by UUID REFERENCES users(id),
  org_unit_id UUID REFERENCES organizational_units(id),

  -- الوجهة المخططة
  destination_type TEXT DEFAULT 'facility' CHECK (destination_type IN ('facility', 'governorate')),
  target_facility_id UUID REFERENCES facilities(id),
  target_governorate_id UUID REFERENCES governorates(id),

  -- حقل تراجعي للتوافق مع إصدارات سابقة
  facility_id UUID REFERENCES facilities(id),
  checklist_id UUID REFERENCES checklists(id),

  -- الوجهة الفعلية (تُملأ عند التنفيذ)
  actual_facility_id UUID REFERENCES facilities(id),
  actual_governorate_id UUID REFERENCES governorates(id),
  destination_changed BOOLEAN DEFAULT FALSE,
  change_reason TEXT,

  -- بيانات التنفيذ
  status TEXT DEFAULT 'draft',
  priority TEXT DEFAULT 'normal',
  scheduled_date DATE NOT NULL,
  visit_purpose TEXT,
  notes TEXT,
  execution_notes TEXT,
  rejection_reason TEXT,

  -- التوقيت
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- GPS
  checkin_lat DECIMAL(10, 8),
  checkin_lng DECIMAL(11, 8),
  checkin_time TIMESTAMPTZ,
  checkout_lat DECIMAL(10, 8),
  checkout_lng DECIMAL(11, 8),
  checkout_time TIMESTAMPTZ,
  gps_verified BOOLEAN DEFAULT FALSE,
  duration_minutes INTEGER,

  -- إحصاءات
  total_items INTEGER DEFAULT 0,
  compliant_items INTEGER DEFAULT 0,
  violation_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_facility ON missions(facility_id);
CREATE INDEX idx_missions_target_facility ON missions(target_facility_id);
CREATE INDEX idx_missions_user ON missions(assigned_user_id);
CREATE INDEX idx_missions_date ON missions(scheduled_date);
CREATE INDEX idx_missions_serial ON missions(serial_number);

-- جدول نتائج الفحص
CREATE TABLE mission_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES checklist_items(id),
  answer TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_results_mission ON mission_results(mission_id);

-- جدول المخالفات
CREATE TABLE violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES checklist_items(id),
  facility_id UUID REFERENCES facilities(id),
  description TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  assigned_to_dept TEXT,
  assigned_to_user_id UUID REFERENCES users(id),
  correction_deadline TIMESTAMPTZ,
  correction_notes TEXT,
  corrected_at TIMESTAMPTZ,
  corrected_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  violation_photo_url TEXT,
  correction_photo_url TEXT,
  photo_lat DECIMAL(10, 8),
  photo_lng DECIMAL(11, 8),
  photo_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_violations_mission ON violations(mission_id);
CREATE INDEX idx_violations_status ON violations(status);
CREATE INDEX idx_violations_priority ON violations(priority);
CREATE INDEX idx_violations_facility ON violations(facility_id);
CREATE INDEX idx_violations_dept ON violations(assigned_to_dept);

-- جدول الإشعارات
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  violation_id UUID REFERENCES violations(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_read ON notifications(is_read);
CREATE INDEX idx_notif_sent ON notifications(sent_at DESC);

-- جدول سجل الأحداث
CREATE TABLE mission_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_mission ON mission_events(mission_id);
CREATE INDEX idx_events_type ON mission_events(event_type);


-- ==========================================
-- الخطوة 2: الدوال التلقائية (Functions & Triggers)
-- ==========================================

-- دالة توليد الرقم التسلسلي (آمنة من Race Condition)
-- تستخدم جدول serial_counters مع INSERT ... ON CONFLICT بدلاً من COUNT(*)
CREATE OR REPLACE FUNCTION generate_serial_number(dept_code TEXT DEFAULT 'GEN')
RETURNS TEXT AS $$
DECLARE
  year_str TEXT := TO_CHAR(NOW(), 'YYYY');
  month_str TEXT := TO_CHAR(NOW(), 'MM');
  counter_key TEXT;
  seq_num INTEGER;
  serial TEXT;
BEGIN
  counter_key := year_str || '-' || month_str;

  INSERT INTO serial_counters (key, value)
  VALUES (counter_key, 1)
  ON CONFLICT (key) DO UPDATE
    SET value = serial_counters.value + 1
  RETURNING value INTO seq_num;

  serial := 'MIS-' || year_str || '-' || month_str || '-'
            || LPAD(seq_num::TEXT, 5, '0') || '-' || UPPER(dept_code);
  RETURN serial;
END;
$$ LANGUAGE plpgsql;

-- دالة إنشاء ملف مستخدم تلقائياً عند التسجيل
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (auth_id, full_name, level)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    7
  )
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- دالة حساب المدة عند تسجيل الخروج
CREATE OR REPLACE FUNCTION calculate_mission_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.checkout_time IS NOT NULL AND NEW.checkin_time IS NOT NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.checkout_time - NEW.checkin_time)) / 60;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mission_duration
  BEFORE UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_mission_duration();

-- دالة عامة لتحديث updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_facilities_updated
  BEFORE UPDATE ON facilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_violations_updated
  BEFORE UPDATE ON violations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- دالة حساب الموعد النهائي للتصحيح حسب الأولوية
CREATE OR REPLACE FUNCTION set_correction_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.correction_deadline IS NULL THEN
    CASE NEW.priority
      WHEN 'critical' THEN
        NEW.correction_deadline := NOW() + INTERVAL '24 hours';
      WHEN 'high' THEN
        NEW.correction_deadline := NOW() + INTERVAL '72 hours';
      WHEN 'medium' THEN
        NEW.correction_deadline := NOW() + INTERVAL '7 days';
      WHEN 'low' THEN
        NEW.correction_deadline := NOW() + INTERVAL '30 days';
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_violation_deadline
  BEFORE INSERT ON violations
  FOR EACH ROW
  EXECUTE FUNCTION set_correction_deadline();

-- تحديث تلقائي لعدد المخالفات عند إضافة/حذف مخالفة
CREATE OR REPLACE FUNCTION update_mission_violation_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE missions
  SET violation_count = (
    SELECT COUNT(*) FROM violations WHERE mission_id = COALESCE(NEW.mission_id, OLD.mission_id)
  )
  WHERE id = COALESCE(NEW.mission_id, OLD.mission_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_violation_count
  AFTER INSERT OR DELETE ON violations
  FOR EACH ROW
  EXECUTE FUNCTION update_mission_violation_count();


-- ==========================================
-- الخطوة 3: إعداد Row Level Security (RLS)
-- ==========================================

ALTER TABLE governorates ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizational_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_counters ENABLE ROW LEVEL SECURITY;

-- دالة مساعدة لقراءة بيانات المستخدم الحالي
CREATE OR REPLACE FUNCTION get_current_user_data()
RETURNS TABLE(user_id UUID, user_level INTEGER, is_lateral BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.level, u.is_lateral
  FROM users u
  WHERE u.auth_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- المحافظات والوحدات التنظيمية: قراءة عامة للمصادقين ---
CREATE POLICY "governorates_select" ON governorates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "org_units_select" ON organizational_units
  FOR SELECT USING (auth.role() = 'authenticated');

-- --- المستخدمون ---
CREATE POLICY "users_select" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

-- المستخدم يمكنه إنشاء ملفه الشخصي فقط عند التسجيل
CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (auth_id = auth.uid());

-- المديرون (مستوى 1-4) يمكنهم تحديث أي مستخدم
CREATE POLICY "users_update_managers" ON users
  FOR UPDATE USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 4
    OR id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- --- المنشآت ---
CREATE POLICY "facilities_select" ON facilities
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "facilities_insert" ON facilities
  FOR INSERT WITH CHECK (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 4
  );

CREATE POLICY "facilities_update" ON facilities
  FOR UPDATE USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 4
  );

-- --- المأموريات ---
CREATE POLICY "missions_select" ON missions
  FOR SELECT USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) < 7
    OR
    assigned_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "missions_insert" ON missions
  FOR INSERT WITH CHECK (
    (SELECT level FROM users WHERE auth_id = auth.uid()) < 7
  );

CREATE POLICY "missions_update" ON missions
  FOR UPDATE USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
    OR
    assigned_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- --- الإشعارات ---
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- --- المخالفات ---
CREATE POLICY "violations_select" ON violations
  FOR SELECT USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
    OR
    (
      (SELECT is_lateral FROM users WHERE auth_id = auth.uid()) = TRUE
      AND
      assigned_to_dept = (SELECT lateral_type FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "violations_insert" ON violations
  FOR INSERT WITH CHECK (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 7
  );

CREATE POLICY "violations_update" ON violations
  FOR UPDATE USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
    OR
    (
      (SELECT is_lateral FROM users WHERE auth_id = auth.uid()) = TRUE
      AND
      assigned_to_dept = (SELECT lateral_type FROM users WHERE auth_id = auth.uid())
    )
  );

-- --- عدادات الأرقام التسلسلية: تُكتب فقط عبر الدالة SECURITY DEFINER ---
CREATE POLICY "serial_counters_no_direct_access" ON serial_counters
  FOR ALL USING (FALSE);

-- --- قوائم الفحص: قراءة عامة ---
CREATE POLICY "checklists_select" ON checklists
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "checklist_sections_select" ON checklist_sections
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "checklist_items_select" ON checklist_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- --- نتائج الفحص وسجل الأحداث ---
CREATE POLICY "mission_results_select" ON mission_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = mission_id
        AND (
          (SELECT level FROM users WHERE auth_id = auth.uid()) < 7
          OR m.assigned_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
        )
    )
  );

CREATE POLICY "mission_results_insert" ON mission_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = mission_id
        AND (
          (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
          OR m.assigned_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
        )
    )
  );

CREATE POLICY "mission_events_select" ON mission_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = mission_id
        AND (
          (SELECT level FROM users WHERE auth_id = auth.uid()) < 7
          OR m.assigned_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
        )
    )
  );


-- ==========================================
-- الخطوة 4: سياسات Storage (الصور)
-- ==========================================

CREATE POLICY "upload_violation_photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'violation-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "upload_correction_photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'correction-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "view_photos"
ON storage.objects FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND bucket_id IN ('violation-photos', 'correction-photos', 'mission-attachments')
);
