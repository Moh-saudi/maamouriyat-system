import 'server-only'

import { redirect } from 'next/navigation'
import { getV2AccessState, hasV2Permission } from '@/server/authorization'
import type { V2AuthenticatedUser } from '@/server/auth/types'
import type { V2AuthorizationSnapshot } from '@/server/authorization/types'

export type V2PageAccessContext = {
  user: V2AuthenticatedUser
  access: V2AuthorizationSnapshot
}

/**
 * Canonical server page guard.
 *
 * Navigation visibility is presentation only. Every protected V2 page that has a
 * permission boundary must call this helper so direct URL access is also blocked.
 */
export async function requireV2PagePermission(
  permissionKey: string
): Promise<V2PageAccessContext> {
  const state = await getV2AccessState()

  if (state.status === 'unauthenticated') {
    redirect('/login')
  }

  if (state.status === 'password_change_required') {
    redirect('/v2/change-password')
  }

  if (
    state.status === 'profile_missing' ||
    state.status === 'inactive' ||
    state.status === 'authorization_unavailable'
  ) {
    redirect('/v2/access-denied')
  }

  if (!hasV2Permission(state.access, permissionKey)) {
    redirect('/v2/access-denied')
  }

  return {
    user: state.user,
    access: state.access,
  }
}


export async function requireAnyV2PagePermission(
  permissionKeys: readonly string[]
): Promise<V2PageAccessContext> {
  const state = await getV2AccessState()

  if (state.status === 'unauthenticated') {
    redirect('/login')
  }

  if (state.status === 'password_change_required') {
    redirect('/v2/change-password')
  }

  if (
    state.status === 'profile_missing' ||
    state.status === 'inactive' ||
    state.status === 'authorization_unavailable'
  ) {
    redirect('/v2/access-denied')
  }

  const granted = permissionKeys.some((permissionKey) =>
    hasV2Permission(state.access, permissionKey)
  )

  if (!granted) {
    redirect('/v2/access-denied')
  }

  return {
    user: state.user,
    access: state.access,
  }
}
