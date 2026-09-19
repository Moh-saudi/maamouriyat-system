import type {
  V2AuthorizationSnapshot,
  V2ScopeType,
} from './types'

const CORRECTION_UNIT_SYSTEM_ROLES = new Set([
  'correction_unit_manager',
  'correction_unit_member',
])

const INFORMATION_CENTER_DELEGABLE_SYSTEM_ROLES = new Set([
  'sector_manager',
  'central_admin_manager',
  'general_admin_manager',
  'directorate_manager',
  'health_admin_manager',
  'information_center',
  'correction_unit_manager',
  'correction_unit_member',
  'field_inspector',
])

export function canDelegateV2PermissionGrant(input: {
  snapshot: V2AuthorizationSnapshot
  permissionKey: string
  requestedScope: V2ScopeType
}): boolean {
  const permission = input.snapshot.permissions[input.permissionKey]

  if (!permission?.granted || permission.deniedByUserOverride) {
    return false
  }

  return permission.sources.some((source) => {
    if (source.scopeType === 'national') return true
    return source.scopeType === input.requestedScope
  })
}

export function canDelegateV2RoleGrants(input: {
  snapshot: V2AuthorizationSnapshot
  grants: readonly {
    permissionKey: string
    scopeType: V2ScopeType
  }[]
}): boolean {
  return input.grants.every((grant) =>
    canDelegateV2PermissionGrant({
      snapshot: input.snapshot,
      permissionKey: grant.permissionKey,
      requestedScope: grant.scopeType,
    })
  )
}

export function canDelegateV2UserRole(input: {
  snapshot: V2AuthorizationSnapshot
  roleCode: string
  isSystemRole: boolean
  grants: readonly {
    permissionKey: string
    scopeType: V2ScopeType
  }[]
}): boolean {
  const callerRoleCodes = new Set(
    input.snapshot.roles.map((role) => role.roleCode)
  )
  const isInformationCenter = callerRoleCodes.has('information_center')
  const isSystemAccountProvisioner =
    callerRoleCodes.has('system_superadmin') ||
    callerRoleCodes.has('system_techadmin')

  // System account administrators may provision generic correction roles
  // without receiving the correction permissions themselves.
  if (
    isSystemAccountProvisioner &&
    input.isSystemRole &&
    CORRECTION_UNIT_SYSTEM_ROLES.has(input.roleCode)
  ) {
    return true
  }

  // Information Center is an account-support operator inside its resolved
  // organization scope. It may provision approved system work types without
  // inheriting their operational permissions itself. Target scope and
  // organization-role compatibility are enforced separately by user-roles.
  if (
    isInformationCenter &&
    input.isSystemRole &&
    INFORMATION_CENTER_DELEGABLE_SYSTEM_ROLES.has(input.roleCode)
  ) {
    return true
  }

  // Everyone else, and all custom roles, keep the strict anti-escalation rule:
  // you can only delegate grants/scopes you already possess.
  return canDelegateV2RoleGrants({
    snapshot: input.snapshot,
    grants: input.grants,
  })
}
