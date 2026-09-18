import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { V2_NAVIGATION_ITEMS } from '@/config/navigation'
import { filterV2NavigationItems } from '@/config/permissions'
import { getV2AccessState } from '@/server/authorization'

/**
 * Canonical V2 protected-layout gate.
 *
 * Authentication and authorization are resolved server-side. Navigation is only
 * a presentation of effective access; business APIs/services still require their
 * own permission + resource-scope checks.
 */
export default async function V2ProtectedLayout({
  children,
}: {
  children: ReactNode
}) {
  const accessState = await getV2AccessState()

  if (accessState.status === 'unauthenticated') {
    redirect('/login')
  }

  if (
    accessState.status === 'profile_missing' ||
    accessState.status === 'inactive' ||
    accessState.status === 'authorization_unavailable'
  ) {
    redirect('/v2/access-denied')
  }

  if (accessState.status === 'password_change_required') {
    redirect('/v2/change-password')
  }

  const { user, access } = accessState
  const navigationItems = filterV2NavigationItems(V2_NAVIGATION_ITEMS, access)

  if (navigationItems.length === 0) {
    redirect('/v2/access-denied')
  }

  const displayUser = {
    name: user.fullName,
    jobTitle: user.jobTitle || 'عضو بالمنظومة',
    organization: user.organizationName,
    roleCode: access.roles[0]?.roleCode ?? null,
  }

  return (
    <AppShell items={navigationItems} user={displayUser}>
      {children}
    </AppShell>
  )
}
