-- =========================================================================
-- نظام إدارة المأموريات الميدانية وحوكمتها - وزارة الصحة والسكان المصرية
-- المخطط الكامل الموحد لقاعدة البيانات (Unified Database Schema)
-- =========================================================================

-- تفعيل تمديد UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- الخطوة 1: إنشاء الجداول الأساسية والدليل المشترك
-- ==========================================

-- 1. جدول المحافظات
CREATE TABLE governorates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  region TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_governorates_active ON governorates(is_active);

-- 2. جدول الوحدات التنظيمية للهيكل الإداري لديوان عام الوزارة والقطاعات
CREATE TABLE organizational_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL, -- sector, central_administration, general_administration, supervisory_unit
  parent_id UUID REFERENCES organizational_units(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_units_parent ON organizational_units(parent_id);
CREATE INDEX idx_org_units_level ON organizational_units(level);
CREATE INDEX idx_org_units_active ON organizational_units(is_active);

-- 3. جدول المنشآت الصحية والصيدلانية ومستودعات الإمداد
CREATE TABLE facilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  address TEXT NOT NULL,
  governorate_id UUID REFERENCES governorates(id) ON DELETE SET NULL,
  org_unit_id UUID REFERENCES organizational_units(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  gps_radius_meters INTEGER DEFAULT 200,
  phone TEXT,
  responsible_dept TEXT,
  facility_code TEXT,
  license_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_facilities_type ON facilities(facility_type);
CREATE INDEX idx_facilities_active ON facilities(is_active);
CREATE INDEX idx_facilities_governorate ON facilities(governorate_id);
CREATE INDEX idx_facilities_org_unit ON facilities(org_unit_id);

-- 4. جدول الكوادر الطبية والمفتشين والموظفين
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  job_title TEXT,
  level INTEGER NOT NULL CHECK (level BETWEEN 0 AND 7), -- 0: techadmin, 1: superadmin, 2: central, 3: generalmanager, 4: creator, 5: financial, 7: inspector
  department TEXT,
  direct_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_lateral BOOLEAN DEFAULT FALSE,
  lateral_type TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  email TEXT UNIQUE,
  phone TEXT,
  financial_code TEXT UNIQUE,
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  org_unit_id UUID REFERENCES organizational_units(id) ON DELETE SET NULL,
  employee_code TEXT,
  mobile TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_level ON users(level);
CREATE INDEX idx_users_manager ON users(direct_manager_id);
CREATE INDEX idx_users_auth ON users(auth_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_financial_code ON users(financial_code);
CREATE INDEX idx_users_facility ON users(facility_id);
CREATE INDEX idx_users_org_unit ON users(org_unit_id);

-- 5. جدول وحدات التصحيح المركزية المسؤولة عن معالجة المخالفات
CREATE TABLE correction_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_correction_units_active ON correction_units(is_active, sort_order, name);

-- 6. جدول الصلاحيات الفردية وحجب الصفحات للموظفين (Overrides)
CREATE TABLE user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  allowed_pages TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);

-- 7. جدول صلاحيات الأدوار/المجموعات الوظيفية الديناميكية
CREATE TABLE role_permissions (
  role TEXT PRIMARY KEY, -- superadmin, techadmin, central, generalmanager, creator, financial, inspector
  allowed_pages TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- الخطوة 2: جداول التكليف والرقابة وجلسات المرور
-- ==========================================

-- 8. جدول قوائم الفحص الرئيسية (Checklists Templates)
CREATE TABLE checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. جدول أقسام قوائم الفحص (Checklist Sections)
CREATE TABLE checklist_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- 10. جدول بنود الأسئلة داخل قوائم الفحص (Checklist Items)
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

-- 11. جدول عدادات الأرقام التسلسلية لحماية المعاملات
CREATE TABLE serial_counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- 12. جدول المأموريات (Missions)
CREATE TABLE missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  serial_number TEXT UNIQUE NOT NULL,

  -- التكليف والجهات المالكة
  assigned_user_id UUID REFERENCES users(id) NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  org_unit_id UUID REFERENCES organizational_units(id) ON DELETE SET NULL,

  -- المخطط والهدف الجغرافي
  destination_type TEXT DEFAULT 'facility' CHECK (destination_type IN ('facility', 'governorate')),
  target_facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  target_governorate_id UUID REFERENCES governorates(id) ON DELETE SET NULL,

  -- حقول التوافقية السابقة
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  checklist_id UUID REFERENCES checklists(id) ON DELETE SET NULL,

  -- الفعلي والمنفذ ميدانياً
  actual_facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  actual_governorate_id UUID REFERENCES governorates(id) ON DELETE SET NULL,
  destination_changed BOOLEAN DEFAULT FALSE,
  change_reason TEXT,

  -- مواصفات العمل والجدولة
  status TEXT DEFAULT 'draft',
  priority TEXT DEFAULT 'normal',
  scheduled_date DATE NOT NULL,
  visit_purpose TEXT,
  notes TEXT,
  execution_notes TEXT,
  rejection_reason TEXT,

  -- الأثر الزمني والتوقيت
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- المطابقة الجغرافية GPS
  checkin_lat DECIMAL(10, 8),
  checkin_lng DECIMAL(11, 8),
  checkin_time TIMESTAMPTZ,
  checkout_lat DECIMAL(10, 8),
  checkout_lng DECIMAL(11, 8),
  checkout_time TIMESTAMPTZ,
  gps_verified BOOLEAN DEFAULT FALSE,
  duration_minutes INTEGER,

  -- الإحصاءات الفنية
  total_items INTEGER DEFAULT 0,
  compliant_items INTEGER DEFAULT 0,
  violation_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT missions_destination_target_check CHECK (
    (destination_type = 'facility' AND target_facility_id IS NOT NULL)
    OR
    (destination_type = 'governorate' AND target_governorate_id IS NOT NULL)
    OR
    status = 'draft'
  )
);

CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_facility ON missions(facility_id);
CREATE INDEX idx_missions_target_facility ON missions(target_facility_id);
CREATE INDEX idx_missions_user ON missions(assigned_user_id);
CREATE INDEX idx_missions_date ON missions(scheduled_date);
CREATE INDEX idx_missions_serial ON missions(serial_number);
CREATE INDEX idx_missions_org_unit ON missions(org_unit_id);
CREATE INDEX idx_missions_destination_type ON missions(destination_type);

-- 13. جدول سجل تغييرات الوجهة الميدانية للمفتش
CREATE TABLE mission_destination_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  original_facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  original_governorate_id UUID REFERENCES governorates(id) ON DELETE SET NULL,
  new_facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  new_governorate_id UUID REFERENCES governorates(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_destination_changes_mission ON mission_destination_changes(mission_id);
CREATE INDEX idx_destination_changes_user ON mission_destination_changes(changed_by);

-- 14. جدول تفاصيل نتائج البنود المنفذة (Inspection Results)
CREATE TABLE mission_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES checklist_items(id) ON DELETE SET NULL,
  answer TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_results_mission ON mission_results(mission_id);

-- 15. جدول المخالفات الفنية والتشغيلية الموثقة (Violations)
CREATE TABLE violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES checklist_items(id) ON DELETE SET NULL,
  facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  assigned_to_dept TEXT,
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  correction_deadline TIMESTAMPTZ,
  correction_notes TEXT,
  corrected_at TIMESTAMPTZ,
  corrected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
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

-- 16. جدول الإشعارات الذكية للمستخدمين
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

-- 17. جدول سجل تتبع أحداث المأموريات (Mission Events)
CREATE TABLE mission_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_mission ON mission_events(mission_id);
CREATE INDEX idx_events_type ON mission_events(event_type);

-- =========================================================================
-- الخطوة 3: الدوال المؤتمتة والمشغلات التلقائية (Triggers & Functions)
-- =========================================================================

-- 1. دالة تحديث الحقل الزمني تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط مشغل التحديث التلقائي بالجداول المعنية
CREATE TRIGGER trg_gov_updated BEFORE UPDATE ON governorates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_org_units_updated BEFORE UPDATE ON organizational_units FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_facilities_updated BEFORE UPDATE ON facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_correction_units_updated BEFORE UPDATE ON correction_units FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_permissions_updated BEFORE UPDATE ON user_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_role_permissions_updated BEFORE UPDATE ON role_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_checklists_updated BEFORE UPDATE ON checklists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_violations_updated BEFORE UPDATE ON violations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_missions_updated BEFORE UPDATE ON missions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. دالة توليد الرقم التسلسلي الآمن للمأمورية منعاً للـ Race Conditions
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

-- 3. دالة معالجة إضافة مستخدم جديد من نظام Supabase Auth تلقائياً
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (auth_id, full_name, level, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    7, -- default rank: inspector
    NEW.email
  )
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- 4. دالة حساب مدة المأمورية تلقائياً عند تسجيل الانصراف
CREATE OR REPLACE FUNCTION calculate_mission_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.checkout_time IS NOT NULL AND NEW.checkin_time IS NOT NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.checkout_time - NEW.checkin_time)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mission_duration
  BEFORE UPDATE OF checkout_time, checkin_time ON missions
  FOR EACH ROW EXECUTE FUNCTION calculate_mission_duration();

-- 5. دالة حساب الموعد الأقصى لمعالجة المخالفات بناءً على درجة الخطورة
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
      ELSE
        NEW.correction_deadline := NOW() + INTERVAL '7 days';
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_violation_deadline
  BEFORE INSERT ON violations
  FOR EACH ROW EXECUTE FUNCTION set_correction_deadline();

-- 6. تحديث إحصائيات المخالفات في المأمورية تلقائياً عند التعديل
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
  FOR EACH ROW EXECUTE FUNCTION update_mission_violation_count();

-- 7. دالة رصد وتسجيل تغييرات الوجهات الميدانية تلقائياً
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

CREATE TRIGGER trg_mission_destination_change
  AFTER UPDATE OF actual_facility_id, actual_governorate_id, destination_changed, change_reason ON missions
  FOR EACH ROW EXECUTE FUNCTION log_mission_destination_change();

-- =========================================================================
-- الخطوة 4: حوكمة الوصول هرمياً وRow Level Security (RLS) Policies
-- =========================================================================

-- تفعيل الـ RLS على كافة الجداول لضمان عزل البيانات
ALTER TABLE governorates ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizational_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_destination_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_events ENABLE ROW LEVEL SECURITY;

-- 1. سياسات المحافظات والوحدات التنظيمية (قراءة عامة للموثقين)
CREATE POLICY "governorates_select" ON governorates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "org_units_select" ON organizational_units FOR SELECT USING (auth.role() = 'authenticated');

-- 2. سياسة المستخدمين الهرمية وعزل صلاحيات التعديل (Hierarchical User Isolation)
-- المستخدم يرى فقط الكوادر والموظفين من رتبته أو دونها إدارياً (Level >= UserLevel) لمنع اطلاع الصغار على صلاحيات وسجلات الكبار
CREATE POLICY "users_select_hierarchical" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users current_u
      WHERE current_u.auth_id = auth.uid()
      AND current_u.level <= users.level
    )
    OR auth_id = auth.uid()
  );

-- عمليات الكتابة والإضافة والحذف في دليل المستخدمين بالكامل مقتصرة حصرياً على الدعم الفني والسوبر أدمن (Level <= 1)
CREATE POLICY "users_insert_admin" ON users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users current_u
      WHERE current_u.auth_id = auth.uid()
      AND current_u.level <= 1
    )
    OR auth_id = auth.uid() -- السماح للمشغل الداخلي بإنشاء ملفه الذاتي عند التسجيل الأول
  );

CREATE POLICY "users_update_admin" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users current_u
      WHERE current_u.auth_id = auth.uid()
      AND current_u.level <= 1
    )
    OR auth_id = auth.uid()
  );

CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users current_u
      WHERE current_u.auth_id = auth.uid()
      AND current_u.level <= 1
    )
  );

-- 3. سياسة المنشآت الهرمية وحظر رؤية المخازن والمراكز التخصصية الحساسة (Hierarchical Facility Isolation)
CREATE POLICY "facilities_select_hierarchical" ON facilities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users current_u
      WHERE current_u.auth_id = auth.uid()
      AND (
        -- المستويات العليا (0 و 1 و 2) يرون كافة المنشآت والمستودعات الطبية المركزية دون أي قيود
        current_u.level <= 2
        -- مدير عام المستشفيات (مستوى 3) لا يرى مستودعات الإمداد الطبي والتموين الحساسة
        OR (current_u.level = 3 AND facility_type NOT LIKE '%مخزن%')
        -- الموظف المختص والمالي (مستوى 4 و 5) لا يرون المستشفيات التخصصية أو مستودعات الإمداد أو المستشفيات التعليمية الكبرى
        OR (current_u.level IN (4, 5) 
            AND facility_type NOT LIKE '%تخصصي%' 
            AND facility_type NOT LIKE '%الرعاية الصحية%' 
            AND facility_type NOT LIKE '%مخزن%' 
            AND facility_type NOT LIKE '%تعليم%')
        -- المفتش الميداني (مستوى 6 و 7) يرى فقط المستشفيات العامة والمراكز الصحية ووحدات طب الأسرة الأساسية
        OR (current_u.level >= 6 
            AND facility_type NOT LIKE '%تخصصي%' 
            AND facility_type NOT LIKE '%الرعاية الصحية%' 
            AND facility_type NOT LIKE '%مخزن%' 
            AND facility_type NOT LIKE '%تعليم%'
            AND facility_type NOT LIKE '%تأمين%')
      )
    )
    OR auth.role() = 'anon'
  );

-- إدارة المنشآت وحوكمة عمليات الإضافة والتعديل والحذف مقصورة بالكامل على الدعم الفني والسوبر أدمن فقط (Level <= 1)
CREATE POLICY "facilities_insert_admin" ON facilities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users current_u
      WHERE current_u.auth_id = auth.uid()
      AND current_u.level <= 1
    )
  );

CREATE POLICY "facilities_update_admin" ON facilities
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users current_u
      WHERE current_u.auth_id = auth.uid()
      AND current_u.level <= 1
    )
  );

CREATE POLICY "facilities_delete_admin" ON facilities
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users current_u
      WHERE current_u.auth_id = auth.uid()
      AND current_u.level <= 1
    )
  );

-- 4. سياسات وحدات التصحيح والصلاحيات الفردية والديناميكية
CREATE POLICY "correction_units_select" ON correction_units FOR SELECT USING (TRUE);
CREATE POLICY "correction_units_write" ON correction_units FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND level <= 1)
);

CREATE POLICY "user_permissions_select" ON user_permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "user_permissions_write" ON user_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND level <= 1)
);

CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "role_permissions_write" ON role_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND level <= 1)
);

-- 5. سياسات لوائح وقوالب الفحص (Checklists)
CREATE POLICY "checklists_select" ON checklists FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "checklists_write" ON checklists FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND level <= 3) -- restricted to GM and higher
);

CREATE POLICY "checklist_sections_select" ON checklist_sections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "checklist_items_select" ON checklist_items FOR SELECT USING (auth.role() = 'authenticated');

-- 6. سياسات المأموريات وتفاصيل الوجهة (Missions)
CREATE POLICY "missions_select" ON missions
  FOR SELECT USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) < 7
    OR assigned_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "missions_insert" ON missions
  FOR INSERT WITH CHECK (
    (SELECT level FROM users WHERE auth_id = auth.uid()) < 7
  );

CREATE POLICY "missions_update" ON missions
  FOR UPDATE USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
    OR assigned_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "destination_changes_select" ON mission_destination_changes
  FOR SELECT USING (
    changed_by = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
  );

-- 7. سياسات النتائج والمخالفات والإشعارات
CREATE POLICY "mission_results_select" ON mission_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = mission_id
        AND ((SELECT level FROM users WHERE auth_id = auth.uid()) < 7
             OR m.assigned_user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
    )
  );

CREATE POLICY "mission_results_insert" ON mission_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = mission_id
        AND ((SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
             OR m.assigned_user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
    )
  );

CREATE POLICY "violations_select" ON violations
  FOR SELECT USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
    OR (
      (SELECT is_lateral FROM users WHERE auth_id = auth.uid()) = TRUE
      AND assigned_to_dept = (SELECT lateral_type FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "violations_insert" ON violations
  FOR INSERT WITH CHECK (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 7
  );

CREATE POLICY "violations_update" ON violations
  FOR UPDATE USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
    OR (
      (SELECT is_lateral FROM users WHERE auth_id = auth.uid()) = TRUE
      AND assigned_to_dept = (SELECT lateral_type FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- 8. حجب الوصول المباشر لعدادات الأرقام التسلسلية لحمايتها
CREATE POLICY "serial_counters_no_direct_access" ON serial_counters FOR ALL USING (FALSE);

-- =========================================================================
-- الخطوة 5: سياسات مخزن الصور والوثائق (Storage Buckets)
-- =========================================================================

CREATE POLICY "upload_violation_photos" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'violation-photos' AND auth.role() = 'authenticated'
);

CREATE POLICY "upload_correction_photos" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'correction-photos' AND auth.role() = 'authenticated'
);

CREATE POLICY "view_photos" ON storage.objects FOR SELECT USING (
  auth.role() = 'authenticated' AND bucket_id IN ('violation-photos', 'correction-photos', 'mission-attachments')
);
