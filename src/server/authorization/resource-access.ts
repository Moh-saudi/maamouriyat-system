import 'server-only'

import type { V2AuthenticatedUser } from '@/server/auth/types'
import type { V2AuthorizationSnapshot } from './types'
import { hasV2Permission } from './evaluator'
import { loadV2ScopeOrganizationFacts } from './scope-context'
import { evaluateV2ResourceScope } from './scope-evaluator'
import type { V2ResourceScopeContext, V2ScopeDecision } from './scope-types'

/**
 * Canonical server-side permission + resource-scope check for an already resolved
 * V2 access context.
 *
 * Callers MUST build resource context from trusted database rows. Never pass
 * organization/user IDs from request payloads directly into this function.
 */
export async function checkV2ResourceAccess(input: {
  user: V2AuthenticatedUser
  snapshot: V2AuthorizationSnapshot
  permissionKey: string
  resource: V2ResourceScopeContext
}): Promise<V2ScopeDecision> {
  const { user, snapshot, permissionKey, resource } = input

  if (!hasV2Permission(snapshot, permissionKey)) {
    return { allowed: false, reason: 'permission_not_granted' }
  }

  const organizationFacts = await loadV2ScopeOrganizationFacts({
    user,
    snapshot,
    permissionKey,
    resource,
  })

  return evaluateV2ResourceScope({
    user,
    snapshot,
    permissionKey,
    resource,
    organizationFacts,
  })
}
