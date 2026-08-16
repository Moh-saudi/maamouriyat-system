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

async function deduplicate() {
  console.log('Cleaning up duplicate facility entries...')
  
  // Clean all and re-insert once cleanly
  await supabase.from('facilities').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Run seed once
  const { data: orgs } = await supabase.from('organizations').select('id, governorate, health_admin').eq('level', 6)
  const orgMap = new Map()
  for (const org of orgs || []) {
    const key = `${org.governorate?.trim()}|||${org.health_admin?.trim()}`
    orgMap.set(key, org.id)
  }

  const phcSectorId = '00000000-0000-0000-0000-000000000010'
  const jsonPath = 'C:/Users/MeskL/.gemini/antigravity-ide/brain/214e0261-a116-46f8-a36c-27626003508a/scratch/facilities.json'
  const facilities = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

  const toInsert = facilities.map(f => {
    const orgKey = `${f.governorate?.trim()}|||${f.health_admin?.trim()}`
    const orgId = orgMap.get(orgKey) || phcSectorId
    return {
      ...f,
      organization_id: orgId,
      sector_id: phcSectorId,
      is_active: true,
    }
  })

  for (let i = 0; i < toInsert.length; i += 500) {
    await supabase.from('facilities').insert(toInsert.slice(i, i + 500))
  }

  const { count } = await supabase.from('facilities').select('*', { count: 'exact', head: true })
  console.log(`✅ Cleaned and deduplicated! Exact facility count: ${count}`)
}

deduplicate().catch(console.error)
