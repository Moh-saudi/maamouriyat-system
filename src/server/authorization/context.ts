import 'server-only'

import { getV2AuthState } from '@/server/auth/context'
import type { V2AccessState } from './types'
import { loadV2AuthorizationSnapshot } from './repository'

/**
 * Canonical V2 authentication + authorization entry point.
 *
 * Important:
 * - Identity comes ONLY from verified server auth state.
 * - profileId is never accepted from a browser/client argument.
 * - Forced-password users do not receive an application authorization context.
 * - RBAC storage/query failures fail closed.
 */
export async function getV2AccessState(): Promise<V2AccessState> {
  const auth = await getV2AuthState()

  if (auth.status !== 'authenticated') {
    return auth
  }

  if (auth.user.mustChangePassword) {
    return { status: 'password_change_required' }
  }

  try {
    const access = await loadV2AuthorizationSnapshot(auth.user.profileId)

    return {
      status: 'authorized',
      user: auth.user,
      access,
    }
  } catch (error) {
    console.error('[V2 Authorization] Failed to resolve effective access:', error)
    return { status: 'authorization_unavailable' }
  }
}
