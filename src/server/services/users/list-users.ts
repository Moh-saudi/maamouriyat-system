import 'server-only'

import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type { V2AuthorizationSnapshot } from '@/server/authorization/types'
import type { V2AuthenticatedUser } from '@/server/auth/types'
import type { V2OrganizationFact } from '@/server/authorization/scope-types'
import { getV2PermissionSourceAnchors } from '@/server/authorization/scope-evaluator'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 50

export type V2UserListItem = {
  id: string
  fullName: string
  email: string | null
  jobTitle: string | null
  orgLevel: number
  isActive: boolean
  organizationId: string | null
  organizationName: string
  governorate: string | null
  roleCodes: string[]
  roleNames: string[]
}

export type V2UsersPageResult = {
  items: V2UserListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type OrgRow = {
  id: string
  parent_id: string | null
  sector_id: string | null
  governorate: string | null
  level: number
  organization_type_code: string | null
}

function collectDescendants(
  anchorId: string,
  organizations: readonly OrgRow[]
): string[] {
  const byParent = new Map<string, string[]>()

  for (const organization of organizations) {
    if (!organization.parent_id) continue
    const children = byParent.get(organization.parent_id) ?? []
    children.push(organization.id)
    byParent.set(organization.parent_id, children)
  }

  const result = new Set<string>([anchorId])
  const queue = [anchorId]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue

    for (const child of byParent.get(current) ?? []) {
      if (result.has(child)) continue
      result.add(child)
      queue.push(child)
    }
  }

  return [...result]
}

async function buildUserScopeFilter(input: {
  user: V2AuthenticatedUser
  snapshot: V2AuthorizationSnapshot
}): Promise<{
  national: boolean
  sectorIds: string[]
  organizationIds: string[]
  selfOnlyIds: string[]
}> {
  const permission = input.snapshot.permissions['users.view']

  if (!permission?.granted || permission.deniedByUserOverride) {
    return {
      national: false,
      sectorIds: [],
      organizationIds: [],
      selfOnlyIds: [],
    }
  }

  const admin = getAdminSupabaseClient()
  const organizationSources = permission.sources.filter((source) =>
    ['organization', 'organization_tree', 'governorate', 'sector'].includes(
      source.scopeType
    )
  )

  let organizations: OrgRow[] = []

  if (organizationSources.length > 0) {
    const { data, error } = await admin
      .from('organizations')
      .select('id, parent_id, sector_id, governorate, level, organization_type_code')

    if (error) {
      throw new Error(
        `[Users List] Failed to load organization scope: ${error.message}`
      )
    }

    organizations = (data ?? []) as OrgRow[]
  }

  const byId = new Map(organizations.map((org) => [org.id, org]))
  const organizationFacts = new Map<string, V2OrganizationFact>(
    organizations.map((organization) => [
      organization.id,
      {
        id: organization.id,
        parentId: organization.parent_id,
        sectorId: organization.sector_id,
        governorate: organization.governorate,
        level: organization.level,
        organizationTypeCode: organization.organization_type_code,
      },
    ])
  )
  const sectorIds = new Set<string>()
  const organizationIds = new Set<string>()
  const selfOnlyIds = new Set<string>()

  for (const source of permission.sources) {
    if (source.scopeType === 'national') {
      return {
        national: true,
        sectorIds: [],
        organizationIds: [],
        selfOnlyIds: [],
      }
    }

    if (source.scopeType === 'self' || source.scopeType === 'assigned') {
      selfOnlyIds.add(input.user.profileId)
      continue
    }

    const anchors = getV2PermissionSourceAnchors({
      source,
      roles: input.snapshot.roles,
      userOrganizationId: input.user.organizationId,
      organizationFacts,
    })

    for (const anchor of anchors) {
      const anchorOrg = byId.get(anchor)
      if (!anchorOrg) continue

      if (source.scopeType === 'sector') {
        const sectorId =
          anchorOrg.organization_type_code === 'sector'
            ? anchorOrg.id
            : anchorOrg.sector_id
        if (sectorId) sectorIds.add(sectorId)
        continue
      }

      if (source.scopeType === 'organization') {
        organizationIds.add(anchor)
        continue
      }

      if (source.scopeType === 'organization_tree') {
        for (const id of collectDescendants(anchor, organizations)) {
          organizationIds.add(id)
        }
        continue
      }

      if (source.scopeType === 'governorate' && anchorOrg.governorate) {
        for (const organization of organizations) {
          if (organization.governorate === anchorOrg.governorate) {
            organizationIds.add(organization.id)
          }
        }
      }
    }
  }

  return {
    national: false,
    sectorIds: [...sectorIds],
    organizationIds: [...organizationIds],
    selfOnlyIds: [...selfOnlyIds],
  }
}

function sanitizeSearch(value: string): string {
  return value.replace(/[%_,()]/g, ' ').trim().slice(0, 100)
}

export async function listV2Users(input: {
  user: V2AuthenticatedUser
  snapshot: V2AuthorizationSnapshot
  page?: number
  pageSize?: number
  search?: string
}): Promise<V2UsersPageResult> {
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE))
  )
  const offset = (page - 1) * pageSize
  const search = sanitizeSearch(input.search ?? '')

  const scope = await buildUserScopeFilter({
    user: input.user,
    snapshot: input.snapshot,
  })

  if (
    !scope.national &&
    scope.sectorIds.length === 0 &&
    scope.organizationIds.length === 0 &&
    scope.selfOnlyIds.length === 0
  ) {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      totalPages: 0,
    }
  }

  const admin = getAdminSupabaseClient()
  let query = admin
    .from('users')
    .select(
      'id, full_name, email, job_title, org_level, level, is_active, organization_id, organization:organization_id(id, name, governorate)',
      { count: 'exact' }
    )
    .order('full_name', { ascending: true })
    .range(offset, offset + pageSize - 1)

  if (!scope.national) {
    const clauses: string[] = []

    if (scope.sectorIds.length > 0) {
      clauses.push(`sector_id.in.(${scope.sectorIds.join(',')})`)
    }

    if (scope.organizationIds.length > 0) {
      clauses.push(
        `organization_id.in.(${scope.organizationIds.join(',')})`
      )
    }

    if (scope.selfOnlyIds.length > 0) {
      clauses.push(`id.in.(${scope.selfOnlyIds.join(',')})`)
    }

    query = query.or(clauses.join(','))
  }

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,email.ilike.%${search}%,job_title.ilike.%${search}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(`[Users List] Failed to list users: ${error.message}`)
  }

  const rows = data ?? []
  const userIds = rows.map((row) => String(row.id))

  const roleNamesByUser = new Map<
    string,
    { codes: string[]; names: string[] }
  >()

  if (userIds.length > 0) {
    const nowIso = new Date().toISOString()
    const { data: assignments, error: assignmentsError } = await admin
      .from('user_roles')
      .select('user_id, role_id, valid_until')
      .in('user_id', userIds)
      .eq('is_active', true)
      .or(`valid_until.is.null,valid_until.gt.${nowIso}`)

    if (assignmentsError) {
      throw new Error(
        `[Users List] Failed to load role assignments: ${assignmentsError.message}`
      )
    }

    const roleIds = [
      ...new Set((assignments ?? []).map((row) => String(row.role_id))),
    ]

    const roleById = new Map<string, { code: string; name: string }>()

    if (roleIds.length > 0) {
      const { data: roles, error: rolesError } = await admin
        .from('roles')
        .select('id, code, name_ar')
        .in('id', roleIds)
        .eq('is_active', true)

      if (rolesError) {
        throw new Error(
          `[Users List] Failed to load role names: ${rolesError.message}`
        )
      }

      for (const role of roles ?? []) {
        roleById.set(String(role.id), {
          code: String(role.code),
          name: String(role.name_ar),
        })
      }
    }

    for (const assignment of assignments ?? []) {
      const role = roleById.get(String(assignment.role_id))
      if (!role) continue

      const userId = String(assignment.user_id)
      const current = roleNamesByUser.get(userId) ?? {
        codes: [],
        names: [],
      }

      if (!current.codes.includes(role.code)) current.codes.push(role.code)
      if (!current.names.includes(role.name)) current.names.push(role.name)
      roleNamesByUser.set(userId, current)
    }
  }

  const items: V2UserListItem[] = rows.map((row) => {
    const organization = Array.isArray(row.organization)
      ? row.organization[0]
      : row.organization
    const roles = roleNamesByUser.get(String(row.id))

    return {
      id: String(row.id),
      fullName: String(row.full_name || 'مستخدم'),
      email: row.email ? String(row.email) : null,
      jobTitle: row.job_title ? String(row.job_title) : null,
      orgLevel: Number(row.org_level ?? row.level ?? 7),
      isActive: row.is_active === true,
      organizationId: row.organization_id ? String(row.organization_id) : null,
      organizationName: organization?.name
        ? String(organization.name)
        : 'جهة غير محددة',
      governorate: organization?.governorate
        ? String(organization.governorate)
        : null,
      roleCodes: roles?.codes ?? [],
      roleNames: roles?.names ?? [],
    }
  })

  const total = count ?? 0

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  }
}
