import { cookies } from 'next/headers'
import { demoAccounts, demoSessionRoles, normalizeDemoRole, type DemoRole } from './roles'

export { demoAccounts, demoSessionRoles, type DemoRole }

export async function getDemoSessionEmail() {
  const store = await cookies()
  const value = store.get('maamouriyat_demo_session')?.value
  const role = normalizeDemoRole(value)
  return role ? `${role}@${role}.com` : null
}

export async function getDemoSessionRole(): Promise<DemoRole | null> {
  const store = await cookies()
  return normalizeDemoRole(store.get('maamouriyat_demo_session')?.value)
}
