export const V2_SCOPE_TYPES = [
  'self',
  'assigned',
  'organization',
  'organization_tree',
  'governorate',
  'sector',
  'national',
] as const

export type V2ScopeType = (typeof V2_SCOPE_TYPES)[number]

export type V2PermissionEffect = 'allow' | 'deny'

export interface V2RoleAssignment {
  assignmentId: string
  roleId: string
  roleCode: string
  assignmentOrganizationId: string | null
  validFrom: string
  validUntil: string | null
}

export interface V2RolePermissionGrant {
  roleId: string
  permissionKey: string
  scopeType: V2ScopeType
}

export interface V2UserPermissionOverride {
  permissionKey: string
  effect: V2PermissionEffect
  scopeType: V2ScopeType | null
}

export interface V2EffectivePermission {
  permissionKey: string
  granted: boolean
  scopes: V2ScopeType[]
  deniedByUserOverride: boolean
  sourceRoleIds: string[]
  allowedByUserOverride: boolean
}

export interface V2AuthorizationSnapshot {
  profileId: string
  roles: V2RoleAssignment[]
  permissions: Record<string, V2EffectivePermission>
}

export type V2AccessState =
  | { status: 'unauthenticated' }
  | { status: 'profile_missing' }
  | { status: 'inactive' }
  | { status: 'password_change_required' }
  | { status: 'authorization_unavailable' }
  | {
      status: 'authorized'
      user: import('@/server/auth/types').V2AuthenticatedUser
      access: V2AuthorizationSnapshot
    }
