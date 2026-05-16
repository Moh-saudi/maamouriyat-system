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
