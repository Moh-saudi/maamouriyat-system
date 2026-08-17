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

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

async function main() {
  const defaultPassword = 'password123'
  console.log('Testing and verifying credentials for key users...')
  
  const testAccounts = [
    'admin@mohp.gov.eg',
    'sector.head@mohp.gov.eg',
    'directorate.cairo@mohp.gov.eg',
    'inspector.cairo@mohp.gov.eg',
    'admin.abnoub@mohp.gov.eg',
    'inspector.abnoub@mohp.gov.eg',
    'phc.sector@mohp.gov.eg'
  ]

  for (const email of testAccounts) {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email,
      password: defaultPassword
    })

    if (error) {
      console.log(`[FAIL] ${email}: ${error.message}`)
    } else {
      console.log(`[SUCCESS] ${email} logged in successfully! (Auth ID: ${data.user.id})`)
    }
  }
}

main()
