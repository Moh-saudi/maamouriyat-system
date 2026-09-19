import { NextResponse } from 'next/server'
import {
  evaluateV2ResourceScope,
  hasV2Permission,
} from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { loadV2OrganizationFacts } from '@/server/authorization/organization-scope-repository'
import {
  loadWorkspaceFacilities,
  loadWorkspaceMissionsForGroup,
  loadWorkspaceTeamRows,
  type MissionWorkspaceMissionRow,
} from '@/server/services/missions/workspace-data'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type RouteContext = {
  params: Promise<{ batchId: string }>
}

export async function POST(
  _request: Request,
  context: RouteContext
) {
  try {
    const gate = await requireV2Permission('missions.execute')
    if (!gate.ok) return gate.response

    const authorizedUser = gate.user
    const authorizedAccess = gate.access
    const { batchId } = await context.params
    const missions = await loadWorkspaceMissionsForGroup({ batchId })

    if (missions.length === 0) {
      return NextResponse.json(
        { error: 'التكليف غير موجود.' },
        { status: 404 }
      )
    }

    const [teamRows, facilities] = await Promise.all([
      loadWorkspaceTeamRows(missions.map((mission) => mission.id)),
      loadWorkspaceFacilities(missions.map((mission) => mission.facility_id)),
    ])

    const isTeamLeader =
      missions.some(
        (mission) =>
          mission.primary_inspector_id === authorizedUser.profileId
      ) ||
      teamRows.some(
        (member) =>
          member.user_id === authorizedUser.profileId &&
          member.is_primary === true
      )

    if (!isTeamLeader) {
      return NextResponse.json(
        {
          error:
            'إرسال التقرير إلى المالية متاح لرئيس فريق المأمورية فقط.',
        },
        { status: 403 }
      )
    }

    if (!hasV2Permission(authorizedAccess, 'missions.execute')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إنهاء دورة المأمورية.' },
        { status: 403 }
      )
    }

    const factIds = new Set<string>()
    if (authorizedUser.organizationId) {
      factIds.add(authorizedUser.organizationId)
    }

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

    function resourceAllowed(mission: MissionWorkspaceMissionRow) {
      const facility = facilities.get(mission.facility_id)
      if (!facility) return false

      const assignedUserIds = [
        mission.assigned_user_id,
        mission.primary_inspector_id,
        ...teamRows
          .filter((member) => member.mission_id === mission.id)
          .map((member) => member.user_id),
      ].filter((value): value is string => Boolean(value))

      return evaluateV2ResourceScope({
        user: authorizedUser,
        snapshot: authorizedAccess,
        permissionKey: 'missions.execute',
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

    if (missions.some((mission) => !resourceAllowed(mission))) {
      return NextResponse.json(
        { error: 'يوجد جزء من التكليف خارج نطاق تنفيذك المسموح.' },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()
    const { data, error } = await admin.rpc(
      'submit_mission_assignment_report_to_finance',
      {
        p_batch_id: batchId,
        p_actor_user_id: authorizedUser.profileId,
      }
    )

    if (error) {
      const message = error.message || ''

      if (message.includes('MISSION_BATCH_REPORT_NOT_READY')) {
        return NextResponse.json(
          {
            error:
              'التقرير غير جاهز للإرسال. يجب إنهاء التكليف وتثبيت المدة الفعلية أولًا.',
          },
          { status: 409 }
        )
      }

      if (message.includes('MISSION_BATCH_NOT_FULLY_EXECUTED')) {
        return NextResponse.json(
          { error: 'لا يمكن إرسال التقرير قبل اكتمال جميع المنشآت.' },
          { status: 409 }
        )
      }

      console.error(
        '[mission-report-submit] RPC failed:',
        error.message
      )
      return NextResponse.json(
        { error: 'تعذر إرسال التقرير إلى الشئون المالية.' },
        { status: 500 }
      )
    }

    const row = Array.isArray(data) ? data[0] : data

    return NextResponse.json({
      success: true,
      settlement_count:
        row && typeof row === 'object'
          ? Number(
              (row as { settlement_count?: number }).settlement_count || 0
            )
          : 0,
      submitted_at:
        row && typeof row === 'object'
          ? String(
              (row as { submitted_at?: string }).submitted_at || ''
            )
          : '',
    })
  } catch (error) {
    console.error('[mission-report-submit] unexpected error:', error)
    return NextResponse.json(
      { error: 'تعذر إرسال التقرير إلى الشئون المالية.' },
      { status: 500 }
    )
  }
}
