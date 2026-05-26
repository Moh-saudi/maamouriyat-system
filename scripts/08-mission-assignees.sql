-- Optional team-members table for missions that require more than one employee.
-- missions.assigned_user_id remains the primary assignee for compatibility.

CREATE TABLE IF NOT EXISTS mission_assignees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (mission_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_assignees_mission
  ON mission_assignees(mission_id);

CREATE INDEX IF NOT EXISTS idx_mission_assignees_user
  ON mission_assignees(user_id);

ALTER TABLE mission_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mission_assignees_select" ON mission_assignees;
CREATE POLICY "mission_assignees_select" ON mission_assignees
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
  );

DROP POLICY IF EXISTS "mission_assignees_insert" ON mission_assignees;
CREATE POLICY "mission_assignees_insert" ON mission_assignees
  FOR INSERT WITH CHECK (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
  );
