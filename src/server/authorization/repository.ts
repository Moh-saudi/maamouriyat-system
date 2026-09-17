import 'server-only'

import { getAdminSupabaseClient } from '@/server/supabase/admin'
import { evaluateV2Authorization } from './evaluator'
import type {
  V2AuthorizationSnapshot,
  V2RoleAssignment,
  V2RolePermissionGrant,
  V2ScopeType,
  V2UserPermissionOverride,
} from './types'

const VALID_SCOPES = new Set<V2ScopeType>([
  'self',
  'assigned',
  'organization',
  'organization_tree',
  'governorate',
  'sector',
  'national',
])

function isScopeType(value: unknown): value is V2ScopeType {
  return typeof value === 'string' && VALID_SCOPES.has(value as V2ScopeType)
}

/**
 * Loads authorization data for ONE already-authenticated profile.
 *
 * The service-role client is intentionally hidden behind this server-only module.
 * Callers must establish identity via getV2AuthState() before passing profileId.
 */
export async function loadV2AuthorizationSnapshot(
  profileId: string
): Promise<V2AuthorizationSnapshot> {
  const admin = getAdminSupabaseClient()
  const nowIso = new Date().toISOString()

  const { data: assignmentRows, error: assignmentsError } = await admin
    .from('user_roles')
    .select('id, role_id, assignment_org_id, valid_from, valid_until')
    .eq('user_id', profileId)
    .eq('is_active', true)
    .lte('valid_from', nowIso)
    .or(`valid_until.is.null,valid_until.gt.${nowIso}`)

  if (assignmentsError) {
    throw new Error(
      `[V2 Authorization] Failed to load role assignments: ${assignmentsError.message}`
    )
  }

  const assignmentList = assignmentRows ?? []
  if (assignmentList.length === 0) {
    return evaluateV2Authorization({
      profileId,
      roles: [],
      grants: [],
      overrides: await loadOverrides(profileId),
    })
  }

  const uniqueRoleIds = [...new Set(assignmentList.map((row) => String(row.role_id)))]

  const { data: roleRows, error: rolesError } = await admin
    .from('roles')
    .select('id, code, is_active')
    .in('id', uniqueRoleIds)
    .eq('is_active', true)

  if (rolesError) {
    throw new Error(`[V2 Authorization] Failed to load roles: ${rolesError.message}`)
  }

  const roleById = new Map(
    (roleRows ?? []).map((role) => [
      String(role.id),
      {
        id: String(role.id),
        code: String(role.code),
      },
    ])
  )

  const roles: V2RoleAssignment[] = assignmentList.flatMap((assignment) => {
    const role = roleById.get(String(assignment.role_id))
    if (!role) return []

    return [
      {
        assignmentId: String(assignment.id),
        roleId: role.id,
        roleCode: role.code,
        assignmentOrganizationId: assignment.assignment_org_id
          ? String(assignment.assignment_org_id)
          : null,
        validFrom: String(assignment.valid_from),
        validUntil: assignment.valid_until ? String(assignment.valid_until) : null,
      },
    ]
  })

  const activeRoleIds = [...new Set(roles.map((role) => role.roleId))]
  const grants = await loadGrants(activeRoleIds)
  const overrides = await loadOverrides(profileId)

  return evaluateV2Authorization({
    profileId,
    roles,
    grants,
    overrides,
  })
}

async function loadGrants(roleIds: string[]): Promise<V2RolePermissionGrant[]> {
  if (roleIds.length === 0) return []

  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('role_permission_grants')
    .select('role_id, permission_key, scope_type')
    .in('role_id', roleIds)

  if (error) {
    throw new Error(`[V2 Authorization] Failed to load role grants: ${error.message}`)
  }

  return (data ?? []).flatMap((row) => {
    if (!isScopeType(row.scope_type)) {
      throw new Error(
        `[V2 Authorization] Invalid scope_type for permission ${String(row.permission_key)}`
      )
    }

    return [
      {
        roleId: String(row.role_id),
        permissionKey: String(row.permission_key),
        scopeType: row.scope_type,
      },
    ]
  })
}

async function loadOverrides(profileId: string): Promise<V2UserPermissionOverride[]> {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('user_permission_overrides')
    .select('permission_key, effect, scope_type')
    .eq('user_id', profileId)
    .eq('is_active', true)

  if (error) {
    throw new Error(
      `[V2 Authorization] Failed to load user permission overrides: ${error.message}`
    )
  }

  return (data ?? []).map((row) => {
    const effect = row.effect === 'deny' ? 'deny' : row.effect === 'allow' ? 'allow' : null
    if (!effect) {
      throw new Error(
        `[V2 Authorization] Invalid override effect for permission ${String(row.permission_key)}`
      )
    }

    if (row.scope_type !== null && !isScopeType(row.scope_type)) {
      throw new Error(
        `[V2 Authorization] Invalid override scope for permission ${String(row.permission_key)}`
      )
    }

    return {
      permissionKey: String(row.permission_key),
      effect,
      scopeType: row.scope_type as V2ScopeType | null,
    }
  })
}
