import { NextResponse } from 'next/server'
import { checkV2ResourceAccess } from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type ClaimInputItem = {
  assignment_batch_id?: unknown
  accommodation_type?: unknown
  accommodation_details?: unknown
  accommodation_cost_claimed?: unknown
  transport_mode?: unknown
  departure_location?: unknown
  return_location?: unknown
  transport_details?: unknown
  transport_cost_claimed?: unknown
  employee_notes?: unknown
}

const ACCOMMODATION_TYPES = new Set([
  'none', 'government', 'hotel', 'self_arranged', 'other',
])
const TRANSPORT_MODES = new Set([
  'ministry_vehicle', 'public_transport', 'private_vehicle', 'rail', 'air', 'other',
])

function cleanText(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cleanCost(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value || 0)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export async function GET() {
  try {
    const gate = await requireV2Permission('missions.execute')
    if (!gate.ok) return gate.response

    const admin = getAdminSupabaseClient()
    const userId = gate.user.profileId
    const { data: teamRows, error: teamError } = await admin
      .from('mission_team')
      .select('mission_id')
      .eq('user_id', userId)

    if (teamError) throw new Error(teamError.message)

    const teamMissionIds = (teamRows ?? []).map((row) => String(row.mission_id))
    const { data: directMissions, error: directError } = await admin
      .from('missions')
      .select('id, assignment_batch_id, facility_id, created_by, primary_inspector_id, assigned_user_id')
      .or(`primary_inspector_id.eq.${userId},assigned_user_id.eq.${userId}`)

    if (directError) throw new Error(directError.message)

    const directIds = (directMissions ?? []).map((row) => String(row.id))
    const allMissionIds = [...new Set([...teamMissionIds, ...directIds])]
    const { data: teamMissions, error: missionsError } = allMissionIds.length
      ? await admin
          .from('missions')
          .select('id, assignment_batch_id, facility_id, created_by, primary_inspector_id, assigned_user_id')
          .in('id', allMissionIds)
      : { data: [], error: null }

    if (missionsError) throw new Error(missionsError.message)

    const missionRows = teamMissions ?? []
    const batchIds = [...new Set(
      missionRows
        .map((row) => row.assignment_batch_id ? String(row.assignment_batch_id) : '')
        .filter(Boolean)
    )]
    const facilityIds = [...new Set(missionRows.map((row) => String(row.facility_id)))]

    const [{ data: batches, error: batchError }, { data: facilities, error: facilityError }, { data: existingItems, error: itemError }] =
      await Promise.all([
        batchIds.length
          ? admin.from('mission_assignment_batches')
              .select('id, scheduled_date, expected_end_date, actual_start_date, actual_end_date, actual_duration_days, actual_overnight_nights, status, mission_count, visit_purpose')
              .in('id', batchIds)
          : Promise.resolve({ data: [], error: null }),
        facilityIds.length
          ? admin.from('facilities')
              .select('id, name, organization_id, sector_id, governorate, health_admin')
              .in('id', facilityIds)
          : Promise.resolve({ data: [], error: null }),
        admin.from('mission_financial_claim_items')
          .select('assignment_batch_id')
          .eq('user_id', userId),
      ])

    if (batchError || facilityError || itemError) {
      throw new Error(batchError?.message || facilityError?.message || itemError?.message)
    }

    const facilityById = new Map((facilities ?? []).map((row) => [String(row.id), row]))
    const missionsByBatch = new Map<string, typeof missionRows>()
    for (const mission of missionRows) {
      if (!mission.assignment_batch_id) continue
      const key = String(mission.assignment_batch_id)
      missionsByBatch.set(key, [...(missionsByBatch.get(key) ?? []), mission])
    }
    const submittedBatchIds = new Set((existingItems ?? []).map((row) => String(row.assignment_batch_id)))

    const eligible = []
    for (const batch of batches ?? []) {
      const batchId = String(batch.id)
      if (!['completed', 'closed'].includes(String(batch.status)) ||
          !batch.actual_start_date || !batch.actual_end_date ||
          batch.actual_duration_days == null || batch.actual_overnight_nights == null ||
          submittedBatchIds.has(batchId)) continue

      const batchMissions = missionsByBatch.get(batchId) ?? []
      const facilityRows = batchMissions
        .map((mission) => facilityById.get(String(mission.facility_id)))
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
      if (facilityRows.length === 0) continue

      const permitted = await Promise.all(facilityRows.map((facility) =>
        checkV2ResourceAccess({
          user: gate.user,
          snapshot: gate.access,
          permissionKey: 'missions.execute',
          resource: {
            assignedUserIds: [userId],
            organizationId: String(facility.organization_id),
            sectorId: facility.sector_id ? String(facility.sector_id) : null,
            governorate: typeof facility.governorate === 'string' ? facility.governorate : null,
          },
        })
      ))
      if (permitted.some((decision) => !decision.allowed)) continue

      eligible.push({
        id: batchId,
        actual_start_date: batch.actual_start_date,
        actual_end_date: batch.actual_end_date,
        actual_duration_days: Number(batch.actual_duration_days),
        actual_overnight_nights: Number(batch.actual_overnight_nights),
        mission_count: Number(batch.mission_count || facilityRows.length),
        visit_purpose: batch.visit_purpose,
        governorate: facilityRows[0]?.governorate ?? null,
        health_admins: [...new Set(facilityRows.map((row) => row.health_admin).filter(Boolean))],
        facilities: [...new Set(facilityRows.map((row) => String(row.name)))],
      })
    }

    const { data: claims, error: claimsError } = await admin
      .from('mission_financial_claims')
      .select('id, claim_number, status, employee_notes, submitted_at, returned_at, return_reason, approved_at, paid_at')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(100)
    if (claimsError) throw new Error(claimsError.message)

    const claimIds = (claims ?? []).map((row) => String(row.id))
    const { data: claimItems, error: claimItemsError } = claimIds.length
      ? await admin.from('mission_financial_claim_items')
          .select('id, claim_id, assignment_batch_id, governorate, destination_summary, actual_start_date, actual_end_date, actual_duration_days, overnight_nights, accommodation_type, accommodation_details, accommodation_cost_claimed, transport_mode, departure_location, return_location, transport_details, transport_cost_claimed, employee_notes')
          .in('claim_id', claimIds)
          .order('actual_start_date', { ascending: true })
      : { data: [], error: null }
    if (claimItemsError) throw new Error(claimItemsError.message)

    return NextResponse.json({ eligible, claims: (claims ?? []).map((claim) => ({
      ...claim,
      items: (claimItems ?? []).filter((item) => String(item.claim_id) === String(claim.id)),
    })) })
  } catch (error) {
    console.error('[finance-claims:GET] failed:', error)
    return NextResponse.json({ error: 'تعذر تحميل طلبات الاستحقاق المالي' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('missions.execute')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as { items?: ClaimInputItem[]; employee_notes?: unknown }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 30) {
      return NextResponse.json({ error: 'اختر مأمورية واحدة على الأقل وبحد أقصى 30 مأمورية' }, { status: 400 })
    }

    const items = body.items.map((item) => {
      const batchId = cleanText(item.assignment_batch_id, 80)
      const accommodationType = cleanText(item.accommodation_type, 40) || 'none'
      const transportMode = cleanText(item.transport_mode, 40)
      const departureLocation = cleanText(item.departure_location, 500)
      const returnLocation = cleanText(item.return_location, 500)
      const accommodationCost = cleanCost(item.accommodation_cost_claimed)
      const transportCost = cleanCost(item.transport_cost_claimed)

      if (!batchId || !ACCOMMODATION_TYPES.has(accommodationType) ||
          !TRANSPORT_MODES.has(transportMode) || !departureLocation || !returnLocation ||
          accommodationCost == null || transportCost == null) {
        throw new Error('CLAIM_INPUT_INVALID')
      }

      return {
        assignment_batch_id: batchId,
        accommodation_type: accommodationType,
        accommodation_details: cleanText(item.accommodation_details),
        accommodation_cost_claimed: accommodationCost,
        transport_mode: transportMode,
        departure_location: departureLocation,
        return_location: returnLocation,
        transport_details: cleanText(item.transport_details),
        transport_cost_claimed: transportCost,
        employee_notes: cleanText(item.employee_notes),
      }
    })

    if (new Set(items.map((item) => item.assignment_batch_id)).size !== items.length) {
      return NextResponse.json({ error: 'لا يمكن تكرار التكليف داخل الطلب نفسه' }, { status: 400 })
    }

    const admin = getAdminSupabaseClient()
    const { data, error } = await admin.rpc('submit_employee_mission_financial_claim', {
      p_actor_user_id: gate.user.profileId,
      p_items: items,
      p_employee_notes: cleanText(body.employee_notes, 4000) || null,
    })

    if (error) {
      const message = error.message || ''
      const known = message.includes('ALREADY_SUBMITTED')
        ? 'سبق إدراج أحد التكليفات المحددة في طلب مالي'
        : message.includes('NOT_TEAM_MEMBER')
          ? 'لا يمكنك طلب استحقاق عن تكليف لست عضوًا في فريقه'
          : message.includes('NOT_READY')
            ? 'يوجد تكليف لم يُنهَ أو لم تُثبت مدته الفعلية بعد'
            : message.includes('TRAVEL')
              ? 'بيانات الإقامة أو المواصلات غير مكتملة'
              : 'تعذر إرسال طلب الاستحقاق المالي'
      return NextResponse.json({ error: known }, { status: 409 })
    }

    const row = Array.isArray(data) ? data[0] : data
    return NextResponse.json({ success: true, claim: row })
  } catch (error) {
    if (error instanceof Error && error.message === 'CLAIM_INPUT_INVALID') {
      return NextResponse.json({ error: 'راجع بيانات الإقامة والمواصلات لكل مأمورية' }, { status: 400 })
    }
    console.error('[finance-claims:POST] failed:', error)
    return NextResponse.json({ error: 'تعذر إرسال طلب الاستحقاق المالي' }, { status: 500 })
  }
}
