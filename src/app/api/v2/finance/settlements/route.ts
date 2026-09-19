import { NextResponse } from 'next/server'
import {
  checkV2ResourceAccess,
  evaluateV2ResourceScope,
  hasV2Permission,
} from '@/server/authorization'
import {
  requireAnyV2Permission,
  requireV2Permission,
} from '@/server/authorization/http-guard'
import { loadV2OrganizationFacts } from '@/server/authorization/organization-scope-repository'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type SettlementRow = {
  id: string
  mission_id: string
  user_id: string
  scope_org_id: string
  status: string
  currency: string
  mission_days: number
  overnight_nights: number
  fixed_amount: number
  daily_rate: number
  daily_amount: number
  overnight_rate: number
  overnight_amount: number
  bonus_amount: number
  adjustment_amount: number
  total_amount: number
  notes: string | null
  rejection_reason: string | null
  payment_reference: string | null
  prepared_at: string | null
  approved_at: string | null
  paid_at: string | null
  created_at: string
}

async function loadSettlement(settlementId: string) {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('mission_financial_settlements')
    .select(
      'id, mission_id, user_id, scope_org_id, status, currency, mission_days, overnight_nights, fixed_amount, daily_rate, daily_amount, overnight_rate, overnight_amount, bonus_amount, adjustment_amount, total_amount, notes, rejection_reason, payment_reference, prepared_at, approved_at, paid_at, created_at'
    )
    .eq('id', settlementId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `[finance] failed to load settlement: ${error.message}`
    )
  }

  return (data as SettlementRow | null) ?? null
}

async function authorizeSettlement(input: {
  settlement: SettlementRow
  permissionKey: string
  gate: Extract<
    Awaited<ReturnType<typeof requireAnyV2Permission>>,
    { ok: true }
  >
}) {
  const admin = getAdminSupabaseClient()
  const { data: organization, error } = await admin
    .from('organizations')
    .select('id, sector_id, governorate, organization_type_code')
    .eq('id', input.settlement.scope_org_id)
    .maybeSingle()

  if (error || !organization) {
    return false
  }

  const decision = await checkV2ResourceAccess({
    user: input.gate.user,
    snapshot: input.gate.access,
    permissionKey: input.permissionKey,
    resource: {
      organizationId: String(organization.id),
      sectorId:
        organization.organization_type_code === 'sector'
          ? String(organization.id)
          : organization.sector_id
            ? String(organization.sector_id)
            : null,
      governorate:
        typeof organization.governorate === 'string'
          ? organization.governorate
          : null,
    },
  })

  return decision.allowed
}

export async function GET() {
  try {
    const gate = await requireV2Permission('finance.view')
    if (!gate.ok) return gate.response

    const admin = getAdminSupabaseClient()
    const { data: settlementRows, error } = await admin
      .from('mission_financial_settlements')
      .select(
        'id, mission_id, user_id, scope_org_id, status, currency, mission_days, overnight_nights, fixed_amount, daily_rate, daily_amount, overnight_rate, overnight_amount, bonus_amount, adjustment_amount, total_amount, notes, rejection_reason, payment_reference, prepared_at, approved_at, paid_at, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(600)

    if (error) {
      console.error('[finance:GET] settlements failed:', error.message)
      return NextResponse.json(
        { error: 'تعذر تحميل الاستحقاقات المالية' },
        { status: 500 }
      )
    }

    const settlements = (settlementRows ?? []) as SettlementRow[]
    const factIds = new Set<string>(
      settlements.map((settlement) => settlement.scope_org_id)
    )

    if (gate.user.organizationId) factIds.add(gate.user.organizationId)

    for (const role of gate.access.roles) {
      if (role.assignmentOrganizationId) {
        factIds.add(role.assignmentOrganizationId)
      }
    }

    const organizationFacts =
      factIds.size > 0
        ? await loadV2OrganizationFacts([...factIds])
        : new Map()

    const visible = settlements.filter((settlement) => {
      const fact = organizationFacts.get(settlement.scope_org_id)
      if (!fact) return false

      return evaluateV2ResourceScope({
        user: gate.user,
        snapshot: gate.access,
        permissionKey: 'finance.view',
        organizationFacts,
        resource: {
          organizationId: settlement.scope_org_id,
          sectorId:
            fact.organizationTypeCode === 'sector'
              ? fact.id
              : fact.sectorId,
          governorate: fact.governorate,
        },
      }).allowed
    })

    const missionIds = [
      ...new Set(visible.map((settlement) => settlement.mission_id)),
    ]
    const userIds = [
      ...new Set(visible.map((settlement) => settlement.user_id)),
    ]

    const [
      { data: missions, error: missionsError },
      { data: users, error: usersError },
    ] = await Promise.all([
      missionIds.length
        ? admin
            .from('missions')
            .select(
              'id, serial_number, facility_id, scheduled_date, expected_end_date, completed_at, status, checkin_time, checkout_time, gps_verified, duration_minutes'
            )
            .in('id', missionIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin
            .from('users')
            .select('id, full_name, job_title, organization_id')
            .in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (missionsError || usersError) {
      return NextResponse.json(
        { error: 'تعذر تحميل بيانات المأموريات أو المستحقين' },
        { status: 500 }
      )
    }

    const facilityIds = [
      ...new Set((missions ?? []).map((mission) => String(mission.facility_id))),
    ]
    const { data: facilities, error: facilityError } = facilityIds.length
      ? await admin
          .from('facilities')
          .select('id, name, health_admin, governorate')
          .in('id', facilityIds)
      : { data: [], error: null }

    if (facilityError) {
      return NextResponse.json(
        { error: 'تعذر تحميل بيانات المنشآت' },
        { status: 500 }
      )
    }

    const missionById = new Map(
      (missions ?? []).map((row) => [String(row.id), row])
    )
    const userById = new Map(
      (users ?? []).map((row) => [String(row.id), row])
    )
    const facilityById = new Map(
      (facilities ?? []).map((row) => [String(row.id), row])
    )

    return NextResponse.json({
      permissions: {
        prepare: hasV2Permission(gate.access, 'finance.prepare'),
        approve: hasV2Permission(gate.access, 'finance.approve'),
        reject: hasV2Permission(gate.access, 'finance.reject'),
        mark_paid: hasV2Permission(gate.access, 'finance.mark_paid'),
      },
      settlements: visible.map((settlement) => {
        const mission = missionById.get(settlement.mission_id)
        const user = userById.get(settlement.user_id)
        const facility = mission
          ? facilityById.get(String(mission.facility_id))
          : null

        return {
          ...settlement,
          mission_serial_number: mission
            ? String(mission.serial_number)
            : 'غير متاح',
          mission_status: mission ? mission.status : null,
          scheduled_date: mission ? mission.scheduled_date : null,
          completed_at: mission ? mission.completed_at : null,
          checkin_time: mission ? mission.checkin_time : null,
          checkout_time: mission ? mission.checkout_time : null,
          gps_verified: mission ? mission.gps_verified === true : false,
          duration_minutes: mission ? mission.duration_minutes : null,
          beneficiary_name: user
            ? String(user.full_name)
            : 'مستخدم غير مسمى',
          beneficiary_job_title:
            user && typeof user.job_title === 'string'
              ? user.job_title
              : null,
          facility_name: facility
            ? String(facility.name)
            : 'منشأة غير مسماة',
          health_admin:
            facility && typeof facility.health_admin === 'string'
              ? facility.health_admin
              : null,
          governorate:
            facility && typeof facility.governorate === 'string'
              ? facility.governorate
              : null,
        }
      }),
    })
  } catch (error) {
    console.error('[finance:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء تحميل الاستحقاقات المالية' },
      { status: 500 }
    )
  }
}

function numberValue(value: unknown, fallback = 0) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : fallback
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function POST(request: Request) {
  try {
    const gate = await requireAnyV2Permission([
      'finance.prepare',
      'finance.approve',
      'finance.reject',
      'finance.mark_paid',
    ])
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const settlementId =
      typeof body.settlement_id === 'string' ? body.settlement_id : ''
    const action =
      body.action === 'approve' ||
      body.action === 'reject' ||
      body.action === 'mark_paid'
        ? body.action
        : 'prepare'

    if (!settlementId) {
      return NextResponse.json(
        { error: 'معرف التسوية المالية مطلوب' },
        { status: 400 }
      )
    }

    const permissionByAction = {
      prepare: 'finance.prepare',
      approve: 'finance.approve',
      reject: 'finance.reject',
      mark_paid: 'finance.mark_paid',
    } as const

    const requiredPermission = permissionByAction[action]

    if (!hasV2Permission(gate.access, requiredPermission)) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية هذا الإجراء المالي' },
        { status: 403 }
      )
    }

    const settlement = await loadSettlement(settlementId)
    if (!settlement) {
      return NextResponse.json(
        { error: 'التسوية المالية غير موجودة' },
        { status: 404 }
      )
    }

    const allowed = await authorizeSettlement({
      settlement,
      permissionKey: requiredPermission,
      gate,
    })

    if (!allowed) {
      return NextResponse.json(
        {
          error: 'التسوية المالية خارج نطاقك',
          code: 'FINANCE_SCOPE_DENIED',
        },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()

    if (action === 'prepare') {
      const missionDays = Math.max(1, Math.trunc(numberValue(body.mission_days, 1)))
      const overnightNights = Math.max(
        0,
        Math.trunc(numberValue(body.overnight_nights, 0))
      )
      const fixedAmount = numberValue(body.fixed_amount)
      const dailyRate = numberValue(body.daily_rate)
      const overnightRate = numberValue(body.overnight_rate)
      const bonusAmount = numberValue(body.bonus_amount)
      const adjustmentAmount = numberValue(body.adjustment_amount)
      const notes =
        typeof body.notes === 'string' ? body.notes.trim().slice(0, 4000) : null

      if (
        fixedAmount < 0 ||
        dailyRate < 0 ||
        overnightRate < 0 ||
        bonusAmount < 0
      ) {
        return NextResponse.json(
          { error: 'القيم الأساسية والمكافآت لا يمكن أن تكون سالبة' },
          { status: 400 }
        )
      }

      const { error } = await admin.rpc(
        'prepare_mission_financial_settlement',
        {
          p_settlement_id: settlementId,
          p_actor_user_id: gate.user.profileId,
          p_mission_days: missionDays,
          p_overnight_nights: overnightNights,
          p_fixed_amount: fixedAmount,
          p_daily_rate: dailyRate,
          p_overnight_rate: overnightRate,
          p_bonus_amount: bonusAmount,
          p_adjustment_amount: adjustmentAmount,
          p_notes: notes,
        }
      )

      if (error) {
        console.error('[finance:POST] prepare failed:', error.message)
        return NextResponse.json(
          { error: 'تعذر إعداد التسوية المالية' },
          { status: 500 }
        )
      }
    } else if (action === 'approve') {
      const { error } = await admin.rpc(
        'approve_mission_financial_settlement',
        {
          p_settlement_id: settlementId,
          p_actor_user_id: gate.user.profileId,
        }
      )

      if (error) {
        console.error('[finance:POST] approve failed:', error.message)
        return NextResponse.json(
          { error: 'تعذر اعتماد التسوية المالية' },
          { status: 500 }
        )
      }
    } else if (action === 'reject') {
      const reason =
        typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : ''

      if (!reason) {
        return NextResponse.json(
          { error: 'سبب الرفض مطلوب' },
          { status: 400 }
        )
      }

      const { error } = await admin.rpc(
        'reject_mission_financial_settlement',
        {
          p_settlement_id: settlementId,
          p_actor_user_id: gate.user.profileId,
          p_reason: reason,
        }
      )

      if (error) {
        console.error('[finance:POST] reject failed:', error.message)
        return NextResponse.json(
          { error: 'تعذر رفض التسوية المالية' },
          { status: 500 }
        )
      }
    } else {
      const paymentReference =
        typeof body.payment_reference === 'string'
          ? body.payment_reference.trim().slice(0, 500)
          : ''

      if (!paymentReference) {
        return NextResponse.json(
          { error: 'مرجع الصرف مطلوب' },
          { status: 400 }
        )
      }

      const { error } = await admin.rpc(
        'mark_mission_financial_settlement_paid',
        {
          p_settlement_id: settlementId,
          p_actor_user_id: gate.user.profileId,
          p_payment_reference: paymentReference,
        }
      )

      if (error) {
        console.error('[finance:POST] payment failed:', error.message)
        return NextResponse.json(
          { error: 'تعذر تسجيل صرف الاستحقاق' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true, action })
  } catch (error) {
    console.error('[finance:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء تحديث التسوية المالية' },
      { status: 500 }
    )
  }
}
