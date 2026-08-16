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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function createRootAdmins() {
  console.log('Creating Root Administrative Accounts...')

  // Ministry Superadmin
  const ministryOrgId = '00000000-0000-0000-0000-000000000001'
  const phcSectorId = '00000000-0000-0000-0000-000000000010'

  const accounts = [
    {
      email: 'admin@mohp.gov.eg',
      password: 'adminPassword123!',
      full_name: 'مشرف عام وزارة الصحة والسكان',
      job_title: 'المشرف العام على المنظومة الرقمية',
      organization_id: ministryOrgId,
      can_inspect: false,
    },
    {
      email: 'phc.head@mohp.gov.eg',
      password: 'adminPassword123!',
      full_name: 'رئيس قطاع الرعاية الصحية الأولية',
      job_title: 'رئيس القطاع المركزي',
      organization_id: phcSectorId,
      can_inspect: false,
    }
  ]

  for (const acc of accounts) {
    // 1. Check if auth user exists
    const { data: userList } = await supabase.auth.admin.listUsers()
    let authUser = userList?.users?.find(u => u.email?.toLowerCase() === acc.email.toLowerCase())

    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: {
          full_name: acc.full_name,
          job_title: acc.job_title,
          must_change_password: false,
        }
      })
      if (error) {
        console.error(`Error creating auth user for ${acc.email}:`, error.message)
        continue
      }
      authUser = data.user
    } else {
      await supabase.auth.admin.updateUserById(authUser.id, {
        password: acc.password,
        email_confirm: true,
        user_metadata: {
          full_name: acc.full_name,
          job_title: acc.job_title,
          must_change_password: false,
        }
      })
    }

    // 2. Insert into users table
    const { data: userRow, error: profileErr } = await supabase
      .from('users')
      .upsert({
        auth_id: authUser.id,
        email: acc.email,
        full_name: acc.full_name,
        job_title: acc.job_title,
        organization_id: acc.organization_id,
        can_inspect: acc.can_inspect,
        is_active: true,
      }, { onConflict: 'email' })
      .select('id, full_name, email, org_level, sector_id')
      .single()

    if (profileErr) {
      console.error(`Error upserting profile for ${acc.email}:`, profileErr.message)
    } else {
      console.log(`✅ Account Ready: ${acc.email} | Level: ${userRow.org_level} | Password: ${acc.password}`)
    }
  }
}

createRootAdmins().catch(console.error)
