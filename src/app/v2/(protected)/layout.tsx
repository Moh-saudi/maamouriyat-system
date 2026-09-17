import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getV2AuthState } from '@/server/auth/context'

function computeInitials(fullName: string): string {
  if (!fullName) return 'م'
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'م'
  if (parts.length === 1) {
    return parts[0].slice(0, 2)
  }
  return `${parts[0][0]}${parts[1][0]}`
}

/**
 * Server Authentication Gate for V2 Protected Routes.
 *
 * Implements defense-in-depth server-side session verification.
 * Redirects:
 * - unauthenticated -> /login
 * - profile_missing -> /v2/access-denied
 * - inactive        -> /v2/access-denied
 * - mustChangePassword -> /v2/change-password
 */
export default async function V2ProtectedLayout({
  children,
}: {
  children: ReactNode
}) {
  const authState = await getV2AuthState()

  if (authState.status === 'unauthenticated') {
    redirect('/login')
  }

  if (authState.status === 'profile_missing' || authState.status === 'inactive') {
    redirect('/v2/access-denied')
  }

  const { user } = authState

  if (user.mustChangePassword) {
    redirect('/v2/change-password')
  }

  // Pass ONLY minimal serialized display data to the Client AppShell
  const displayUser = {
    name: user.fullName,
    jobTitle: user.jobTitle || 'عضو بالمنظومة',
    organization: user.organizationName,
    initials: computeInitials(user.fullName),
  }

  return <AppShell user={displayUser}>{children}</AppShell>
}
