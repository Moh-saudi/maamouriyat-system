import 'server-only'

import type { V2AuthenticatedUser } from '@/server/auth/types'
import type { V2AuthorizationSnapshot } from './types'
import { loadV2OrganizationFacts } from './organization-scope-repository'
import type {
  V2OrganizationFact,
  V2ResourceScopeContext,
} from './scope-types'

/**
 * Loads only organization facts needed for one resource authorization check:
 * the resource org plus role/user anchors and their ancestor chains.
 */
export async function loadV2ScopeOrganizationFacts(input: {
  user: V2AuthenticatedUser
  snapshot: V2AuthorizationSnapshot
  permissionKey: string
  resource: V2ResourceScopeContext
}): Promise<Map<string, V2OrganizationFact>> {
  const { user, snapshot, permissionKey, resource } = input
  const permission = snapshot.permissions[permissionKey]

  if (!permission?.granted) return new Map()

  const ids = new Set<string>()

  if (resource.organizationId) ids.add(resource.organizationId)
  if (user.organizationId) ids.add(user.organizationId)

  for (const source of permission.sources) {
    if (source.kind !== 'role') continue

    for (const assignment of snapshot.roles) {
      if (assignment.roleId !== source.roleId) continue
      if (assignment.assignmentOrganizationId) {
        ids.add(assignment.assignmentOrganizationId)
      }
    }
  }

  if (ids.size === 0) return new Map()
  return loadV2OrganizationFacts([...ids])
}
