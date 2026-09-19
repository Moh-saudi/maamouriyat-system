import { NextResponse } from 'next/server'
import {
  evaluateV2ResourceScope,
  hasV2Permission,
} from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type {
  V2OrganizationFact,
  V2ResourceScopeContext,
} from '@/server/authorization/scope-types'

export type TargetFacility = {
  id: string
  name: string
  governorate?: string
  facility_type?: string
  health_admin?: string
  is_visited?: boolean
  visited_at?: string
  mission_id?: string
}

export type MissionTarget = {
  id: string
  title: string
  period_type: 'monthly' | 'quarterly' | 'custom'
  period_label: string
  start_date: string
  end_date: string
  target_missions: number
  scope_level: 'ministry' | 'sector' | 'governorate' | 'health_admin' | 'user'
  scope_name: string
  scope_id?: string
  target_type: 'aggregate' | 'specific_facilities'
  target_facilities: TargetFacility[]
  assigned_user_id?: string
  assigned_user_name?: string
  sector_id?: string
  sector_name?: string
  notes?: string
  status: 'active' | 'completed' | 'cancelled'
  created_by?: string
  created_by_name?: string
  created_at: string
  executed_missions?: number
  completion_rate?: number
}

type TargetRow = {
  id: string
  title: string
  period_type: 'monthly' | 'quarterly' | 'custom'
  period_label: string
  start_date: string
  end_date: string
  target_missions: number
  scope_level: 'ministry' | 'sector' | 'governorate' | 'health_admin' | 'user'
  scope_name: string
  scope_organization_id: string | null
  assigned_user_id: string | null
  sector_id: string | null
  target_type: 'aggregate' | 'specific_facilities'
  notes: string | null
  status: 'active' | 'completed' | 'cancelled'
  created_by: string
  created_at: string
  updated_at: string
}

type OrganizationRow = {
  id: string
  name: string
  parent_id: string | null
  sector_id: string | null
  governorate: string | null
  health_admin: string | null
  level: number
  organization_type_code: string | null
}

type UserRow = {
  id: string
  full_name: string
  job_title: string | null
  org_level: number | null
  organization_id: string | null
  sector_id: string | null
  is_active: boolean | null
}

type FacilityRow = {
  id: string
  name: string
  facility_type: string | null
  organization_id: string | null
  sector_id: string | null
  governorate: string | null
  health_admin: string | null
  is_active: boolean | null
}

type TargetScopeResolution = {
  scopeLevel: TargetRow['scope_level']
  scopeName: string
  scopeOrganizationId: string | null
  assignedUserId: string | null
  assignedUserName: string | null
  sectorId: string | null
  sectorName: string | null
  resource: V2ResourceScopeContext
}


const TARGET_EDITOR_PAGE_SIZE = 1000

async function loadAllActiveTargetUsers(): Promise<UserRow[]> {
  const admin = getAdminSupabaseClient()
  const rows: UserRow[] = []

  for (let from = 0; ; from += TARGET_EDITOR_PAGE_SIZE) {
    const { data, error } = await admin
      .from('users')
      .select(
        'id, full_name, job_title, org_level, organization_id, sector_id, is_active'
      )
      .eq('is_active', true)
      .order('full_name')
      .order('id')
      .range(from, from + TARGET_EDITOR_PAGE_SIZE - 1)

    if (error) {
      throw new Error(
        `Failed to load target users page: ${error.message}`
      )
    }

    const page = (data ?? []) as UserRow[]
    rows.push(...page)
    if (page.length < TARGET_EDITOR_PAGE_SIZE) break
  }

  return rows
}

async function loadAllActiveTargetFacilities(): Promise<FacilityRow[]> {
  const admin = getAdminSupabaseClient()
  const rows: FacilityRow[] = []

  for (let from = 0; ; from += TARGET_EDITOR_PAGE_SIZE) {
    const { data, error } = await admin
      .from('facilities')
      .select(
        'id, name, facility_type, organization_id, sector_id, governorate, health_admin, is_active'
      )
      .eq('is_active', true)
      .order('name')
      .order('id')
      .range(from, from + TARGET_EDITOR_PAGE_SIZE - 1)

    if (error) {
      throw new Error(
        `Failed to load target facilities page: ${error.message}`
      )
    }

    const page = (data ?? []) as FacilityRow[]
    rows.push(...page)
    if (page.length < TARGET_EDITOR_PAGE_SIZE) break
  }

  return rows
}

function toOrganizationFacts(
  organizations: readonly OrganizationRow[]
): Map<string, V2OrganizationFact> {
  return new Map(
    organizations.map((organization) => [
      organization.id,
      {
        id: organization.id,
        parentId: organization.parent_id,
        sectorId: organization.sector_id,
        governorate: organization.governorate,
        level: Number(organization.level),
        organizationTypeCode: organization.organization_type_code,
      },
    ])
  )
}

function targetResource(target: TargetRow): V2ResourceScopeContext {
  return {
    ownerUserId: target.created_by,
    assignedUserIds: target.assigned_user_id ? [target.assigned_user_id] : [],
    organizationId: target.scope_organization_id,
    sectorId: target.sector_id,
    governorate:
      target.scope_level === 'governorate' ? target.scope_name : null,
  }
}

function userResource(
  user: UserRow,
  organizations: ReadonlyMap<string, OrganizationRow>
): V2ResourceScopeContext {
  const organization = user.organization_id
    ? organizations.get(user.organization_id)
    : undefined

  return {
    assignedUserIds: [user.id],
    organizationId: user.organization_id,
    sectorId: user.sector_id ?? organization?.sector_id ?? null,
    governorate: organization?.governorate ?? null,
  }
}

function isAllowed(input: {
  user: Parameters<typeof evaluateV2ResourceScope>[0]['user']
  access: Parameters<typeof evaluateV2ResourceScope>[0]['snapshot']
  permissionKey: string
  resource: V2ResourceScopeContext
  organizationFacts: ReadonlyMap<string, V2OrganizationFact>
}): boolean {
  return evaluateV2ResourceScope({
    user: input.user,
    snapshot: input.access,
    permissionKey: input.permissionKey,
    resource: input.resource,
    organizationFacts: input.organizationFacts,
  }).allowed
}

async function loadOrganizations(): Promise<{
  list: OrganizationRow[]
  byId: Map<string, OrganizationRow>
  facts: Map<string, V2OrganizationFact>
}> {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('organizations')
    .select('id, name, parent_id, sector_id, governorate, health_admin, level, organization_type_code')

  if (error) {
    throw new Error(`Failed to load organizations: ${error.message}`)
  }

  const list = (data ?? []) as OrganizationRow[]
  return {
    list,
    byId: new Map(list.map((organization) => [organization.id, organization])),
    facts: toOrganizationFacts(list),
  }
}

async function loadUsersByIds(userIds: readonly string[]): Promise<Map<string, UserRow>> {
  if (userIds.length === 0) return new Map()

  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('users')
    .select('id, full_name, job_title, org_level, organization_id, sector_id, is_active')
    .in('id', [...new Set(userIds)])

  if (error) {
    throw new Error(`Failed to load target users: ${error.message}`)
  }

  return new Map(((data ?? []) as UserRow[]).map((user) => [user.id, user]))
}

async function loadFacilitiesByIds(
  facilityIds: readonly string[]
): Promise<Map<string, FacilityRow>> {
  if (facilityIds.length === 0) return new Map()

  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('facilities')
    .select('id, name, facility_type, organization_id, sector_id, governorate, health_admin, is_active')
    .in('id', [...new Set(facilityIds)])

  if (error) {
    throw new Error(`Failed to load target facilities: ${error.message}`)
  }

  return new Map(((data ?? []) as FacilityRow[]).map((facility) => [facility.id, facility]))
}

async function resolveTargetScope(
  body: Record<string, unknown>,
  organizations: {
    byId: ReadonlyMap<string, OrganizationRow>
  }
): Promise<TargetScopeResolution | null> {
  const admin = getAdminSupabaseClient()
  const scopeLevel =
    typeof body.scope_level === 'string' ? body.scope_level : ''

  if (
    !['ministry', 'sector', 'governorate', 'health_admin', 'user'].includes(
      scopeLevel
    )
  ) {
    return null
  }

  if (scopeLevel === 'ministry') {
    return {
      scopeLevel: 'ministry',
      scopeName: 'وزارة الصحة والسكان',
      scopeOrganizationId: null,
      assignedUserId: null,
      assignedUserName: null,
      sectorId: null,
      sectorName: null,
      resource: {},
    }
  }

  if (scopeLevel === 'user') {
    const userId =
      typeof body.assigned_user_id === 'string' ? body.assigned_user_id : ''
    if (!userId) return null

    const { data, error } = await admin
      .from('users')
      .select('id, full_name, job_title, org_level, organization_id, sector_id, is_active')
      .eq('id', userId)
      .maybeSingle()

    const targetUser = data as UserRow | null
    if (error || !targetUser || targetUser.is_active !== true) return null

    const organization = targetUser.organization_id
      ? organizations.byId.get(targetUser.organization_id)
      : undefined
    const sector = targetUser.sector_id
      ? organizations.byId.get(targetUser.sector_id)
      : undefined

    return {
      scopeLevel: 'user',
      scopeName: targetUser.full_name,
      scopeOrganizationId: targetUser.organization_id,
      assignedUserId: targetUser.id,
      assignedUserName: targetUser.full_name,
      sectorId: targetUser.sector_id ?? organization?.sector_id ?? null,
      sectorName: sector?.name ?? null,
      resource: userResource(targetUser, organizations.byId),
    }
  }

  const scopeIdCandidate =
    typeof body.scope_id === 'string'
      ? body.scope_id
      : typeof body.sector_id === 'string'
        ? body.sector_id
        : ''

  if (!scopeIdCandidate) return null

  const organization = organizations.byId.get(scopeIdCandidate)
  if (!organization) return null

  if (
    scopeLevel === 'sector' &&
    organization.organization_type_code !== 'sector'
  ) {
    return null
  }

  if (
    scopeLevel === 'governorate' &&
    organization.organization_type_code !== 'health_directorate'
  ) {
    return null
  }

  if (
    scopeLevel === 'health_admin' &&
    organization.organization_type_code !== 'health_administration'
  ) {
    return null
  }

  const sectorId =
    organization.organization_type_code === 'sector'
      ? organization.id
      : organization.sector_id

  const sector = sectorId ? organizations.byId.get(sectorId) : undefined

  return {
    scopeLevel: scopeLevel as 'sector' | 'governorate' | 'health_admin',
    scopeName:
      scopeLevel === 'governorate'
        ? organization.governorate ?? organization.name
        : scopeLevel === 'health_admin'
          ? organization.health_admin ?? organization.name
          : organization.name,
    scopeOrganizationId: organization.id,
    assignedUserId: null,
    assignedUserName: null,
    sectorId,
    sectorName: sector?.name ?? null,
    resource: {
      organizationId: organization.id,
      sectorId,
      governorate: organization.governorate,
    },
  }
}

async function loadTargetFacilities(
  targetIds: readonly string[]
): Promise<Map<string, TargetFacility[]>> {
  if (targetIds.length === 0) return new Map()

  const admin = getAdminSupabaseClient()
  const { data: links, error: linkError } = await admin
    .from('mission_target_facilities')
    .select('target_id, facility_id')
    .in('target_id', [...new Set(targetIds)])

  if (linkError) {
    throw new Error(`Failed to load target facilities: ${linkError.message}`)
  }

  const facilityIds = [...new Set((links ?? []).map((link) => String(link.facility_id)))]
  const facilities = await loadFacilitiesByIds(facilityIds)
  const result = new Map<string, TargetFacility[]>()

  for (const link of links ?? []) {
    const facility = facilities.get(String(link.facility_id))
    if (!facility) continue

    const targetId = String(link.target_id)
    const list = result.get(targetId) ?? []
    list.push({
      id: facility.id,
      name: facility.name,
      governorate: facility.governorate ?? undefined,
      facility_type: facility.facility_type ?? undefined,
      health_admin: facility.health_admin ?? undefined,
      is_visited: false,
    })
    result.set(targetId, list)
  }

  return result
}

async function enrichTargetExecution(
  target: MissionTarget
): Promise<{ executed: number; facilities: TargetFacility[] }> {
  const admin = getAdminSupabaseClient()
  const completedStatuses = [
    'completed',
    'closed',
    'done',
    'منفذة',
    'مكتملة',
    'مغلقة',
  ]

  // New V2 assignments persist the target that produced the mission.
  // This is the authoritative source for target achievement: a user's target
  // may include them as any team member (not necessarily assigned_user_id),
  // and a place target should not count unrelated missions in the same place.
  if (
    target.target_type === 'specific_facilities' &&
    target.target_facilities.length > 0
  ) {
    const facilityIds = new Set(
      target.target_facilities.map((facility) => facility.id)
    )

    const { data, error } = await admin
      .from('missions')
      .select(
        'id, target_facility_id, facility_id, scheduled_date, completed_at, status'
      )
      .eq('source_target_id', target.id)
      .in('status', completedStatuses)
      .gte('scheduled_date', target.start_date)
      .lte('scheduled_date', target.end_date)

    if (error) {
      console.error(
        '[mission-targets] linked facility metrics failed:',
        error.message
      )
      return { executed: 0, facilities: target.target_facilities }
    }

    const visited = new Map<
      string,
      { visited_at?: string; mission_id?: string }
    >()

    for (const mission of data ?? []) {
      const facilityId = String(
        mission.target_facility_id ?? mission.facility_id ?? ''
      )
      if (!facilityId || !facilityIds.has(facilityId)) continue

      visited.set(facilityId, {
        visited_at:
          mission.completed_at ?? mission.scheduled_date ?? undefined,
        mission_id: String(mission.id),
      })
    }

    const facilities = target.target_facilities.map((facility) => {
      const visit = visited.get(facility.id)
      return {
        ...facility,
        is_visited: Boolean(visit),
        visited_at: visit?.visited_at,
        mission_id: visit?.mission_id,
      }
    })

    return {
      executed: facilities.filter((facility) => facility.is_visited).length,
      facilities,
    }
  }

  const { count, error } = await admin
    .from('missions')
    .select('id', { count: 'exact', head: true })
    .eq('source_target_id', target.id)
    .in('status', completedStatuses)
    .gte('scheduled_date', target.start_date)
    .lte('scheduled_date', target.end_date)

  if (error) {
    console.error(
      '[mission-targets] linked aggregate metrics failed:',
      error.message
    )
    return { executed: 0, facilities: target.target_facilities }
  }

  return {
    executed: count ?? 0,
    facilities: target.target_facilities,
  }
}

function toApiTarget(
  row: TargetRow,
  facilities: TargetFacility[],
  users: ReadonlyMap<string, UserRow>,
  organizations: ReadonlyMap<string, OrganizationRow>
): MissionTarget {
  const assigned = row.assigned_user_id
    ? users.get(row.assigned_user_id)
    : undefined
  const creator = users.get(row.created_by)
  const sector = row.sector_id ? organizations.get(row.sector_id) : undefined

  return {
    id: row.id,
    title: row.title,
    period_type: row.period_type,
    period_label: row.period_label,
    start_date: row.start_date,
    end_date: row.end_date,
    target_missions: row.target_missions,
    scope_level: row.scope_level,
    scope_name: row.scope_name,
    scope_id: row.scope_organization_id ?? undefined,
    target_type: row.target_type,
    target_facilities: facilities,
    assigned_user_id: row.assigned_user_id ?? undefined,
    assigned_user_name: assigned?.full_name,
    sector_id: row.sector_id ?? undefined,
    sector_name: sector?.name,
    notes: row.notes ?? undefined,
    status: row.status,
    created_by: row.created_by,
    created_by_name: creator?.full_name,
    created_at: row.created_at,
  }
}

async function replaceFacilityLinks(
  targetId: string,
  facilityIds: readonly string[]
): Promise<void> {
  const admin = getAdminSupabaseClient()
  const { error } = await admin.rpc('replace_mission_target_facilities', {
    p_target_id: targetId,
    p_facility_ids: [...new Set(facilityIds)],
  })

  if (error) {
    throw new Error(`Failed to replace target facilities: ${error.message}`)
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const scopeFilter = searchParams.get('scope') || 'all'
    const statusFilter = searchParams.get('status') || 'all'
    const typeFilter = searchParams.get('type') || 'all'
    const reportMode = searchParams.get('report') === 'true'
    const workspaceMode = searchParams.get('workspace') === 'true'
    const forMission =
      searchParams.get('for_mission') === 'true' ||
      searchParams.get('all') === 'true'

    const permissionKey = reportMode ? 'targets.report' : 'targets.view'
    const gate = await requireV2Permission(permissionKey)
    if (!gate.ok) return gate.response

    const admin = getAdminSupabaseClient()
    const organizations = await loadOrganizations()

    let query = admin
      .from('mission_targets')
      .select('*')
      .order('created_at', { ascending: false })

    if (forMission) query = query.eq('status', 'active')
    else if (statusFilter !== 'all') query = query.eq('status', statusFilter)

    if (scopeFilter !== 'all') query = query.eq('scope_level', scopeFilter)
    if (typeFilter !== 'all') query = query.eq('target_type', typeFilter)

    const { data: rows, error } = await query
    if (error) {
      console.error('[mission-targets:GET] query failed:', error.message)
      return NextResponse.json({ error: 'تعذر تحميل المستهدفات' }, { status: 500 })
    }

    const targetRows = (rows ?? []) as TargetRow[]
    const visibleRows = targetRows.filter((target) =>
      isAllowed({
        user: gate.user,
        access: gate.access,
        permissionKey,
        resource: targetResource(target),
        organizationFacts: organizations.facts,
      })
    )

    const facilityLists = await loadTargetFacilities(
      visibleRows.map((target) => target.id)
    )

    const userIds = [
      ...visibleRows.map((target) => target.created_by),
      ...visibleRows
        .map((target) => target.assigned_user_id)
        .filter((value): value is string => Boolean(value)),
    ]
    const usersById = await loadUsersByIds(userIds)

    const apiTargets = visibleRows.map((target) =>
      toApiTarget(
        target,
        facilityLists.get(target.id) ?? [],
        usersById,
        organizations.byId
      )
    )

    const enriched = await Promise.all(
      apiTargets.map(async (target) => {
        const metrics = await enrichTargetExecution(target)
        return {
          ...target,
          target_facilities: metrics.facilities,
          executed_missions: metrics.executed,
          completion_rate: Math.min(
            100,
            Math.round(
              (metrics.executed / Math.max(1, target.target_missions)) * 100
            )
          ),
        }
      })
    )

    let users: UserRow[] = []
    let facilities: FacilityRow[] = []

    if (
      !workspaceMode &&
      hasV2Permission(gate.access, 'targets.create')
    ) {
      const [userRows, facilityRows] = await Promise.all([
        loadAllActiveTargetUsers(),
        loadAllActiveTargetFacilities(),
      ])

      users = userRows.filter((candidate) => {
        if (
          candidate.id !== gate.user.profileId &&
          candidate.org_level !== null &&
          candidate.org_level <= gate.user.orgLevel
        ) {
          return false
        }

        return isAllowed({
          user: gate.user,
          access: gate.access,
          permissionKey: 'targets.create',
          resource: userResource(candidate, organizations.byId),
          organizationFacts: organizations.facts,
        })
      })

      // Facilities are a ministry-wide shared inspection pool.
      // Organizational affiliation describes the facility; it is not an
      // authorization boundary for selecting an inspection target.
      facilities = facilityRows
    }

    let callerGov: string | null = null
    let callerHealthAdmin: string | null = null
    if (gate.user.organizationId) {
      const callerOrg = organizations.byId.get(gate.user.organizationId)
      callerGov = callerOrg?.governorate ?? null
      callerHealthAdmin = callerOrg?.health_admin ?? null
    }

    let report = null
    if (reportMode) {
      const totalTarget = enriched.reduce(
        (sum, target) => sum + target.target_missions,
        0
      )
      const totalExecuted = enriched.reduce(
        (sum, target) => sum + (target.executed_missions ?? 0),
        0
      )

      const byScope: Record<
        string,
        { target: number; executed: number; count: number }
      > = {}

      for (const target of enriched) {
        const key = target.scope_name || target.scope_level
        if (!byScope[key]) {
          byScope[key] = { target: 0, executed: 0, count: 0 }
        }

        byScope[key].target += target.target_missions
        byScope[key].executed += target.executed_missions ?? 0
        byScope[key].count += 1
      }

      const specificTargets = enriched.filter(
        (target) => target.target_type === 'specific_facilities'
      )
      const totalFacilitiesTargeted = specificTargets.reduce(
        (sum, target) => sum + target.target_facilities.length,
        0
      )
      const totalFacilitiesVisited = specificTargets.reduce(
        (sum, target) =>
          sum +
          target.target_facilities.filter((facility) => facility.is_visited)
            .length,
        0
      )

      report = {
        totalTarget,
        totalExecuted,
        overallRate: Math.min(
          100,
          Math.round((totalExecuted / Math.max(1, totalTarget)) * 100)
        ),
        specificTargetsCount: specificTargets.length,
        aggregateTargetsCount: enriched.length - specificTargets.length,
        totalFacilitiesTargeted,
        totalFacilitiesVisited,
        facilityCoverageRate:
          totalFacilitiesTargeted > 0
            ? Math.min(
                100,
                Math.round(
                  (totalFacilitiesVisited / totalFacilitiesTargeted) * 100
                )
              )
            : 100,
        byScope: Object.entries(byScope)
          .map(([name, value]) => ({
            name,
            target: value.target,
            executed: value.executed,
            rate: Math.min(
              100,
              Math.round(
                (value.executed / Math.max(1, value.target)) * 100
              )
            ),
            count: value.count,
          }))
          .sort((a, b) => b.executed - a.executed),
      }
    }

    return NextResponse.json({
      targets: enriched,
      users,
      facilities,
      callerLevel: gate.user.orgLevel,
      callerSectorId: gate.user.sectorId,
      callerGov,
      callerHealthAdmin,
      callerUserId: gate.user.profileId,
      callerName: gate.user.fullName,
      report,
    })
  } catch (error) {
    console.error('[mission-targets:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء تحميل المستهدفات' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('targets.create')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const startDate = typeof body.start_date === 'string' ? body.start_date : ''
    const endDate = typeof body.end_date === 'string' ? body.end_date : ''

    if (!title || !startDate || !endDate) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 })
    }

    const organizations = await loadOrganizations()
    const scope = await resolveTargetScope(body, organizations)
    if (!scope) {
      return NextResponse.json({ error: 'نطاق المستهدف غير صحيح' }, { status: 400 })
    }

    if (
      !isAllowed({
        user: gate.user,
        access: gate.access,
        permissionKey: 'targets.create',
        resource: scope.resource,
        organizationFacts: organizations.facts,
      })
    ) {
      return NextResponse.json(
        { error: 'لا يمكنك إنشاء مستهدف خارج نطاقك', code: 'SCOPE_DENIED' },
        { status: 403 }
      )
    }

    const targetType =
      body.target_type === 'specific_facilities'
        ? 'specific_facilities'
        : 'aggregate'

    const requestedFacilityIds = Array.isArray(body.target_facilities)
      ? body.target_facilities
          .map((facility) => {
            if (typeof facility === 'string') return facility
            if (
              facility &&
              typeof facility === 'object' &&
              'id' in facility &&
              typeof facility.id === 'string'
            ) {
              return facility.id
            }
            return ''
          })
          .filter(Boolean)
      : []

    const facilitiesById = await loadFacilitiesByIds(requestedFacilityIds)

    if (facilitiesById.size !== [...new Set(requestedFacilityIds)].length) {
      return NextResponse.json(
        { error: 'توجد منشأة غير صحيحة ضمن المستهدف' },
        { status: 400 }
      )
    }

    for (const facility of facilitiesById.values()) {
      if (facility.is_active !== true) {
        return NextResponse.json(
          { error: 'لا يمكن استهداف منشأة غير نشطة' },
          { status: 400 }
        )
      }
    }

    const requestedTargetCount = Number(body.target_missions)
    const targetMissions =
      targetType === 'specific_facilities' &&
      requestedFacilityIds.length > 0 &&
      (!Number.isFinite(requestedTargetCount) || requestedTargetCount <= 0)
        ? requestedFacilityIds.length
        : Math.max(1, Math.floor(requestedTargetCount || 1))

    const periodType =
      body.period_type === 'quarterly' || body.period_type === 'custom'
        ? body.period_type
        : 'monthly'

    const admin = getAdminSupabaseClient()
    const { data: inserted, error: insertError } = await admin
      .from('mission_targets')
      .insert({
        title,
        period_type: periodType,
        period_label:
          typeof body.period_label === 'string' && body.period_label.trim()
            ? body.period_label.trim()
            : title,
        start_date: startDate,
        end_date: endDate,
        target_missions: targetMissions,
        scope_level: scope.scopeLevel,
        scope_name: scope.scopeName,
        scope_organization_id: scope.scopeOrganizationId,
        assigned_user_id: scope.assignedUserId,
        sector_id: scope.sectorId,
        target_type: targetType,
        notes:
          typeof body.notes === 'string' ? body.notes.trim() || null : null,
        status: 'active',
        created_by: gate.user.profileId,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('[mission-targets:POST] insert failed:', insertError.message)
      return NextResponse.json({ error: 'تعذر حفظ المستهدف' }, { status: 500 })
    }

    const row = inserted as TargetRow

    try {
      await replaceFacilityLinks(row.id, requestedFacilityIds)
    } catch (linkError) {
      console.error('[mission-targets:POST] facility link failed:', linkError)
      await admin.from('mission_targets').delete().eq('id', row.id)
      return NextResponse.json(
        { error: 'تعذر حفظ منشآت المستهدف' },
        { status: 500 }
      )
    }

    const creatorMap = new Map<string, UserRow>([
      [
        gate.user.profileId,
        {
          id: gate.user.profileId,
          full_name: gate.user.fullName,
          job_title: gate.user.jobTitle,
          org_level: gate.user.orgLevel,
          organization_id: gate.user.organizationId,
          sector_id: gate.user.sectorId,
          is_active: true,
        },
      ],
    ])

    if (scope.assignedUserId && scope.assignedUserName) {
      creatorMap.set(scope.assignedUserId, {
        id: scope.assignedUserId,
        full_name: scope.assignedUserName,
        job_title: null,
        org_level: null,
        organization_id: scope.scopeOrganizationId,
        sector_id: scope.sectorId,
        is_active: true,
      })
    }

    const target = toApiTarget(
      row,
      [...facilitiesById.values()].map((facility) => ({
        id: facility.id,
        name: facility.name,
        governorate: facility.governorate ?? undefined,
        facility_type: facility.facility_type ?? undefined,
        health_admin: facility.health_admin ?? undefined,
        is_visited: false,
      })),
      creatorMap,
      organizations.byId
    )

    return NextResponse.json({ target })
  } catch (error) {
    console.error('[mission-targets:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء حفظ المستهدف' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const gate = await requireV2Permission('targets.edit')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const admin = getAdminSupabaseClient()
    const { data, error } = await admin
      .from('mission_targets')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'تعذر تحميل المستهدف' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 })
    }

    const current = data as TargetRow
    const organizations = await loadOrganizations()

    if (
      !isAllowed({
        user: gate.user,
        access: gate.access,
        permissionKey: 'targets.edit',
        resource: targetResource(current),
        organizationFacts: organizations.facts,
      })
    ) {
      return NextResponse.json(
        { error: 'لا يمكنك تعديل مستهدف خارج نطاقك', code: 'SCOPE_DENIED' },
        { status: 403 }
      )
    }

    if (
      'scope_level' in body ||
      'scope_id' in body ||
      'sector_id' in body ||
      'assigned_user_id' in body
    ) {
      return NextResponse.json(
        { error: 'تغيير نطاق المستهدف يتطلب إنشاء مستهدف جديد' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {}

    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim()
    }
    if (typeof body.period_label === 'string' && body.period_label.trim()) {
      updates.period_label = body.period_label.trim()
    }
    if (typeof body.start_date === 'string') updates.start_date = body.start_date
    if (typeof body.end_date === 'string') updates.end_date = body.end_date
    if (typeof body.notes === 'string') updates.notes = body.notes.trim() || null
    if (
      body.status === 'active' ||
      body.status === 'completed' ||
      body.status === 'cancelled'
    ) {
      updates.status = body.status
    }

    const targetMissions = Number(body.target_missions)
    if (Number.isFinite(targetMissions) && targetMissions > 0) {
      updates.target_missions = Math.floor(targetMissions)
    }

    let requestedFacilityIds: string[] | null = null

    if (Array.isArray(body.target_facilities)) {
      requestedFacilityIds = body.target_facilities
        .map((facility) => {
          if (typeof facility === 'string') return facility
          if (
            facility &&
            typeof facility === 'object' &&
            'id' in facility &&
            typeof facility.id === 'string'
          ) {
            return facility.id
          }
          return ''
        })
        .filter(Boolean)

      const facilitiesById = await loadFacilitiesByIds(requestedFacilityIds)

      if (facilitiesById.size !== [...new Set(requestedFacilityIds)].length) {
        return NextResponse.json(
          { error: 'توجد منشأة غير صحيحة ضمن المستهدف' },
          { status: 400 }
        )
      }

      for (const facility of facilitiesById.values()) {
        if (facility.is_active !== true) {
          return NextResponse.json(
            { error: 'لا يمكن استهداف منشأة غير نشطة' },
            { status: 400 }
          )
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await admin
        .from('mission_targets')
        .update(updates)
        .eq('id', id)

      if (updateError) {
        console.error('[mission-targets:PATCH] update failed:', updateError.message)
        return NextResponse.json({ error: 'تعذر تحديث المستهدف' }, { status: 500 })
      }
    }

    if (requestedFacilityIds) {
      await replaceFacilityLinks(id, requestedFacilityIds)
    }

    const { data: updated, error: reloadError } = await admin
      .from('mission_targets')
      .select('*')
      .eq('id', id)
      .single()

    if (reloadError) {
      return NextResponse.json({ error: 'تعذر إعادة تحميل المستهدف' }, { status: 500 })
    }

    const facilities = await loadTargetFacilities([id])
    const usersById = await loadUsersByIds([
      gate.user.profileId,
      ...((updated as TargetRow).assigned_user_id
        ? [(updated as TargetRow).assigned_user_id as string]
        : []),
    ])

    return NextResponse.json({
      target: toApiTarget(
        updated as TargetRow,
        facilities.get(id) ?? [],
        usersById,
        organizations.byId
      ),
    })
  } catch (error) {
    console.error('[mission-targets:PATCH] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء تحديث المستهدف' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const gate = await requireV2Permission('targets.delete')
    if (!gate.ok) return gate.response

    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const admin = getAdminSupabaseClient()
    const { data, error } = await admin
      .from('mission_targets')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'تعذر تحميل المستهدف' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 })
    }

    const target = data as TargetRow
    const organizations = await loadOrganizations()

    if (
      !isAllowed({
        user: gate.user,
        access: gate.access,
        permissionKey: 'targets.delete',
        resource: targetResource(target),
        organizationFacts: organizations.facts,
      })
    ) {
      return NextResponse.json(
        { error: 'لا يمكنك حذف مستهدف خارج نطاقك', code: 'SCOPE_DENIED' },
        { status: 403 }
      )
    }

    const { error: deleteError } = await admin
      .from('mission_targets')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[mission-targets:DELETE] delete failed:', deleteError.message)
      return NextResponse.json({ error: 'تعذر حذف المستهدف' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[mission-targets:DELETE] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء حذف المستهدف' },
      { status: 500 }
    )
  }
}
