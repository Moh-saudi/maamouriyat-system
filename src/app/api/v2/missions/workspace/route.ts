import { NextResponse } from 'next/server'
import {
  evaluateV2ResourceScope,
  hasV2Permission,
} from '@/server/authorization'
import { loadV2OrganizationFacts } from '@/server/authorization/organization-scope-repository'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

const PAGE_SIZE = 30
const DB_PAGE_SIZE = 1000

type MissionRow = {
  id: string
  serial_number: string
  facility_id: string
  primary_inspector_id: string
  assigned_user_id: string | null
  created_by: string | null
  status: string | null
  priority: string | null
  scheduled_date: string
  expected_end_date: string | null
  visit_purpose: string | null
  requires_overnight: boolean | null
  requires_hotel_booking: boolean | null
  checkin_time: string | null
  checkout_time: string | null
  gps_verified: boolean | null
  completed_at: string | null
  created_at: string | null
  source_target_id: string | null
  source_program_id: string | null
}

type FacilityRow = {
  id: string
  name: string
  facility_type: string
  organization_id: string
  sector_id: string | null
  governorate: string | null
  health_admin: string | null
  village_city: string | null
}

type UserRow = {
  id: string
  full_name: string
  job_title: string | null
}

type TeamRow = {
  mission_id: string
  user_id: string
  is_primary: boolean | null
}

type TargetRow = {
  id: string
  title: string
  scope_level: string
  scope_name: string
  assigned_user_id: string | null
  target_type: string
}

type ProgramRow = {
  id: string
  name: string
  program_type: string
}

async function loadAllMissions(): Promise<MissionRow[]> {
  const admin = getAdminSupabaseClient()
  const rows: MissionRow[] = []

  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await admin
      .from('missions')
      .select(
        'id, serial_number, facility_id, primary_inspector_id, assigned_user_id, created_by, status, priority, scheduled_date, expected_end_date, visit_purpose, requires_overnight, requires_hotel_booking, checkin_time, checkout_time, gps_verified, completed_at, created_at, source_target_id, source_program_id'
      )
      .order('scheduled_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + DB_PAGE_SIZE - 1)

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load missions page: ${error.message}`
      )
    }

    const page = (data ?? []) as MissionRow[]
    rows.push(...page)

    if (page.length < DB_PAGE_SIZE) break
  }

  return rows
}

async function loadAllTeamRows(): Promise<TeamRow[]> {
  const admin = getAdminSupabaseClient()
  const rows: TeamRow[] = []

  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await admin
      .from('mission_team')
      .select('mission_id, user_id, is_primary')
      .order('mission_id')
      .order('user_id')
      .range(from, from + DB_PAGE_SIZE - 1)

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load mission team page: ${error.message}`
      )
    }

    const page = (data ?? []) as TeamRow[]
    rows.push(...page)

    if (page.length < DB_PAGE_SIZE) break
  }

  return rows
}

async function loadFacilities(ids: readonly string[]) {
  const admin = getAdminSupabaseClient()
  const result = new Map<string, FacilityRow>()
  const unique = [...new Set(ids)]

  for (let index = 0; index < unique.length; index += 500) {
    const chunk = unique.slice(index, index + 500)
    if (chunk.length === 0) continue

    const { data, error } = await admin
      .from('facilities')
      .select(
        'id, name, facility_type, organization_id, sector_id, governorate, health_admin, village_city'
      )
      .in('id', chunk)

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load facilities: ${error.message}`
      )
    }

    for (const row of (data ?? []) as FacilityRow[]) {
      result.set(row.id, row)
    }
  }

  return result
}

async function loadUsers(ids: readonly string[]) {
  const admin = getAdminSupabaseClient()
  const result = new Map<string, UserRow>()
  const unique = [...new Set(ids.filter(Boolean))]

  for (let index = 0; index < unique.length; index += 500) {
    const chunk = unique.slice(index, index + 500)
    if (chunk.length === 0) continue

    const { data, error } = await admin
      .from('users')
      .select('id, full_name, job_title')
      .in('id', chunk)

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load users: ${error.message}`
      )
    }

    for (const row of (data ?? []) as UserRow[]) {
      result.set(row.id, row)
    }
  }

  return result
}

async function loadTargets(ids: readonly string[]) {
  const admin = getAdminSupabaseClient()
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map<string, TargetRow>()

  const result = new Map<string, TargetRow>()

  for (let index = 0; index < unique.length; index += 500) {
    const { data, error } = await admin
      .from('mission_targets')
      .select(
        'id, title, scope_level, scope_name, assigned_user_id, target_type'
      )
      .in('id', unique.slice(index, index + 500))

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load targets: ${error.message}`
      )
    }

    for (const row of (data ?? []) as TargetRow[]) {
      result.set(row.id, row)
    }
  }

  return result
}

async function loadPrograms(ids: readonly string[]) {
  const admin = getAdminSupabaseClient()
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map<string, ProgramRow>()

  const result = new Map<string, ProgramRow>()

  for (let index = 0; index < unique.length; index += 500) {
    const { data, error } = await admin
      .from('facility_programs')
      .select('id, name, program_type')
      .in('id', unique.slice(index, index + 500))

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load programs: ${error.message}`
      )
    }

    for (const row of (data ?? []) as ProgramRow[]) {
      result.set(row.id, row)
    }
  }

  return result
}

function normalizedStatus(status: string | null) {
  if (!status) return 'draft'
  if (status === 'منفذة' || status === 'مكتملة') return 'completed'
  if (status === 'مغلقة') return 'closed'
  if (status === 'مرفوضة') return 'rejected'
  if (status === 'ملغاة') return 'cancelled'
  return status
}

function targetSource(target: TargetRow | undefined) {
  if (!target) return null

  if (target.scope_level === 'user') {
    return {
      type: 'target_user',
      label: 'مستهدف مستخدم',
      name: target.scope_name,
      target_type: target.target_type,
    }
  }

  return {
    type: 'target_place',
    label: 'مستهدف مكاني',
    name: target.scope_name,
    target_type: target.target_type,
  }
}

export async function GET(request: Request) {
  try {
    const gate = await requireV2Permission('missions.view')
    if (!gate.ok) return gate.response

    const url = new URL(request.url)
    const mode = ['assigned', 'issued', 'oversight', 'pending'].includes(
      url.searchParams.get('mode') || ''
    )
      ? (url.searchParams.get('mode') as
          | 'assigned'
          | 'issued'
          | 'oversight'
          | 'pending')
      : 'assigned'
    const statusFilter = url.searchParams.get('status') || 'all'
    const query = (url.searchParams.get('q') || '').trim().toLocaleLowerCase('ar')
    const requestedPage = Number(url.searchParams.get('page') || '1')
    const page = Number.isFinite(requestedPage)
      ? Math.max(1, Math.floor(requestedPage))
      : 1

    const [missions, teamRows] = await Promise.all([
      loadAllMissions(),
      loadAllTeamRows(),
    ])

    const teamByMission = new Map<string, TeamRow[]>()
    const assignedMissionIds = new Set<string>()

    for (const team of teamRows) {
      const current = teamByMission.get(team.mission_id) ?? []
      current.push(team)
      teamByMission.set(team.mission_id, current)

      if (team.user_id === gate.user.profileId) {
        assignedMissionIds.add(team.mission_id)
      }
    }

    const facilities = await loadFacilities(
      missions.map((mission) => mission.facility_id)
    )

    const factIds = new Set<string>()
    if (gate.user.organizationId) factIds.add(gate.user.organizationId)

    for (const role of gate.access.roles) {
      if (role.assignmentOrganizationId) {
        factIds.add(role.assignmentOrganizationId)
      }
    }

    for (const facility of facilities.values()) {
      factIds.add(facility.organization_id)
    }

    const organizationFacts =
      factIds.size > 0
        ? await loadV2OrganizationFacts([...factIds])
        : new Map()

    const userIds = new Set<string>()
    const targetIds: string[] = []
    const programIds: string[] = []

    for (const mission of missions) {
      if (mission.created_by) userIds.add(mission.created_by)
      if (mission.primary_inspector_id) userIds.add(mission.primary_inspector_id)
      if (mission.assigned_user_id) userIds.add(mission.assigned_user_id)
      if (mission.source_target_id) targetIds.push(mission.source_target_id)
      if (mission.source_program_id) programIds.push(mission.source_program_id)

      for (const team of teamByMission.get(mission.id) ?? []) {
        userIds.add(team.user_id)
      }
    }

    const [users, targets, programs] = await Promise.all([
      loadUsers([...userIds]),
      loadTargets(targetIds),
      loadPrograms(programIds),
    ])

    const relationAllowed = (mission: MissionRow, permissionKey: string) => {
      const facility = facilities.get(mission.facility_id)
      if (!facility) return false

      const team = teamByMission.get(mission.id) ?? []
      const assignedUserIds = [
        mission.assigned_user_id,
        mission.primary_inspector_id,
        ...team.map((member) => member.user_id),
      ].filter((value): value is string => Boolean(value))

      return evaluateV2ResourceScope({
        user: gate.user,
        snapshot: gate.access,
        permissionKey,
        organizationFacts,
        resource: {
          ownerUserId: mission.created_by,
          assignedUserIds: [...new Set(assignedUserIds)],
          organizationId: facility.organization_id,
          sectorId: facility.sector_id,
          governorate: facility.governorate,
        },
      }).allowed
    }

    const canApprove = hasV2Permission(gate.access, 'missions.approve')

    const enriched = missions
      .filter((mission) => relationAllowed(mission, 'missions.view'))
      .map((mission) => {
        const facility = facilities.get(mission.facility_id)
        const team = teamByMission.get(mission.id) ?? []
        const sourceTarget = mission.source_target_id
          ? targets.get(mission.source_target_id)
          : undefined
        const sourceProgram = mission.source_program_id
          ? programs.get(mission.source_program_id)
          : undefined
        const source =
          targetSource(sourceTarget) ??
          (sourceProgram
            ? {
                type: 'program',
                label: 'مشروع / مبادرة',
                name: sourceProgram.name,
                target_type: null,
              }
            : {
                type: 'manual',
                label: 'اختيار حر',
                name: null,
                target_type: null,
              })

        const creator = mission.created_by
          ? users.get(mission.created_by)
          : undefined
        const primary = users.get(mission.primary_inspector_id)

        return {
          id: mission.id,
          serial_number: mission.serial_number,
          status: normalizedStatus(mission.status),
          priority: mission.priority || 'normal',
          scheduled_date: mission.scheduled_date,
          expected_end_date: mission.expected_end_date,
          visit_purpose: mission.visit_purpose,
          requires_overnight: mission.requires_overnight === true,
          requires_hotel_booking: mission.requires_hotel_booking === true,
          checkin_time: mission.checkin_time,
          checkout_time: mission.checkout_time,
          gps_verified: mission.gps_verified === true,
          completed_at: mission.completed_at,
          facility: facility
            ? {
                id: facility.id,
                name: facility.name,
                facility_type: facility.facility_type,
                governorate: facility.governorate,
                health_admin: facility.health_admin,
                village_city: facility.village_city,
              }
            : null,
          creator: creator
            ? {
                id: creator.id,
                name: creator.full_name,
                job_title: creator.job_title,
              }
            : null,
          primary_inspector: primary
            ? {
                id: primary.id,
                name: primary.full_name,
                job_title: primary.job_title,
              }
            : null,
          team: team.map((member) => {
            const user = users.get(member.user_id)
            return {
              id: member.user_id,
              name: user?.full_name ?? 'مستخدم غير مسمى',
              job_title: user?.job_title ?? null,
              is_primary: member.is_primary === true,
            }
          }),
          source,
          relations: {
            assigned_to_me: assignedMissionIds.has(mission.id),
            issued_by_me: mission.created_by === gate.user.profileId,
            can_approve:
              canApprove &&
              normalizedStatus(mission.status) === 'pending_approval' &&
              relationAllowed(mission, 'missions.approve'),
            can_execute:
              assignedMissionIds.has(mission.id) &&
              hasV2Permission(gate.access, 'missions.execute') &&
              relationAllowed(mission, 'missions.execute'),
          },
        }
      })

    const counts = {
      assigned: enriched.filter((row) => row.relations.assigned_to_me).length,
      issued: enriched.filter((row) => row.relations.issued_by_me).length,
      oversight: enriched.length,
      pending: enriched.filter((row) => row.relations.can_approve).length,
    }

    let rows = enriched.filter((row) => {
      if (mode === 'assigned') return row.relations.assigned_to_me
      if (mode === 'issued') return row.relations.issued_by_me
      if (mode === 'pending') return row.relations.can_approve
      return true
    })

    if (statusFilter !== 'all') {
      rows = rows.filter((row) => row.status === statusFilter)
    }

    if (query) {
      rows = rows.filter((row) => {
        const haystack = [
          row.serial_number,
          row.visit_purpose ?? '',
          row.facility?.name ?? '',
          row.facility?.governorate ?? '',
          row.facility?.health_admin ?? '',
          row.creator?.name ?? '',
          row.primary_inspector?.name ?? '',
          row.source.label,
          row.source.name ?? '',
          ...row.team.map((member) => member.name),
        ]
          .join(' ')
          .toLocaleLowerCase('ar')

        return haystack.includes(query)
      })
    }

    const total = rows.length
    const start = (page - 1) * PAGE_SIZE
    const paged = rows.slice(start, start + PAGE_SIZE)

    return NextResponse.json({
      mode,
      page,
      page_size: PAGE_SIZE,
      total,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts,
      can_approve: canApprove,
      rows: paged,
    })
  } catch (error) {
    console.error('[missions-workspace:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'تعذر تحميل مساحة عمل المأموريات' },
      { status: 500 }
    )
  }
}
