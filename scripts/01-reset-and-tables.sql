-- 01 reset old partial setup and create tables
DROP POLICY IF EXISTS "upload_violation_photos" ON storage.objects;
DROP POLICY IF EXISTS "upload_correction_photos" ON storage.objects;
DROP POLICY IF EXISTS "view_photos" ON storage.objects;

DROP TABLE IF EXISTS mission_events CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS violations CASCADE;
DROP TABLE IF EXISTS mission_results CASCADE;
DROP TABLE IF EXISTS missions CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS checklist_sections CASCADE;
DROP TABLE IF EXISTS checklists CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS generate_serial_number(TEXT) CASCADE;
DROP FUNCTION IF EXISTS calculate_mission_duration() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS set_correction_deadline() CASCADE;
DROP FUNCTION IF EXISTS update_mission_violation_count() CASCADE;
DROP FUNCTION IF EXISTS get_current_user_data() CASCADE;
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
