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

async function verifyMetrics() {
  const { data: missions } = await supabase.from('missions').select('id, status, scheduled_date, violation_count, assigned_user_id, facility_id, target_facility_id').limit(2000)
  const { data: facilities } = await supabase.from('facilities').select('id, name, governorate').limit(4000)

  const facMap = new Map(facilities?.map(f => [f.id, f]))
  const govCounts = {}
  let totalViolations = 0

  missions?.forEach(m => {
    const fId = m.target_facility_id || m.facility_id
    const fac = facMap.get(fId)
    const gov = fac?.governorate || 'غير محدد'
    govCounts[gov] = (govCounts[gov] || 0) + 1
    totalViolations += (m.violation_count || 0)
  })

  console.log('--- DASHBOARD VISITS PER GOVERNORATE (10+ GOVERNORATES) ---')
  console.table(govCounts)
  console.log(`Total Missions: ${missions?.length}`)
  console.log(`Total Violations: ${totalViolations}`)
}

verifyMetrics()
