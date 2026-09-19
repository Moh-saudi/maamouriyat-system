import type { V2AuthenticatedUser } from '@/server/auth/types'
import type {
  V2AuthorizationSnapshot,
  V2PermissionSource,
  V2RoleAssignment,
  V2ScopeType,
} from './types'
import {
  getOrganizationGovernorate,
  getOrganizationSectorId,
  isOrganizationWithinTree,
} from './organization-scope-repository'
import type {
  V2OrganizationFact,
  V2ResourceScopeContext,
  V2ScopeDecision,
} from './scope-types'

function getRoleAssignmentsForSource(
  roles: readonly V2RoleAssignment[],
  source: V2PermissionSource
): readonly V2RoleAssignment[] {
  if (source.kind !== 'role') return []
  return roles.filter((role) => role.roleId === source.roleId)
}

const INFORMATION_CENTER_EXACT_ASSIGNMENT_PERMISSIONS = new Set([
  'violations.view',
  'violations.correct',
])

const INFORMATION_CENTER_MINISTRY_FALLBACK_BLOCKED_TYPES = new Set([
  'sector',
  'central_administration',
  'general_administration',
])

function resolveInformationCenterAnchor(input: {
  assignmentOrganizationId: string
  facts: ReadonlyMap<string, V2OrganizationFact>
}): string | null {
  const { assignmentOrganizationId, facts } = input

  let currentId: string | null = assignmentOrganizationId
  let crossedCentralBranch = false
  const visited = new Set<string>()

  while (currentId) {
    if (visited.has(currentId)) return null
    visited.add(currentId)

    const fact = facts.get(currentId)
    if (!fact) return null

    const organizationTypeCode = fact.organizationTypeCode

    if (
      organizationTypeCode === 'health_directorate' ||
      organizationTypeCode === 'health_administration'
    ) {
      return fact.id
    }

    if (organizationTypeCode === 'ministry') {
      // Ministry scope is allowed only when the Information Center assignment
      // genuinely belongs to the ministry branch. Never climb through a
      // sector/central/general-administration branch into national scope.
      if (
        currentId !== assignmentOrganizationId &&
        crossedCentralBranch
      ) {
        return null
      }

      return fact.id
    }

    if (
      organizationTypeCode &&
      INFORMATION_CENTER_MINISTRY_FALLBACK_BLOCKED_TYPES.has(
        organizationTypeCode
      )
    ) {
      crossedCentralBranch = true
    }

    currentId = fact.parentId
  }

  return null
}

export function getV2PermissionSourceAnchors(input: {
  source: V2PermissionSource
  roles: readonly V2RoleAssignment[]
  userOrganizationId: string | null
  organizationFacts: ReadonlyMap<string, V2OrganizationFact>
  permissionKey?: string
}): string[] {
  const {
    source,
    roles,
    userOrganizationId,
    organizationFacts,
    permissionKey,
  } = input

  if (source.kind === 'user_override') {
    return userOrganizationId ? [userOrganizationId] : []
  }

  const anchors = getRoleAssignmentsForSource(roles, source).flatMap(
    (assignment) => {
      const assignmentOrganizationId =
        assignment.assignmentOrganizationId ?? userOrganizationId

      if (!assignmentOrganizationId) return []

      if (assignment.roleCode !== 'information_center') {
        return [assignmentOrganizationId]
      }

      if (
        permissionKey &&
        INFORMATION_CENTER_EXACT_ASSIGNMENT_PERMISSIONS.has(permissionKey)
      ) {
        return [assignmentOrganizationId]
      }

      const resolvedAnchor = resolveInformationCenterAnchor({
        assignmentOrganizationId,
        facts: organizationFacts,
      })

      return resolvedAnchor ? [resolvedAnchor] : []
    }
  )

  return [...new Set(anchors)]
}

function isSelfMatch(
  user: V2AuthenticatedUser,
  resource: V2ResourceScopeContext
): boolean {
  return Boolean(resource.ownerUserId && resource.ownerUserId === user.profileId)
}

function isAssignedMatch(
  user: V2AuthenticatedUser,
  resource: V2ResourceScopeContext
): boolean {
  return resource.assignedUserIds?.includes(user.profileId) === true
}

function matchOrganizationScope(input: {
  scopeType: V2ScopeType
  anchorOrganizationId: string
  resource: V2ResourceScopeContext
  facts: ReadonlyMap<string, V2OrganizationFact>
}): boolean {
  const { scopeType, anchorOrganizationId, resource, facts } = input

  if (scopeType === 'organization') {
    return resource.organizationId === anchorOrganizationId
  }

  if (scopeType === 'organization_tree') {
    if (!resource.organizationId) return false

    return isOrganizationWithinTree({
      resourceOrganizationId: resource.organizationId,
      anchorOrganizationId,
      facts,
    })
  }

  if (scopeType === 'governorate') {
    const anchorGovernorate = getOrganizationGovernorate(anchorOrganizationId, facts)
    const resourceGovernorate =
      resource.governorate ??
      (resource.organizationId
        ? getOrganizationGovernorate(resource.organizationId, facts)
        : null)

    return Boolean(
      anchorGovernorate &&
        resourceGovernorate &&
        anchorGovernorate === resourceGovernorate
    )
  }

  if (scopeType === 'sector') {
    const anchorSectorId = getOrganizationSectorId(anchorOrganizationId, facts)
    const resourceSectorId =
      resource.sectorId ??
      (resource.organizationId
        ? getOrganizationSectorId(resource.organizationId, facts)
        : null)

    return Boolean(
      anchorSectorId && resourceSectorId && anchorSectorId === resourceSectorId
    )
  }

  return false
}

/**
 * Evaluates a single already-loaded resource against a granted permission.
 *
 * Resource context MUST be constructed from server-trusted DB rows, never from
 * browser-supplied organization/user identifiers.
 */
export function evaluateV2ResourceScope(input: {
  user: V2AuthenticatedUser
  snapshot: V2AuthorizationSnapshot
  permissionKey: string
  resource: V2ResourceScopeContext
  organizationFacts: ReadonlyMap<string, V2OrganizationFact>
}): V2ScopeDecision {
  const { user, snapshot, permissionKey, resource, organizationFacts } = input
  const permission = snapshot.permissions[permissionKey]

  if (!permission?.granted || permission.deniedByUserOverride) {
    return { allowed: false, reason: 'permission_not_granted' }
  }

  for (const source of permission.sources) {
    const scopeType = source.scopeType

    if (scopeType === 'national') {
      return {
        allowed: true,
        match: {
          scopeType,
          source,
          anchorOrganizationId: null,
        },
      }
    }

    if (scopeType === 'self' && isSelfMatch(user, resource)) {
      return {
        allowed: true,
        match: {
          scopeType,
          source,
          anchorOrganizationId: user.organizationId,
        },
      }
    }

    if (scopeType === 'assigned' && isAssignedMatch(user, resource)) {
      return {
        allowed: true,
        match: {
          scopeType,
          source,
          anchorOrganizationId: user.organizationId,
        },
      }
    }

    const anchors = getV2PermissionSourceAnchors({
      source,
      roles: snapshot.roles,
      userOrganizationId: user.organizationId,
      organizationFacts,
      permissionKey,
    })

    for (const anchorOrganizationId of anchors) {
      if (
        matchOrganizationScope({
          scopeType,
          anchorOrganizationId,
          resource,
          facts: organizationFacts,
        })
      ) {
        return {
          allowed: true,
          match: {
            scopeType,
            source,
            anchorOrganizationId,
          },
        }
      }
    }
  }

  const requiresOrganization = permission.sources.some((source) =>
    ['organization', 'organization_tree', 'governorate', 'sector'].includes(
      source.scopeType
    )
  )

  if (
    requiresOrganization &&
    !resource.organizationId &&
    !resource.sectorId &&
    !resource.governorate
  ) {
    return { allowed: false, reason: 'missing_resource_context' }
  }

  return { allowed: false, reason: 'no_scope_source_matched' }
}
