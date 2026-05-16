import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(scriptDir, '..')

loadEnvFile(resolve(appDir, '.env.local'))
loadEnvFile(resolve(appDir, '.env'))

const args = new Set(process.argv.slice(2))
const fileArg = process.argv.slice(2).find((arg) => arg.startsWith('--file='))
const usersFile = fileArg ? resolve(process.cwd(), fileArg.slice('--file='.length)) : resolve(scriptDir, 'users.seed.json')
const dryRun = args.has('--dry-run')

const supabaseUrl = readEnv('SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY')

const users = JSON.parse(readFileSync(usersFile, 'utf8'))
validateUsers(users)

console.log(`Preparing ${users.length} Supabase users from ${usersFile}`)

if (dryRun) {
  for (const user of users) {
    console.log(`[dry-run] ${user.email} -> ${user.full_name} (level ${user.level})`)
  }
  process.exit(0)
}

if (!supabaseUrl || isPlaceholder(supabaseUrl)) {
  fail('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in .env.local')
}

if (!serviceRoleKey || isPlaceholder(serviceRoleKey)) {
  fail('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local. Use the project service_role/secret key and never prefix it with NEXT_PUBLIC_.')
}

await assertUsersTable()

const existingAuthByEmail = await listAuthUsersByEmail()
const profileIdsByEmail = new Map()

for (const user of users) {
  const existingAuthUser = existingAuthByEmail.get(user.email.toLowerCase())
  const authUser = existingAuthUser || await createAuthUser(user)
  const profile = await upsertProfile(user, authUser.id)

  profileIdsByEmail.set(user.email.toLowerCase(), profile.id)
  console.log(`${existingAuthUser ? 'Updated profile for' : 'Created'} ${user.email}`)
}

for (const user of users) {
  if (!user.manager_email) {
    continue
  }

  const userProfileId = profileIdsByEmail.get(user.email.toLowerCase())
  const managerProfileId = profileIdsByEmail.get(user.manager_email.toLowerCase())

  if (!managerProfileId) {
    throw new Error(`Manager ${user.manager_email} was not found for ${user.email}`)
  }

  await restRequest(`/rest/v1/users?id=eq.${encodeURIComponent(userProfileId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ direct_manager_id: managerProfileId }),
  }).catch((error) => {
    throw new Error(`Failed to set manager for ${user.email}: ${error.message}`)
  })
}

const verifiedProfiles = await restGet('/rest/v1/users?select=id,auth_id')
  .catch((error) => {
    throw new Error(`Verification failed: ${error.message}`)
  })

console.log(`Done. Created or updated ${profileIdsByEmail.size} users. public.users currently has ${verifiedProfiles.length} readable rows.`)

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return
  }

  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue
    }

    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function readEnv(name) {
  return process.env[name]?.trim()
}

function isPlaceholder(value) {
  return value.includes('your-') || value.includes('replace-')
}

function validateUsers(nextUsers) {
  if (!Array.isArray(nextUsers) || nextUsers.length === 0) {
    fail('The users file must contain a non-empty JSON array.')
  }

  const emails = new Set()
  for (const user of nextUsers) {
    for (const field of ['email', 'password', 'full_name', 'level']) {
      if (user[field] === undefined || user[field] === null || user[field] === '') {
        fail(`User entry is missing ${field}.`)
      }
    }

    if (!Number.isInteger(user.level) || user.level < 1 || user.level > 7) {
      fail(`${user.email} has invalid level ${user.level}. Expected an integer from 1 to 7.`)
    }

    const email = user.email.toLowerCase()
    if (emails.has(email)) {
      fail(`Duplicate email in users file: ${user.email}`)
    }
    emails.add(email)
  }
}

async function assertUsersTable() {
  try {
    await restGet('/rest/v1/users?select=id&limit=1')
  } catch (error) {
    throw new Error(`Cannot access public.users. Apply schema.sql first. Supabase said: ${error.message}`)
  }
}

async function listAuthUsersByEmail() {
  const byEmail = new Map()
  let page = 1

  while (true) {
    const data = await authRequest(`/auth/v1/admin/users?page=${page}&per_page=1000`)
    const authUsers = data.users ?? data

    for (const authUser of authUsers) {
      if (authUser.email) {
        byEmail.set(authUser.email.toLowerCase(), authUser)
      }
    }

    if (authUsers.length < 1000) {
      break
    }
    page += 1
  }

  return byEmail
}

async function createAuthUser(user) {
  const data = await authRequest('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.full_name,
        job_title: user.job_title ?? null,
      },
      app_metadata: {
        level: user.level,
        department: user.department ?? null,
      },
    }),
  }).catch((error) => {
    throw new Error(`Failed to create auth user ${user.email}: ${error.message}`)
  })

  return data.user ?? data
}

async function upsertProfile(user, authId) {
  const profile = {
    auth_id: authId,
    full_name: user.full_name,
    job_title: user.job_title ?? null,
    level: user.level,
    department: user.department ?? null,
    is_lateral: Boolean(user.is_lateral),
    lateral_type: user.lateral_type ?? null,
    is_active: user.is_active ?? true,
  }

  const existingProfiles = await restGet(`/rest/v1/users?select=id&auth_id=eq.${encodeURIComponent(authId)}`)
    .catch((error) => {
      throw new Error(`Failed to read profile for ${user.email}: ${error.message}`)
    })
  const existingProfile = existingProfiles[0]

  if (existingProfile) {
    const data = await restRequest(`/rest/v1/users?id=eq.${encodeURIComponent(existingProfile.id)}&select=id`, {
      method: 'PATCH',
      body: JSON.stringify(profile),
      prefer: 'return=representation',
    }).catch((error) => {
      throw new Error(`Failed to update profile for ${user.email}: ${error.message}`)
    })

    return data[0]
  }

  const data = await restRequest('/rest/v1/users?select=id', {
    method: 'POST',
    body: JSON.stringify(profile),
    prefer: 'return=representation',
  }).catch((error) => {
    throw new Error(`Failed to create profile for ${user.email}: ${error.message}`)
  })

  return data[0]
}

async function authRequest(path, options = {}) {
  return jsonRequest(path, options)
}

async function restGet(path) {
  return restRequest(path)
}

async function restRequest(path, options = {}) {
  return jsonRequest(path, options)
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${response.status} ${response.statusText}: ${text}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
