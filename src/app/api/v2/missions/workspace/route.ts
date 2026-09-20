import { NextResponse } from 'next/server'
import {
  MISSION_OPERATIONAL_STATE,
  resolveMissionOperationalState,
  type MissionOperationalState,
} from '@/config/mission-lifecycle'
import {
  evaluateV2ResourceScope,
  hasV2Permission,
} from '@/server/authorization'
import { loadV2OrganizationFacts } from '@/server/authorization/organization-scope-repository'
import { requireAnyV2Permission } from '@/server/authorization/http-guard'
import {
  loadAllWorkspaceMissions,
  loadWorkspaceFacilities,
  loadWorkspacePrograms,
  loadWorkspaceTargets,
  loadWorkspaceTeamRows,
  loadWorkspaceUsers,
  missionWorkspaceTargetSource,
  normalizeMissionWorkspaceStatus,
  type MissionWorkspaceMissionRow,
  type MissionWorkspaceTeamRow,
} from '@/server/services/missions/workspace-data'

const DEFAULT_PAGE_SIZE = 10
const ALLOWED_PAGE_SIZES = new Set([10, 15, 25])

type MissionMode = 'assigned' | 'issued' | 'oversight' | 'pending'

type StatusCounts = Record<string, number>

type GroupAccumulator = {
  group_key: string
  batch_id: string | null
  legacy_mission_id: string | null
  mission_count: number
  facility_ids: Set<string>
  status_counts: StatusCounts
  scheduled_date: string
  expected_end_date: string | null
  priority: string
  visit_purpose: string | null
  creator: {
    id: string
    name: string
    job_title: string | null
  } | null
  team: Map<
    string,
    {
      id: string
      name: string
      job_title: string | null
      is_primary: boolean
    }
  >
  source: {
    type: 'target_user' | 'target_place' | 'program' | 'manual'
    label: string
    name: string | null
    target_type: string | null
  }
  governorates: Set<string>
  health_admins: Set<string>
  sample_facilities: string[]
  assigned_mission_count: number
  executable_mission_count: number
  approvable_mission_count: number
  checklist_manage_mission_count: number
  issued_by_me: boolean
  overdue_count: number
  search_parts: string[]
}

function groupKey(mission: MissionWorkspaceMissionRow) {
  return mission.assignment_batch_id
    ? 'batch:' + mission.assignment_batch_id
    : 'mission:' + mission.id
}

function buildTeamMap(rows: MissionWorkspaceTeamRow[]) {
  const result = new Map<string, MissionWorkspaceTeamRow[]>()

  for (const row of rows) {
    const current = result.get(row.mission_id) ?? []
    current.push(row)
    result.set(row.mission_id, current)
  }

  return result
}

function deriveOverallStatus(counts: StatusCounts) {
  const entries = Object.entries(counts).filter(([, count]) => count > 0)
  if (entries.length === 0) return 'draft'
  if (entries.length === 1) return entries[0][0]

  const activeStatuses = new Set(entries.map(([status]) => status))
  const completed = (counts.completed ?? 0) + (counts.closed ?? 0)
  const total = entries.reduce((sum, [, count]) => sum + count, 0)

  if (
    [...activeStatuses].every(
      (status) => status === 'completed' || status === 'closed'
    )
  ) {
    return 'completed'
  }

  // A grouped assignment is already under execution as soon as one facility
  // has a terminal result, even if the remaining children are still approved.
  if (completed > 0 && completed < total) return 'in_progress'

  if (activeStatuses.has('in_progress')) return 'in_progress'
  if (activeStatuses.has('pending_approval')) return 'pending_approval'
  if (activeStatuses.has('approved')) return 'approved'

  return 'mixed'
}

function completedCount(counts: StatusCounts) {
  return (counts.completed ?? 0) + (counts.closed ?? 0)
}

function formatGroup(group: GroupAccumulator) {
  const completed = completedCount(group.status_counts)
  const missionCount = Math.max(1, group.mission_count)
  const derivedStatus = deriveOverallStatus(group.status_counts)
  const operationalState = resolveMissionOperationalState({
    status: derivedStatus,
    scheduledDate: group.scheduled_date,
    expectedEndDate: group.expected_end_date,
  })

  return {
    group_key: group.group_key,
    batch_id: group.batch_id,
    legacy_mission_id: group.legacy_mission_id,
    mission_count: group.mission_count,
    facility_count: group.facility_ids.size,
    status: derivedStatus,
    operational_state: operationalState.key,
    status_counts: group.status_counts,
    completed_count: completed,
    remaining_count: Math.max(0, group.mission_count - completed),
    completion_rate: Math.round((completed / missionCount) * 100),
    overdue_count: group.overdue_count,
    scheduled_date: group.scheduled_date,
    expected_end_date: group.expected_end_date,
    priority: group.priority,
    visit_purpose: group.visit_purpose,
    creator: group.creator,
    team: [...group.team.values()].slice(0, 8),
    team_member_count: group.team.size,
    source: group.source,
    governorates: [...group.governorates],
    health_admins: [...group.health_admins],
    sample_facilities: group.sample_facilities.slice(0, 4),
    relations: {
      assigned_to_me: group.assigned_mission_count > 0,
      issued_by_me: group.issued_by_me,
      can_approve:
        group.approvable_mission_count === group.mission_count &&
        group.mission_count > 0,
      executable_mission_count: group.executable_mission_count,
      can_manage_checklists:
        group.checklist_manage_mission_count > 0,
    },
    _search: group.search_parts.join(' ').toLocaleLowerCase('ar'),
  }
}

export async function GET(request: Request) {
  try {
    const gate = await requireAnyV2Permission([
      'missions.view',
      'missions.execute',
      'missions.checklist_change',
      'missions.create',
      'missions.assign',
      'missions.prepare',
      'missions.propose_team',
      'missions.approve',
    ])
    if (!gate.ok) return gate.response

    // Preserve the narrowed authorized context for nested functions and
    // callbacks. TypeScript does not reliably retain the discriminated-union
    // narrowing of `gate` across those closure boundaries.
    const authorizedUser = gate.user
    const authorizedAccess = gate.access

    const url = new URL(request.url)
    const rawMode = url.searchParams.get('mode') || ''
    const mode: MissionMode = (
      ['assigned', 'issued', 'oversight', 'pending'] as MissionMode[]
    ).includes(rawMode as MissionMode)
      ? (rawMode as MissionMode)
      : 'assigned'

    const statusFilter = url.searchParams.get('status') || 'all'
    const query = (url.searchParams.get('q') || '')
      .trim()
      .toLocaleLowerCase('ar')
    const requestedPage = Number(url.searchParams.get('page') || '1')
    const page = Number.isFinite(requestedPage)
      ? Math.max(1, Math.floor(requestedPage))
      : 1
    const requestedPageSize = Number(
      url.searchParams.get('page_size') || DEFAULT_PAGE_SIZE
    )
    const pageSize = ALLOWED_PAGE_SIZES.has(requestedPageSize)
      ? requestedPageSize
      : DEFAULT_PAGE_SIZE

    const [missions, teamRows] = await Promise.all([
      loadAllWorkspaceMissions(),
      loadWorkspaceTeamRows(),
    ])

    const teamByMission = buildTeamMap(teamRows)
    const assignedMissionIds = new Set(
      teamRows
        .filter((row) => row.user_id === authorizedUser.profileId)
        .map((row) => row.mission_id)
    )

    for (const mission of missions) {
      if (
        mission.assigned_user_id === authorizedUser.profileId ||
        mission.primary_inspector_id === authorizedUser.profileId
      ) {
        assignedMissionIds.add(mission.id)
      }
    }

    const allCountByGroup = new Map<string, number>()
    for (const mission of missions) {
      const key = groupKey(mission)
      allCountByGroup.set(key, (allCountByGroup.get(key) ?? 0) + 1)
    }

    const facilities = await loadWorkspaceFacilities(
      missions.map((mission) => mission.facility_id)
    )

    const factIds = new Set<string>()
    if (authorizedUser.organizationId) factIds.add(authorizedUser.organizationId)

    for (const role of authorizedAccess.roles) {
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
      if (mission.primary_inspector_id) {
        userIds.add(mission.primary_inspector_id)
      }
      if (mission.assigned_user_id) userIds.add(mission.assigned_user_id)
      if (mission.source_target_id) targetIds.push(mission.source_target_id)
      if (mission.source_program_id) programIds.push(mission.source_program_id)

      for (const member of teamByMission.get(mission.id) ?? []) {
        userIds.add(member.user_id)
      }
    }

    const [users, targets, programs] = await Promise.all([
      loadWorkspaceUsers([...userIds]),
      loadWorkspaceTargets(targetIds),
      loadWorkspacePrograms(programIds),
    ])

    function relationAllowed(
      mission: MissionWorkspaceMissionRow,
      permissionKey: string
    ) {
      const facility = facilities.get(mission.facility_id)
      if (!facility) return false

      const team = teamByMission.get(mission.id) ?? []
      const assignedUserIds = [
        mission.assigned_user_id,
        mission.primary_inspector_id,
        ...team.map((member) => member.user_id),
      ].filter((value): value is string => Boolean(value))

      return evaluateV2ResourceScope({
        user: authorizedUser,
        snapshot: authorizedAccess,
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

    const canView = hasV2Permission(authorizedAccess, 'missions.view')
    const canApprove = hasV2Permission(authorizedAccess, 'missions.approve')
    const canExecute = hasV2Permission(authorizedAccess, 'missions.execute')
    const canManageChecklists = hasV2Permission(
      authorizedAccess,
      'missions.checklist_change'
    )
    const issuancePermissionKeys = [
      'missions.create',
      'missions.assign',
      'missions.prepare',
      'missions.propose_team',
    ] as const
    const today = new Date().toISOString().slice(0, 10)
    const groups = new Map<string, GroupAccumulator>()

    for (const mission of missions) {
      const teamRowsForMission = teamByMission.get(mission.id) ?? []
      const assignedToMe =
        assignedMissionIds.has(mission.id) ||
        teamRowsForMission.some(
          (member) => member.user_id === authorizedUser.profileId
        )
      const canViewResource =
        canView && relationAllowed(mission, 'missions.view')
      const canExecuteResource =
        assignedToMe &&
        canExecute &&
        relationAllowed(mission, 'missions.execute')
      const canManageChecklistResource =
        canManageChecklists &&
        relationAllowed(mission, 'missions.checklist_change')
      const canViewIssuedResource =
        mission.created_by === authorizedUser.profileId &&
        issuancePermissionKeys.some(
          (permissionKey) =>
            hasV2Permission(authorizedAccess, permissionKey) &&
            relationAllowed(mission, permissionKey)
        )
      const canApproveResource =
        canApprove && relationAllowed(mission, 'missions.approve')

      if (
        !canViewResource &&
        !canExecuteResource &&
        !canManageChecklistResource &&
        !canViewIssuedResource &&
        !canApproveResource
      ) continue

      const facility = facilities.get(mission.facility_id)
      if (!facility) continue

      const key = groupKey(mission)
      const normalizedStatus = normalizeMissionWorkspaceStatus(mission.status)
      const sourceTarget = mission.source_target_id
        ? targets.get(mission.source_target_id)
        : undefined
      const sourceProgram = mission.source_program_id
        ? programs.get(mission.source_program_id)
        : undefined

      const source =
        missionWorkspaceTargetSource(sourceTarget) ??
        (sourceProgram
          ? {
              type: 'program' as const,
              label: 'مشروع / مبادرة',
              name: sourceProgram.name,
              target_type: null,
            }
          : {
              type: 'manual' as const,
              label: 'اختيار حر',
              name: null,
              target_type: null,
            })

      const creator = mission.created_by
        ? users.get(mission.created_by)
        : undefined
      let group = groups.get(key)
      if (!group) {
        group = {
          group_key: key,
          batch_id: mission.assignment_batch_id,
          legacy_mission_id: mission.assignment_batch_id
            ? null
            : mission.id,
          mission_count: 0,
          facility_ids: new Set<string>(),
          status_counts: {},
          scheduled_date: mission.scheduled_date,
          expected_end_date: mission.expected_end_date,
          priority: mission.priority || 'normal',
          visit_purpose: mission.visit_purpose,
          creator: creator
            ? {
                id: creator.id,
                name: creator.full_name,
                job_title: creator.job_title,
              }
            : null,
          team: new Map(),
          source,
          governorates: new Set<string>(),
          health_admins: new Set<string>(),
          sample_facilities: [],
          assigned_mission_count: 0,
          executable_mission_count: 0,
          approvable_mission_count: 0,
          checklist_manage_mission_count: 0,
          issued_by_me: mission.created_by === authorizedUser.profileId,
          overdue_count: 0,
          search_parts: [],
        }
        groups.set(key, group)
      }

      group.mission_count += 1
      group.facility_ids.add(facility.id)
      group.status_counts[normalizedStatus] =
        (group.status_counts[normalizedStatus] ?? 0) + 1

      if (mission.scheduled_date < group.scheduled_date) {
        group.scheduled_date = mission.scheduled_date
      }

      if (
        mission.expected_end_date &&
        (!group.expected_end_date ||
          mission.expected_end_date > group.expected_end_date)
      ) {
        group.expected_end_date = mission.expected_end_date
      }

      if (facility.governorate) {
        group.governorates.add(facility.governorate)
      }
      if (facility.health_admin) {
        group.health_admins.add(facility.health_admin)
      }
      if (
        group.sample_facilities.length < 4 &&
        !group.sample_facilities.includes(facility.name)
      ) {
        group.sample_facilities.push(facility.name)
      }

      if (assignedToMe) group.assigned_mission_count += 1

      if (canExecuteResource) {
        group.executable_mission_count += 1
      }

      if (
        canManageChecklists &&
        relationAllowed(mission, 'missions.checklist_change')
      ) {
        group.checklist_manage_mission_count += 1
      }

      if (
        canApproveResource &&
        normalizedStatus === 'pending_approval'
      ) {
        group.approvable_mission_count += 1
      }

      if (
        mission.expected_end_date &&
        mission.expected_end_date < today &&
        !['completed', 'closed', 'cancelled', 'rejected'].includes(
          normalizedStatus
        )
      ) {
        group.overdue_count += 1
      }

      for (const member of teamRowsForMission) {
        const user = users.get(member.user_id)
        group.team.set(member.user_id, {
          id: member.user_id,
          name: user?.full_name ?? 'مستخدم غير مسمى',
          job_title: user?.job_title ?? null,
          is_primary: member.is_primary === true,
        })
      }

      group.search_parts.push(
        mission.serial_number,
        mission.visit_purpose ?? '',
        facility.name,
        facility.governorate ?? '',
        facility.health_admin ?? '',
        creator?.full_name ?? '',
        source.label,
        source.name ?? '',
        ...teamRowsForMission.map(
          (member) => users.get(member.user_id)?.full_name ?? ''
        )
      )
    }

    const formatted = [...groups.values()].map((group) => {
      const row = formatGroup(group)
      const totalInUnderlyingGroup =
        allCountByGroup.get(group.group_key) ?? group.mission_count

      if (row.relations.can_approve) {
        row.relations.can_approve =
          group.mission_count === totalInUnderlyingGroup
      }

      return row
    })

    function matchesMode(row: (typeof formatted)[number], targetMode: MissionMode) {
      if (targetMode === 'assigned') return row.relations.assigned_to_me
      if (targetMode === 'issued') return row.relations.issued_by_me
      if (targetMode === 'pending') return row.relations.can_approve
      return true
    }

    function modeCount(targetMode: MissionMode) {
      const matching = formatted.filter((row) =>
        matchesMode(row, targetMode)
      )
      return {
        batches: matching.length,
        missions: matching.reduce(
          (sum, row) => sum + row.mission_count,
          0
        ),
      }
    }

    const counts = {
      assigned: modeCount('assigned'),
      issued: modeCount('issued'),
      oversight: modeCount('oversight'),
      pending: modeCount('pending'),
    }

    let rows = formatted.filter((row) => matchesMode(row, mode))

    if (statusFilter !== 'all') {
      const lifecycleFilter = statusFilter as MissionOperationalState
      if (lifecycleFilter in MISSION_OPERATIONAL_STATE) {
        rows = rows.filter(
          (row) => row.operational_state === lifecycleFilter
        )
      } else {
        rows = rows.filter(
          (row) => (row.status_counts[statusFilter] ?? 0) > 0
        )
      }
    }

    if (query) {
      rows = rows.filter((row) => row._search.includes(query))
    }

    rows.sort((a, b) => {
      const dateCompare = b.scheduled_date.localeCompare(a.scheduled_date)
      if (dateCompare !== 0) return dateCompare
      return b.group_key.localeCompare(a.group_key)
    })

    const totalBatches = rows.length
    const totalMissions = rows.reduce(
      (sum, row) => sum + row.mission_count,
      0
    )
    const start = (page - 1) * pageSize
    const paged = rows
      .slice(start, start + pageSize)
      .map(({ _search, ...row }) => row)

    return NextResponse.json({
      mode,
      page,
      page_size: pageSize,
      total_batches: totalBatches,
      total_missions: totalMissions,
      pages: Math.max(1, Math.ceil(totalBatches / pageSize)),
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
