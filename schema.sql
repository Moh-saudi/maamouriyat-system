-- ==========================================
-- نظام إدارة المأموريات - وزارة الصحة والسكان
-- الخطوة 1: إنشاء الجداول
-- ==========================================

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

-- جدول المأموريات
CREATE TABLE missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  serial_number TEXT UNIQUE NOT NULL,
  facility_id UUID REFERENCES facilities(id) NOT NULL,
  checklist_id UUID REFERENCES checklists(id),
  assigned_user_id UUID REFERENCES users(id) NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  approved_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'draft',
  priority TEXT DEFAULT 'normal',
  scheduled_date DATE NOT NULL,
  notes TEXT,
  rejection_reason TEXT,
  checkin_lat DECIMAL(10, 8),
  checkin_lng DECIMAL(11, 8),
  checkin_time TIMESTAMPTZ,
  checkout_lat DECIMAL(10, 8),
  checkout_lng DECIMAL(11, 8),
  checkout_time TIMESTAMPTZ,
  gps_verified BOOLEAN DEFAULT FALSE,
  duration_minutes INTEGER,
  total_items INTEGER DEFAULT 0,
  compliant_items INTEGER DEFAULT 0,
  violation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_facility ON missions(facility_id);
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

-- دالة توليد الرقم التسلسلي
CREATE OR REPLACE FUNCTION generate_serial_number(dept_code TEXT DEFAULT 'GEN')
RETURNS TEXT AS $$
DECLARE
  year_str TEXT := TO_CHAR(NOW(), 'YYYY');
  month_str TEXT := TO_CHAR(NOW(), 'MM');
  seq_num INTEGER;
  serial TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num
  FROM missions
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW());

  serial := 'MIS-' || year_str || '-' || month_str || '-'
            || LPAD(seq_num::TEXT, 5, '0') || '-' || UPPER(dept_code);
  RETURN serial;
END;
$$ LANGUAGE plpgsql;

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

-- دالة حساب الموعد النهائي حسب الأولوية
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

-- تحديث تلقائي لعدد المخالفات عند إضافة مخالفة جديدة
CREATE OR REPLACE FUNCTION update_mission_violation_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE missions
  SET violation_count = (
    SELECT COUNT(*) FROM violations WHERE mission_id = NEW.mission_id
  )
  WHERE id = NEW.mission_id;
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

CREATE OR REPLACE FUNCTION get_current_user_data()
RETURNS TABLE(user_id UUID, user_level INTEGER, is_lateral BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.level, u.is_lateral
  FROM users u
  WHERE u.auth_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

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
