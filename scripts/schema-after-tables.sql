-- Run this if schema.sql already created the tables but stopped at the first function.
-- It recreates functions, triggers, RLS, and policies safely.

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

DROP TRIGGER IF EXISTS trg_mission_duration ON missions;
CREATE TRIGGER trg_mission_duration
  BEFORE UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_mission_duration();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_facilities_updated ON facilities;
CREATE TRIGGER trg_facilities_updated
  BEFORE UPDATE ON facilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_violations_updated ON violations;
CREATE TRIGGER trg_violations_updated
  BEFORE UPDATE ON violations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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

DROP TRIGGER IF EXISTS trg_violation_deadline ON violations;
CREATE TRIGGER trg_violation_deadline
  BEFORE INSERT ON violations
  FOR EACH ROW
  EXECUTE FUNCTION set_correction_deadline();

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

DROP TRIGGER IF EXISTS trg_violation_count ON violations;
CREATE TRIGGER trg_violation_count
  AFTER INSERT OR DELETE ON violations
  FOR EACH ROW
  EXECUTE FUNCTION update_mission_violation_count();

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

DROP POLICY IF EXISTS "missions_select" ON missions;
CREATE POLICY "missions_select" ON missions
  FOR SELECT USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) < 7
    OR
    assigned_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "missions_insert" ON missions;
CREATE POLICY "missions_insert" ON missions
  FOR INSERT WITH CHECK (
    (SELECT level FROM users WHERE auth_id = auth.uid()) < 7
  );

DROP POLICY IF EXISTS "missions_update" ON missions;
CREATE POLICY "missions_update" ON missions
  FOR UPDATE USING (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
    OR
    assigned_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "notifications_own" ON notifications;
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "violations_select" ON violations;
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

DROP POLICY IF EXISTS "violations_insert" ON violations;
CREATE POLICY "violations_insert" ON violations
  FOR INSERT WITH CHECK (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 7
  );

DROP POLICY IF EXISTS "violations_update" ON violations;
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

DROP POLICY IF EXISTS "upload_violation_photos" ON storage.objects;
CREATE POLICY "upload_violation_photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'violation-photos'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "upload_correction_photos" ON storage.objects;
CREATE POLICY "upload_correction_photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'correction-photos'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "view_photos" ON storage.objects;
CREATE POLICY "view_photos"
ON storage.objects FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND bucket_id IN ('violation-photos', 'correction-photos', 'mission-attachments')
);
