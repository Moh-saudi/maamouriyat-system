import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = m[2].trim()
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function resetCommonPasswords() {
  const { data: authUsers, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) {
    console.error('Error listing users:', listErr)
    return
  }

  const { data: dbUsers } = await supabase.from('users').select('*')
  
  console.log(`Found ${authUsers.users.length} auth users and ${dbUsers?.length || 0} database profiles.`)

  const defaultPassword = 'password123'

  for (const u of authUsers.users) {
    const email = u.email
    const dbProfile = dbUsers?.find(d => d.auth_id === u.id || d.email?.toLowerCase() === email?.toLowerCase())
    
    // Reset password
    const { error: updateErr } = await supabase.auth.admin.updateUserById(u.id, {
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        ...(u.user_metadata || {}),
        full_name: dbProfile?.full_name || u.user_metadata?.full_name || email
      }
    })

    console.log(`User: ${email.padEnd(35)} | Name: ${(dbProfile?.full_name || 'بدون ملف').padEnd(30)} | Password set to: ${defaultPassword} -> ${updateErr ? updateErr.message : 'OK'}`)
  }
}

resetCommonPasswords()
