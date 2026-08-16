import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')

// Read env
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    env[match[1]] = match[2].trim()
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function run() {
  console.log('Connecting to Supabase:', supabaseUrl)
  
  // 1. Fetch organizations (Level 6 Health Admins)
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, governorate, health_admin')
    .eq('level', 6)

  if (orgsError) {
    console.error('Error fetching organizations. Make sure you ran Part 1 & Part 3 SQL first!', orgsError.message)
    process.exit(1)
  }

  const orgMap = new Map()
  for (const org of orgs || []) {
    const key = `${org.governorate?.trim()}|||${org.health_admin?.trim()}`
    orgMap.set(key, org.id)
  }

  console.log(`Found ${orgMap.size} Health Administration organizations in database.`)

  const phcSectorId = '00000000-0000-0000-0000-000000000010'

  // 2. Read facilities json
  const jsonPath = 'C:/Users/MeskL/.gemini/antigravity-ide/brain/214e0261-a116-46f8-a36c-27626003508a/scratch/facilities.json'
  const facilities = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  console.log(`Preparing to insert ${facilities.length} facilities...`)

  const toInsert = []
  for (const f of facilities) {
    const orgKey = `${f.governorate?.trim()}|||${f.health_admin?.trim()}`
    const orgId = orgMap.get(orgKey)
    if (orgId) {
      toInsert.push({
        ...f,
        organization_id: orgId,
        sector_id: phcSectorId,
        is_active: true,
      })
    } else {
      // Fallback to sector id if specific health admin is missing
      toInsert.push({
        ...f,
        organization_id: phcSectorId,
        sector_id: phcSectorId,
        is_active: true,
      })
    }
  }

  // 3. Batch insert in chunks of 500
  const CHUNK_SIZE = 500
  let totalInserted = 0

  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE)
    const { error: insertError } = await supabase.from('facilities').insert(chunk)
    if (insertError) {
      console.error(`Error inserting batch ${i / CHUNK_SIZE + 1}:`, insertError.message)
    } else {
      totalInserted += chunk.length
      console.log(`Inserted ${totalInserted}/${toInsert.length} facilities...`)
    }
  }

  console.log(`\n✅ All ${totalInserted} facilities imported successfully!`)
}

run().catch(console.error)
