import { NextResponse } from 'next/server'
import {
  checkV2ResourceAccess,
  hasV2Permission,
} from '@/server/authorization'
import { requireAnyV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type { V2ResourceScopeContext } from '@/server/authorization/scope-types'

type RouteContext = {
  params: Promise<{ missionId: string }>
}

type MissionRow = {
  id: string
  assignment_batch_id: string | null
  template_id: string | null
  status: string | null
  facility_id: string
  primary_inspector_id: string
  assigned_user_id: string | null
  created_by: string | null
  team_template_change_allowed: boolean
  template_change_allowed_by: string | null
  template_change_allowed_at: string | null
}

type FacilityRow = {
  id: string
  facility_type: string | null
  organization_id: string
  sector_id: string | null
  governorate: string | null
}

type TemplateRow = {
  id: string
  name: string
  version: string | null
  description: string | null
  visibility: 'system' | 'organization' | 'private'
  created_by_user_id: string | null
  created_by_org: string | null
  applicable_facility_types: string[] | null
  is_active: boolean | null
}

type ActiveRunRow = {
  id: string
  template_id: string
  template_name: string
  template_version: string | null
  status: string
  source_type: string
  change_reason: string | null
  started_at: string
}

function normalizedStatus(status: string | null) {
  if (status === 'منفذة' || status === 'مكتملة') return 'completed'
  if (status === 'مغلقة') return 'closed'
  if (status === 'ملغاة') return 'cancelled'
  if (status === 'مرفوضة') return 'rejected'
  return status || 'draft'
}

function lockedStatus(status: string | null) {
  return ['completed', 'closed', 'cancelled', 'rejected', 'done'].includes(
    normalizedStatus(status)
  )
}

async function loadMissionContext(missionId: string) {
  const admin = getAdminSupabaseClient()

  const { data: missionData, error: missionError } = await admin
    .from('missions')
    .select(
      'id, assignment_batch_id, template_id, status, facility_id, primary_inspector_id, assigned_user_id, created_by, team_template_change_allowed, template_change_allowed_by, template_change_allowed_at'
    )
    .eq('id', missionId)
    .maybeSingle()

  if (missionError) {
    throw new Error(
      '[mission-checklist] failed to load mission: ' + missionError.message
    )
  }

  if (!missionData) return null
  const mission = missionData as MissionRow

  const [{ data: facilityData, error: facilityError }, { data: teamData, error: teamError }] =
    await Promise.all([
      admin
        .from('facilities')
        .select('id, facility_type, organization_id, sector_id, governorate')
        .eq('id', mission.facility_id)
        .maybeSingle(),
      admin
        .from('mission_team')
        .select('user_id, is_primary')
        .eq('mission_id', missionId),
    ])

  if (facilityError) {
    throw new Error(
      '[mission-checklist] failed to load facility: ' + facilityError.message
    )
  }

  if (teamError) {
    throw new Error(
      '[mission-checklist] failed to load team: ' + teamError.message
    )
  }

  if (!facilityData) return null
  const facility = facilityData as FacilityRow
  const teamUserIds = (teamData ?? [])
    .map((row) => (typeof row.user_id === 'string' ? row.user_id : null))
    .filter((value): value is string => Boolean(value))

  const assignedUserIds = [
    mission.assigned_user_id,
    mission.primary_inspector_id,
    ...teamUserIds,
  ].filter((value): value is string => Boolean(value))

  const resource: V2ResourceScopeContext = {
    ownerUserId: mission.created_by,
    assignedUserIds: [...new Set(assignedUserIds)],
    organizationId: facility.organization_id,
    sectorId: facility.sector_id,
    governorate: facility.governorate,
  }

  return {
    mission,
    facility,
    resource,
    teamUserIds: [...new Set(assignedUserIds)],
  }
}

async function loadVisibleTemplates(input: {
  userId: string
  currentTemplateId: string | null
  facilityType: string | null
}) {
  const admin = getAdminSupabaseClient()

  const { data: libraryRows, error: libraryError } = await admin
    .from('user_template_library')
    .select('template_id')
    .eq('user_id', input.userId)

  if (libraryError) {
    throw new Error(
      '[mission-checklist] failed to load template library: ' +
        libraryError.message
    )
  }

  const libraryIds = new Set(
    (libraryRows ?? []).map((row) => String(row.template_id))
  )

  const { data, error } = await admin
    .from('form_templates')
    .select(
      'id, name, version, description, visibility, created_by_user_id, created_by_org, applicable_facility_types, is_active'
    )
    .eq('is_active', true)
    .order('name')

  if (error) {
    throw new Error(
      '[mission-checklist] failed to load templates: ' + error.message
    )
  }

  return ((data ?? []) as TemplateRow[]).filter((template) => {
    const isCurrent = template.id === input.currentTemplateId
    const visible =
      isCurrent ||
      template.visibility === 'system' ||
      template.created_by_user_id === input.userId ||
      libraryIds.has(template.id)

    if (!visible) return false

    const types = template.applicable_facility_types
    if (!types || types.length === 0 || !input.facilityType) return true

    return isCurrent || types.includes(input.facilityType)
  })
}

async function permissionState(input: {
  userId: string
  access: Awaited<ReturnType<typeof requireAnyV2Permission>> extends infer T
    ? never
    : never
}) {
  return input
}

async function resolveAccess(input: {
  userId: string
  access: Parameters<typeof hasV2Permission>[0]
  resource: V2ResourceScopeContext
  teamUserIds: string[]
  teamChangeAllowed: boolean
}) {
  const isTeamMember = input.teamUserIds.includes(input.userId)
  let canExecuteAssigned = false
  let canManage = false

  if (isTeamMember && hasV2Permission(input.access, 'missions.execute')) {
    const decision = await checkV2ResourceAccess({
      user: {
        profileId: input.userId,
      } as never,
      snapshot: input.access,
      permissionKey: 'missions.execute',
      resource: input.resource,
    })
    canExecuteAssigned = decision.allowed
  }

  if (hasV2Permission(input.access, 'missions.checklist_change')) {
    canManage = true
  }

  return {
    isTeamMember,
    canExecuteAssigned,
    canManage,
    canChange:
      canManage ||
      (isTeamMember && canExecuteAssigned && input.teamChangeAllowed),
  }
}

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const gate = await requireAnyV2Permission([
      'missions.execute',
      'missions.checklist_change',
    ])
    if (!gate.ok) return gate.response

    const authorizedUser = gate.user
    const authorizedAccess = gate.access
    const { missionId } = await context.params
    const loaded = await loadMissionContext(missionId)

    if (!loaded) {
      return NextResponse.json(
        { error: 'المأمورية غير موجودة' },
        { status: 404 }
      )
    }

    const isTeamMember = loaded.teamUserIds.includes(
      authorizedUser.profileId
    )

    let canExecuteAssigned = false
    if (
      isTeamMember &&
      hasV2Permission(authorizedAccess, 'missions.execute')
    ) {
      const decision = await checkV2ResourceAccess({
        user: authorizedUser,
        snapshot: authorizedAccess,
        permissionKey: 'missions.execute',
        resource: loaded.resource,
      })
      canExecuteAssigned = decision.allowed
    }

    let canManage = false
    if (
      hasV2Permission(
        authorizedAccess,
        'missions.checklist_change'
      )
    ) {
      const decision = await checkV2ResourceAccess({
        user: authorizedUser,
        snapshot: authorizedAccess,
        permissionKey: 'missions.checklist_change',
        resource: loaded.resource,
      })
      canManage = decision.allowed
    }

    if (!canExecuteAssigned && !canManage) {
      return NextResponse.json(
        {
          error:
            'هذه الاستمارة مرتبطة بمأمورية لست ضمن فريق تنفيذها أو نطاق إدارتها.',
        },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()
    const { data: runData, error: runError } = await admin
      .from('mission_checklist_runs')
      .select(
        'id, template_id, template_name, template_version, status, source_type, change_reason, started_at'
      )
      .eq('mission_id', missionId)
      .eq('status', 'active')
      .maybeSingle()

    if (runError) {
      console.error('[mission-checklist:GET] run failed:', runError.message)
      return NextResponse.json(
        { error: 'تعذر تحميل جلسة الاستمارة' },
        { status: 500 }
      )
    }

    let activeRun = (runData as ActiveRunRow | null) ?? null

    if (!activeRun && loaded.mission.template_id) {
      const { data: runId, error: ensureError } = await admin.rpc(
        'ensure_active_mission_checklist_run',
        {
          p_mission_id: missionId,
          p_actor_user_id: authorizedUser.profileId,
        }
      )

      if (ensureError) {
        console.error(
          '[mission-checklist:GET] ensure run failed:',
          ensureError.message
        )
      } else if (runId) {
        const { data: ensured } = await admin
          .from('mission_checklist_runs')
          .select(
            'id, template_id, template_name, template_version, status, source_type, change_reason, started_at'
          )
          .eq('id', String(runId))
          .maybeSingle()

        activeRun = (ensured as ActiveRunRow | null) ?? null
      }
    }

    const currentTemplateId =
      activeRun?.template_id ?? loaded.mission.template_id

    const templates = await loadVisibleTemplates({
      userId: authorizedUser.profileId,
      currentTemplateId,
      facilityType: loaded.facility.facility_type,
    })

    let answerCount = 0
    if (activeRun?.id) {
      const { count } = await admin
        .from('mission_results')
        .select('id', { count: 'exact', head: true })
        .eq('mission_id', missionId)
        .eq('checklist_run_id', activeRun.id)
      answerCount = count ?? 0
    }

    return NextResponse.json({
      mission_id: missionId,
      batch_id: loaded.mission.assignment_batch_id,
      locked: lockedStatus(loaded.mission.status),
      active_run: activeRun,
      current_template_id: currentTemplateId,
      team_template_change_allowed:
        loaded.mission.team_template_change_allowed,
      template_change_allowed_at:
        loaded.mission.template_change_allowed_at,
      is_team_member: isTeamMember,
      can_manage: canManage,
      can_execute: canExecuteAssigned,
      can_change:
        !lockedStatus(loaded.mission.status) &&
        (canManage ||
          (canExecuteAssigned &&
            loaded.mission.team_template_change_allowed)),
      answer_count: answerCount,
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        version: template.version,
        description: template.description,
        visibility: template.visibility,
        applicable_facility_types:
          template.applicable_facility_types,
        is_current: template.id === currentTemplateId,
      })),
    })
  } catch (error) {
    console.error('[mission-checklist:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'تعذر تحميل استمارة المأمورية' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const gate = await requireAnyV2Permission([
      'missions.execute',
      'missions.checklist_change',
    ])
    if (!gate.ok) return gate.response

    const authorizedUser = gate.user
    const authorizedAccess = gate.access
    const { missionId } = await context.params
    const body = (await request.json()) as {
      action?: unknown
      template_id?: unknown
      reason?: unknown
      allowed?: unknown
    }

    const loaded = await loadMissionContext(missionId)
    if (!loaded) {
      return NextResponse.json(
        { error: 'المأمورية غير موجودة' },
        { status: 404 }
      )
    }

    if (lockedStatus(loaded.mission.status)) {
      return NextResponse.json(
        { error: 'لا يمكن تغيير الاستمارة بعد إنهاء المأمورية.' },
        { status: 409 }
      )
    }

    const isTeamMember = loaded.teamUserIds.includes(
      authorizedUser.profileId
    )

    let canExecuteAssigned = false
    if (
      isTeamMember &&
      hasV2Permission(authorizedAccess, 'missions.execute')
    ) {
      const decision = await checkV2ResourceAccess({
        user: authorizedUser,
        snapshot: authorizedAccess,
        permissionKey: 'missions.execute',
        resource: loaded.resource,
      })
      canExecuteAssigned = decision.allowed
    }

    let canManage = false
    if (
      hasV2Permission(
        authorizedAccess,
        'missions.checklist_change'
      )
    ) {
      const decision = await checkV2ResourceAccess({
        user: authorizedUser,
        snapshot: authorizedAccess,
        permissionKey: 'missions.checklist_change',
        resource: loaded.resource,
      })
      canManage = decision.allowed
    }

    const action =
      typeof body.action === 'string' ? body.action : 'change_template'

    const admin = getAdminSupabaseClient()

    if (action === 'set_team_change_allowed') {
      if (!canManage) {
        return NextResponse.json(
          {
            error:
              'تغيير سياسة الاستمارة متاح لمركز المعلومات أو من يملك صلاحية إدارة استمارات المأموريات.',
          },
          { status: 403 }
        )
      }

      if (typeof body.allowed !== 'boolean') {
        return NextResponse.json(
          { error: 'قيمة السماح غير صحيحة.' },
          { status: 400 }
        )
      }

      const { error } = await admin.rpc(
        'set_mission_team_template_change_allowed',
        {
          p_mission_id: missionId,
          p_actor_user_id: authorizedUser.profileId,
          p_allowed: body.allowed,
        }
      )

      if (error) {
        console.error(
          '[mission-checklist:POST] policy failed:',
          error.message
        )
        return NextResponse.json(
          { error: 'تعذر تحديث صلاحية تغيير الاستمارة.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        team_template_change_allowed: body.allowed,
      })
    }

    const canTeamChange =
      isTeamMember &&
      canExecuteAssigned &&
      loaded.mission.team_template_change_allowed

    if (!canManage && !canTeamChange) {
      return NextResponse.json(
        {
          error:
            'تغيير الاستمارة غير متاح لك. يمكن لمركز المعلومات فتح هذا الحق لأعضاء الفريق عند الحاجة.',
        },
        { status: 403 }
      )
    }

    const templateId =
      typeof body.template_id === 'string'
        ? body.template_id.trim()
        : ''
    const reason =
      typeof body.reason === 'string' ? body.reason.trim() : ''

    if (!templateId || !reason) {
      return NextResponse.json(
        {
          error:
            'اختر الاستمارة الجديدة واكتب سبب التغيير.',
        },
        { status: 400 }
      )
    }

    const templates = await loadVisibleTemplates({
      userId: authorizedUser.profileId,
      currentTemplateId: loaded.mission.template_id,
      facilityType: loaded.facility.facility_type,
    })

    if (!templates.some((template) => template.id === templateId)) {
      return NextResponse.json(
        {
          error:
            'الاستمارة المختارة غير متاحة لك أو غير متوافقة مع نوع المنشأة.',
        },
        { status: 403 }
      )
    }

    const { data, error } = await admin.rpc(
      'change_mission_checklist_template',
      {
        p_mission_id: missionId,
        p_template_id: templateId,
        p_actor_user_id: authorizedUser.profileId,
        p_reason: reason,
      }
    )

    if (error) {
      const message = error.message || ''
      if (message.includes('MISSION_TEMPLATE_CHANGE_LOCKED')) {
        return NextResponse.json(
          { error: 'لا يمكن تغيير الاستمارة بعد إنهاء المأمورية.' },
          { status: 409 }
        )
      }

      console.error(
        '[mission-checklist:POST] change failed:',
        error.message
      )
      return NextResponse.json(
        { error: 'تعذر تغيير استمارة المأمورية.' },
        { status: 500 }
      )
    }

    const row = Array.isArray(data) ? data[0] : data

    return NextResponse.json({
      success: true,
      checklist_run_id:
        row && typeof row === 'object'
          ? String(
              (row as { checklist_run_id?: string }).checklist_run_id ||
                ''
            )
          : '',
      template_id: templateId,
      archived_answer_count:
        row && typeof row === 'object'
          ? Number(
              (row as { archived_answer_count?: number })
                .archived_answer_count || 0
            )
          : 0,
    })
  } catch (error) {
    console.error('[mission-checklist:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'تعذر تحديث استمارة المأمورية.' },
      { status: 500 }
    )
  }
}
