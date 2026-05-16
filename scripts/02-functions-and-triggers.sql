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

