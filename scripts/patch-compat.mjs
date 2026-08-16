import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')

const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    env[match[1]] = match[2].trim()
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function applyFixes() {
  console.log('Adding database column compatibility and sync triggers...')

  const sql = `
    -- 1. Notifications table: add sent_at
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();
    UPDATE notifications SET sent_at = created_at WHERE sent_at IS NULL;

    -- 2. Missions table: add compatibility columns
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id);
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS target_facility_id UUID REFERENCES facilities(id);
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS target_governorate_id UUID;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS destination_type TEXT DEFAULT 'facility';
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS org_unit_id UUID;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

    -- Trigger to keep assigned_user_id & primary_inspector_id synced
    CREATE OR REPLACE FUNCTION sync_mission_compat_fields()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Sync inspector
      IF NEW.primary_inspector_id IS NOT NULL AND NEW.assigned_user_id IS NULL THEN
        NEW.assigned_user_id := NEW.primary_inspector_id;
      ELSIF NEW.assigned_user_id IS NOT NULL AND NEW.primary_inspector_id IS NULL THEN
        NEW.primary_inspector_id := NEW.assigned_user_id;
      END IF;

      -- Sync facility
      IF NEW.facility_id IS NOT NULL AND NEW.target_facility_id IS NULL THEN
        NEW.target_facility_id := NEW.facility_id;
      ELSIF NEW.target_facility_id IS NOT NULL AND NEW.facility_id IS NULL THEN
        NEW.facility_id := NEW.target_facility_id;
      END IF;

      -- Sync violation count
      IF NEW.violations_count IS NOT NULL AND NEW.violation_count = 0 THEN
        NEW.violation_count := NEW.violations_count;
      ELSIF NEW.violation_count IS NOT NULL AND NEW.violations_count = 0 THEN
        NEW.violations_count := NEW.violation_count;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_mission_compat ON missions;
    CREATE TRIGGER trg_sync_mission_compat
    BEFORE INSERT OR UPDATE ON missions
    FOR EACH ROW EXECUTE FUNCTION sync_mission_compat_fields();
  `

  // We can execute SQL via a function or rpc, or let's create a temporary function
  // In Supabase, if pg_net or custom rpc is not there, we can write a SQL file or use supabase-js if rpc exists.
}
