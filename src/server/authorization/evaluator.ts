import type {
  V2AuthorizationSnapshot,
  V2EffectivePermission,
  V2RoleAssignment,
  V2RolePermissionGrant,
  V2ScopeType,
  V2UserPermissionOverride,
} from './types'

function pushUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value)
}

function createPermission(permissionKey: string): V2EffectivePermission {
  return {
    permissionKey,
    granted: false,
    scopes: [],
    deniedByUserOverride: false,
    sourceRoleIds: [],
    allowedByUserOverride: false,
    sources: [],
  }
}

/**
 * Pure V2 RBAC evaluator.
 *
 * Semantics:
 * - Active/valid role filtering happens in the repository.
 * - Multiple role grants are a union.
 * - User ALLOW adds its explicit scope.
 * - Explicit active user DENY wins over every role/ALLOW source.
 * - Scope containment is intentionally NOT evaluated here. Phase 3D resolves
 *   whether a concrete resource is inside any granted scope.
 */
export function evaluateV2Authorization(input: {
  profileId: string
  roles: V2RoleAssignment[]
  grants: V2RolePermissionGrant[]
  overrides: V2UserPermissionOverride[]
}): V2AuthorizationSnapshot {
  const permissions: Record<string, V2EffectivePermission> = {}
  const activeRoleIds = new Set(input.roles.map((role) => role.roleId))

  for (const grant of input.grants) {
    if (!activeRoleIds.has(grant.roleId)) continue

    const permission =
      permissions[grant.permissionKey] ?? createPermission(grant.permissionKey)

    permission.granted = true
    pushUnique(permission.scopes, grant.scopeType)
    pushUnique(permission.sourceRoleIds, grant.roleId)
    if (
      !permission.sources.some(
        (source) =>
          source.kind === 'role' &&
          source.roleId === grant.roleId &&
          source.scopeType === grant.scopeType
      )
    ) {
      permission.sources.push({
        kind: 'role',
        roleId: grant.roleId,
        scopeType: grant.scopeType,
      })
    }
    permissions[grant.permissionKey] = permission
  }

  for (const override of input.overrides) {
    const permission =
      permissions[override.permissionKey] ?? createPermission(override.permissionKey)

    if (override.effect === 'deny') {
      permission.granted = false
      permission.scopes = []
      permission.deniedByUserOverride = true
      permission.allowedByUserOverride = false
      permission.sources = []
      permissions[override.permissionKey] = permission
      continue
    }

    if (permission.deniedByUserOverride) {
      permissions[override.permissionKey] = permission
      continue
    }

    if (override.scopeType) {
      permission.granted = true
      permission.allowedByUserOverride = true
      pushUnique(permission.scopes, override.scopeType)
      if (
        !permission.sources.some(
          (source) =>
            source.kind === 'user_override' &&
            source.scopeType === override.scopeType
        )
      ) {
        permission.sources.push({
          kind: 'user_override',
          scopeType: override.scopeType,
        })
      }
    }

    permissions[override.permissionKey] = permission
  }

  return {
    profileId: input.profileId,
    roles: input.roles,
    permissions,
  }
}

export function hasV2Permission(
  snapshot: V2AuthorizationSnapshot,
  permissionKey: string
): boolean {
  return snapshot.permissions[permissionKey]?.granted === true
}

export function getV2PermissionScopes(
  snapshot: V2AuthorizationSnapshot,
  permissionKey: string
): readonly V2ScopeType[] {
  const permission = snapshot.permissions[permissionKey]
  return permission?.granted ? permission.scopes : []
}
