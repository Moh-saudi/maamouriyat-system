import { NextResponse } from 'next/server'
import {
  evaluateV2ResourceScope,
  hasV2Permission,
} from '@/server/authorization'
import { loadV2OrganizationFacts } from '@/server/authorization/organization-scope-repository'
import { requireV2Permission } from '@/server/authorization/http-guard'
import {
  loadWorkspaceFacilities,
  loadWorkspaceMissionsForGroup,
  loadWorkspaceTeamRows,
  loadWorkspaceUsers,
  normalizeMissionWorkspaceStatus,
  type MissionWorkspaceMissionRow,
  type MissionWorkspaceTeamRow,
} from '@/server/services/missions/workspace-data'

type MissionMode = 'assigned' | 'issued' | 'oversight' | 'pending'

function buildTeamMap(rows: MissionWorkspaceTeamRow[]) {
  const result = new Map<string, MissionWorkspaceTeamRow[]>()

  for (const row of rows) {
    const current = result.get(row.mission_id) ?? []
    current.push(row)
    result.set(row.mission_id, current)
  }

  return result
}

export async function GET(request: Request) {
  try {
    const gate = await requireV2Permission('missions.view')
    if (!gate.ok) return gate.response

    const url = new URL(request.url)
    const groupKey = url.searchParams.get('group_key') || ''
    const rawMode = url.searchParams.get('mode') || ''
    const mode: MissionMode = (
      ['assigned', 'issued', 'oversight', 'pending'] as MissionMode[]
    ).includes(rawMode as MissionMode)
      ? (rawMode as MissionMode)
      : 'oversight'

    const batchId = groupKey.startsWith('batch:')
      ? groupKey.slice('batch:'.length)
      : null
    const missionId = groupKey.startsWith('mission:')
      ? groupKey.slice('mission:'.length)
      : null

    if (!batchId && !missionId) {
      return NextResponse.json(
        { error: 'معرف التكليف غير صحيح' },
        { status: 400 }
      )
    }

    const missions = await loadWorkspaceMissionsForGroup({
      batchId,
      missionId,
    })

    if (missions.length === 0) {
      return NextResponse.json(
        { error: 'التكليف غير موجود' },
        { status: 404 }
      )
    }

    const teamRows = await loadWorkspaceTeamRows(
      missions.map((mission) => mission.id)
    )
    const teamByMission = buildTeamMap(teamRows)
    const facilities = await loadWorkspaceFacilities(
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
    for (const mission of missions) {
      if (mission.created_by) userIds.add(mission.created_by)
      if (mission.primary_inspector_id) {
        userIds.add(mission.primary_inspector_id)
      }
      if (mission.assigned_user_id) userIds.add(mission.assigned_user_id)

      for (const member of teamByMission.get(mission.id) ?? []) {
        userIds.add(member.user_id)
      }
    }

    const users = await loadWorkspaceUsers([...userIds])
    const canApprove = hasV2Permission(gate.access, 'missions.approve')
    const canExecute = hasV2Permission(gate.access, 'missions.execute')

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

    const rows = missions
      .filter((mission) => relationAllowed(mission, 'missions.view'))
      .map((mission) => {
        const facility = facilities.get(mission.facility_id)
        const team = teamByMission.get(mission.id) ?? []
        const assignedToMe =
          mission.assigned_user_id === gate.user.profileId ||
          mission.primary_inspector_id === gate.user.profileId ||
          team.some(
            (member) => member.user_id === gate.user.profileId
          )
        const status = normalizeMissionWorkspaceStatus(mission.status)
        const creator = mission.created_by
          ? users.get(mission.created_by)
          : undefined
        const primary = users.get(mission.primary_inspector_id)

        return {
          id: mission.id,
          serial_number: mission.serial_number,
          status,
          priority: mission.priority || 'normal',
          scheduled_date: mission.scheduled_date,
          expected_end_date: mission.expected_end_date,
          visit_purpose: mission.visit_purpose,
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
          relations: {
            assigned_to_me: assignedToMe,
            issued_by_me: mission.created_by === gate.user.profileId,
            can_approve:
              canApprove &&
              status === 'pending_approval' &&
              relationAllowed(mission, 'missions.approve'),
            can_execute:
              assignedToMe &&
              canExecute &&
              relationAllowed(mission, 'missions.execute'),
          },
        }
      })
      .filter((row) => {
        if (mode === 'assigned') return row.relations.assigned_to_me
        if (mode === 'issued') return row.relations.issued_by_me
        if (mode === 'pending') return row.relations.can_approve
        return true
      })
      .sort((a, b) => {
        const governorateCompare = (
          a.facility?.governorate ?? ''
        ).localeCompare(b.facility?.governorate ?? '', 'ar')
        if (governorateCompare !== 0) return governorateCompare

        const adminCompare = (
          a.facility?.health_admin ?? ''
        ).localeCompare(b.facility?.health_admin ?? '', 'ar')
        if (adminCompare !== 0) return adminCompare

        return (a.facility?.name ?? '').localeCompare(
          b.facility?.name ?? '',
          'ar'
        )
      })

    return NextResponse.json({
      group_key: groupKey,
      mission_count: rows.length,
      rows,
    })
  } catch (error) {
    console.error('[missions-workspace-details:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'تعذر تحميل مأموريات التكليف' },
      { status: 500 }
    )
  }
}
