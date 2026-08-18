import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envContent = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8')
const env = {}
envContent.split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = m[2].trim()
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function verifyDashboardMetrics() {
  const { data: missions } = await supabase.from('missions').select('id, status, scheduled_date, violation_count, assigned_user_id, sector_id, org_unit_id')
  
  const completed = missions.filter(m => m.status === 'completed').length
  const inProgress = missions.filter(m => m.status === 'in_progress').length
  const approved = missions.filter(m => m.status === 'approved').length
  const pending = missions.filter(m => m.status === 'pending_approval').length

  const totalViolations = missions.reduce((sum, m) => sum + (m.violation_count || 0), 0)

  console.log('--- DASHBOARD METRICS SUMMARY ---')
  console.log(`Total Missions: ${missions.length}`)
  console.log(`Completed: ${completed}`)
  console.log(`In Progress (Live): ${inProgress}`)
  console.log(`Approved (Upcoming): ${approved}`)
  console.log(`Pending Approval: ${pending}`)
  console.log(`Total Violations Tracked: ${totalViolations}`)
}

verifyDashboardMetrics()
