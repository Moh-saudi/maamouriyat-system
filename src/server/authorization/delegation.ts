import type {
  V2AuthorizationSnapshot,
  V2ScopeType,
} from './types'

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
