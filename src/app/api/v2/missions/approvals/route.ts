import { NextResponse } from 'next/server'
import { checkV2ResourceAccess } from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type MissionApprovalRow = {
  id: string
  assignment_batch_id: string | null
  serial_number: string
  facility_id: string
  status: string | null
}

type FacilityScopeRow = {
  id: string
  name: string
  organization_id: string
  sector_id: string | null
  governorate: string | null
}

async function loadBatchMissionScopes(batchId: string) {
  const admin = getAdminSupabaseClient()
  const { data: missionRows, error: missionError } = await admin
    .from('missions')
    .select('id, assignment_batch_id, serial_number, facility_id, status')
    .eq('assignment_batch_id', batchId)

  if (missionError) {
    throw new Error(
      `[mission-approvals] failed to load batch missions: ${missionError.message}`
    )
  }

  const missions = (missionRows ?? []) as MissionApprovalRow[]
  const facilityIds = [
    ...new Set(missions.map((mission) => mission.facility_id)),
  ]

  if (facilityIds.length === 0) {
    return { missions, facilities: new Map<string, FacilityScopeRow>() }
  }

  const { data: facilityRows, error: facilityError } = await admin
    .from('facilities')
    .select('id, name, organization_id, sector_id, governorate')
    .in('id', facilityIds)

  if (facilityError) {
    throw new Error(
      `[mission-approvals] failed to load facilities: ${facilityError.message}`
    )
  }

  const facilities = new Map(
    ((facilityRows ?? []) as FacilityScopeRow[]).map((facility) => [
      facility.id,
      facility,
    ])
  )

  return { missions, facilities }
}

async function canApproveWholeBatch(input: {
  batchId: string
  user: Parameters<typeof checkV2ResourceAccess>[0]['user']
  snapshot: Parameters<typeof checkV2ResourceAccess>[0]['snapshot']
}) {
  const { missions, facilities } = await loadBatchMissionScopes(input.batchId)

  if (missions.length === 0) {
    return { allowed: false as const, missions, facilities }
  }

  for (const mission of missions) {
    const facility = facilities.get(mission.facility_id)
    if (!facility) {
      return { allowed: false as const, missions, facilities }
    }

    const decision = await checkV2ResourceAccess({
      user: input.user,
      snapshot: input.snapshot,
      permissionKey: 'missions.approve',
      resource: {
        organizationId: facility.organization_id,
        sectorId: facility.sector_id,
        governorate: facility.governorate,
      },
    })

    if (!decision.allowed) {
      return { allowed: false as const, missions, facilities }
    }
  }

  return { allowed: true as const, missions, facilities }
}

export async function GET() {
  try {
    const gate = await requireV2Permission('missions.approve')
    if (!gate.ok) return gate.response

    const admin = getAdminSupabaseClient()
    const { data: batches, error } = await admin
      .from('mission_assignment_batches')
      .select(
        'id, created_by, created_by_org, template_id, scheduled_date, expected_end_date, priority, visit_purpose, notes, requires_overnight, requires_hotel_booking, mission_count, status, submitted_at, created_at'
      )
      .eq('status', 'pending_approval')
      .order('submitted_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[mission-approvals:GET] batch query failed:', error.message)
      return NextResponse.json(
        { error: 'تعذر تحميل التكليفات بانتظار الاعتماد' },
        { status: 500 }
      )
    }

    const creatorIds = [
      ...new Set((batches ?? []).map((batch) => String(batch.created_by))),
    ]
    const templateIds = [
      ...new Set((batches ?? []).map((batch) => String(batch.template_id))),
    ]

    const [
      { data: creators },
      { data: templates },
    ] = await Promise.all([
      creatorIds.length
        ? admin
            .from('users')
            .select('id, full_name')
            .in('id', creatorIds)
        : Promise.resolve({ data: [] }),
      templateIds.length
        ? admin
            .from('form_templates')
            .select('id, name')
            .in('id', templateIds)
        : Promise.resolve({ data: [] }),
    ])

    const creatorNames = new Map(
      (creators ?? []).map((row) => [String(row.id), String(row.full_name)])
    )
    const templateNames = new Map(
      (templates ?? []).map((row) => [String(row.id), String(row.name)])
    )

    const visible = []

    for (const batch of batches ?? []) {
      const scope = await canApproveWholeBatch({
        batchId: String(batch.id),
        user: gate.user,
        snapshot: gate.access,
      })

      if (!scope.allowed) continue

      visible.push({
        id: String(batch.id),
        scheduled_date: batch.scheduled_date,
        expected_end_date: batch.expected_end_date,
        priority: batch.priority,
        visit_purpose: batch.visit_purpose,
        notes: batch.notes,
        requires_overnight: batch.requires_overnight === true,
        requires_hotel_booking: batch.requires_hotel_booking === true,
        mission_count: batch.mission_count,
        submitted_at: batch.submitted_at,
        created_by_name:
          creatorNames.get(String(batch.created_by)) || 'مستخدم غير مسمى',
        template_name:
          templateNames.get(String(batch.template_id)) || 'نموذج غير مسمى',
        missions: scope.missions.map((mission) => ({
          id: mission.id,
          serial_number: mission.serial_number,
          facility_id: mission.facility_id,
          facility_name:
            scope.facilities.get(mission.facility_id)?.name || 'منشأة غير مسماة',
        })),
      })
    }

    return NextResponse.json({ batches: visible })
  } catch (error) {
    console.error('[mission-approvals:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء تحميل الاعتمادات' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('missions.approve')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const batchId = typeof body.batch_id === 'string' ? body.batch_id : ''
    const action = body.action === 'reject' ? 'reject' : 'approve'
    const reason =
      typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : ''

    if (!batchId) {
      return NextResponse.json(
        { error: 'معرف دفعة التكليف مطلوب' },
        { status: 400 }
      )
    }

    if (action === 'reject' && !reason) {
      return NextResponse.json(
        { error: 'سبب الرفض مطلوب' },
        { status: 400 }
      )
    }

    const scope = await canApproveWholeBatch({
      batchId,
      user: gate.user,
      snapshot: gate.access,
    })

    if (!scope.allowed) {
      return NextResponse.json(
        {
          error: 'تحتوي دفعة التكليف على مأمورية خارج نطاق اعتمادك',
          code: 'BATCH_SCOPE_DENIED',
        },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()

    const { data: batch } = await admin
      .from('mission_assignment_batches')
      .select('id, status')
      .eq('id', batchId)
      .maybeSingle()

    if (!batch || batch.status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'دفعة التكليف لم تعد بانتظار الاعتماد' },
        { status: 409 }
      )
    }

    const rpcName =
      action === 'approve'
        ? 'approve_v2_mission_assignment_batch'
        : 'reject_v2_mission_assignment_batch'

    const args =
      action === 'approve'
        ? {
            p_batch_id: batchId,
            p_actor_user_id: gate.user.profileId,
          }
        : {
            p_batch_id: batchId,
            p_actor_user_id: gate.user.profileId,
            p_reason: reason,
          }

    const { data: changedCount, error: rpcError } = await admin.rpc(
      rpcName,
      args
    )

    if (rpcError) {
      console.error('[mission-approvals:POST] rpc failed:', rpcError.message)
      return NextResponse.json(
        { error: 'تعذر تحديث اعتماد دفعة التكليف' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      action,
      changed_count: Number(changedCount ?? 0),
    })
  } catch (error) {
    console.error('[mission-approvals:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء اعتماد التكليف' },
      { status: 500 }
    )
  }
}
