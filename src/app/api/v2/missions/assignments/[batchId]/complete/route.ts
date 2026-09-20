import { NextResponse } from 'next/server'
import {
  evaluateV2ResourceScope,
} from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { loadV2OrganizationFacts } from '@/server/authorization/organization-scope-repository'
import {
  loadWorkspaceFacilities,
  loadWorkspaceMissionsForGroup,
  loadWorkspaceTeamRows,
  normalizeMissionWorkspaceStatus,
  type MissionWorkspaceMissionRow,
} from '@/server/services/missions/workspace-data'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type RouteContext = {
  params: Promise<{ batchId: string }>
}

type CompletionPayload = {
  actual_start_date?: string
  actual_end_date?: string
  actual_overnight_nights?: number
  completion_disposition?: string
  timing_adjustment_reason?: string | null
}

function validDateKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  )
}

function isCompletedStatus(status: string | null) {
  const normalized = normalizeMissionWorkspaceStatus(status)
  return normalized === 'completed' || normalized === 'closed'
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const gate = await requireV2Permission('missions.execute')
    if (!gate.ok) return gate.response

    const authorizedUser = gate.user
    const authorizedAccess = gate.access
    const { batchId } = await context.params
    const body = (await request.json()) as CompletionPayload

    if (
      !validDateKey(body.actual_start_date) ||
      !validDateKey(body.actual_end_date)
    ) {
      return NextResponse.json(
        { error: 'حدد تاريخ البداية والنهاية الفعليين.' },
        { status: 400 }
      )
    }

    const overnightNights = Number(body.actual_overnight_nights)
    if (!Number.isInteger(overnightNights) || overnightNights < 0) {
      return NextResponse.json(
        { error: 'عدد ليالي المبيت الفعلية غير صحيح.' },
        { status: 400 }
      )
    }

    if (
      !['return_to_base', 'next_mission', 'other'].includes(
        body.completion_disposition || ''
      )
    ) {
      return NextResponse.json(
        { error: 'حدد ما حدث بعد انتهاء التكليف.' },
        { status: 400 }
      )
    }

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
            'إنهاء التكليف وتثبيت المدة الفعلية متاح لرئيس فريق المأمورية فقط.',
        },
        { status: 403 }
      )
    }

    const remaining = missions.filter(
      (mission) => !isCompletedStatus(mission.status)
    ).length

    if (remaining > 0) {
      return NextResponse.json(
        {
          error:
            'لا يمكن إنهاء التكليف قبل تسجيل نتيجة كل منشأة: تم المرور أو لم يتم مع السبب والموقع والوقت.',
          remaining,
        },
        { status: 409 }
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
      'finalize_mission_assignment_batch',
      {
        p_batch_id: batchId,
        p_actor_user_id: authorizedUser.profileId,
        p_actual_start_date: body.actual_start_date,
        p_actual_end_date: body.actual_end_date,
        p_actual_overnight_nights: overnightNights,
        p_completion_disposition: body.completion_disposition,
        p_timing_adjustment_reason:
          body.timing_adjustment_reason?.trim() || null,
      }
    )

    if (error) {
      const message = error.message || ''

      if (message.includes('MISSION_BATCH_NOT_FULLY_EXECUTED')) {
        return NextResponse.json(
          { error: 'لا يمكن إنهاء التكليف قبل استكمال كل المنشآت.' },
          { status: 409 }
        )
      }

      if (message.includes('MISSION_BATCH_TIMING_REASON_REQUIRED')) {
        return NextResponse.json(
          {
            error:
              'المدة الفعلية تختلف عن المدة المقدرة؛ اكتب سبب التعديل.',
          },
          { status: 400 }
        )
      }

      if (message.includes('MISSION_BATCH_ACTUAL_TIMING_OVERLAP')) {
        return NextResponse.json(
          {
            error:
              'لا يمكن اعتماد هذه المدة لوجود تداخل فعلي لنفس عضو الفريق مع تكليف في محافظة أخرى.',
          },
          { status: 409 }
        )
      }

      if (message.includes('MISSION_BATCH_GOVERNORATE_INVALID')) {
        return NextResponse.json(
          {
            error:
              'هذا التكليف لا يطابق قاعدة المحافظة الواحدة ويحتاج تصحيحًا إداريًا قبل الإنهاء.',
          },
          { status: 409 }
        )
      }

      console.error(
        '[mission-assignment-complete] RPC failed:',
        error.message
      )
      return NextResponse.json(
        { error: 'تعذر إنهاء التكليف وتثبيت المدة الفعلية.' },
        { status: 500 }
      )
    }

    const row = Array.isArray(data) ? data[0] : data

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      actual_duration_days:
        row && typeof row === 'object'
          ? Number((row as { actual_duration_days?: number }).actual_duration_days || 0)
          : 0,
      settlement_count: 0,
      report_ready: true,
    })
  } catch (error) {
    console.error('[mission-assignment-complete] unexpected error:', error)
    return NextResponse.json(
      { error: 'تعذر إنهاء التكليف.' },
      { status: 500 }
    )
  }
}
