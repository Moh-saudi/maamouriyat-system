import { NextResponse } from 'next/server'
import { checkV2ResourceAccess } from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { loadMissionResourceScope } from '@/server/authorization/resources/mission'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type RouteContext = { params: Promise<{ missionId: string }> }
type Payload = {
  action?: 'start' | 'not_performed'
  reason?: string
  reason_code?: string
  latitude?: number
  longitude?: number
}

const NON_EXECUTION_REASON_CODES = new Set([
  'facility_closed',
  'access_blocked',
  'reception_refused',
  'wrong_address',
  'facility_changed',
  'team_emergency',
  'other',
])

function validCoordinate(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function distanceMetres(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const radius = 6371e3
  const toRadians = (value: number) => (value * Math.PI) / 180
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const gate = await requireV2Permission('missions.execute')
    if (!gate.ok) return gate.response

    const { missionId } = await context.params
    const body = (await request.json()) as Payload
    if (!['start', 'not_performed'].includes(body.action || '')) {
      return NextResponse.json({ error: 'الإجراء غير صحيح.' }, { status: 400 })
    }
    if (!validCoordinate(body.latitude, -90, 90) || !validCoordinate(body.longitude, -180, 180)) {
      return NextResponse.json({ error: 'تعذر التحقق من إحداثيات الموقع.' }, { status: 400 })
    }
    if (body.action === 'not_performed' && (body.reason?.trim().length || 0) < 5) {
      return NextResponse.json({ error: 'سبب عدم التنفيذ إلزامي.' }, { status: 400 })
    }
    if (
      body.action === 'not_performed' &&
      !NON_EXECUTION_REASON_CODES.has(body.reason_code || '')
    ) {
      return NextResponse.json({ error: 'اختر سبب تعذر المرور.' }, { status: 400 })
    }

    const admin = getAdminSupabaseClient()
    const { data: mission } = await admin
      .from('missions')
      .select('id, status, facility_id, target_facility_id, assigned_user_id, primary_inspector_id')
      .eq('id', missionId)
      .maybeSingle()
    if (!mission) return NextResponse.json({ error: 'المأمورية غير موجودة.' }, { status: 404 })

    const { data: teamMember } = await admin
      .from('mission_team')
      .select('user_id')
      .eq('mission_id', missionId)
      .eq('user_id', gate.user.profileId)
      .maybeSingle()
    const isTeamMember =
      mission.assigned_user_id === gate.user.profileId ||
      mission.primary_inspector_id === gate.user.profileId ||
      Boolean(teamMember)
    if (!isTeamMember) {
      return NextResponse.json({ error: 'تسجيل التنفيذ متاح لأعضاء فريق المأمورية فقط.' }, { status: 403 })
    }

    const resource = await loadMissionResourceScope(missionId)
    if (!resource) return NextResponse.json({ error: 'تعذر تحديد نطاق المأمورية.' }, { status: 404 })
    const decision = await checkV2ResourceAccess({
      user: gate.user,
      snapshot: gate.access,
      permissionKey: 'missions.execute',
      resource,
    })
    if (!decision.allowed) return NextResponse.json({ error: 'المأمورية خارج نطاق التنفيذ المسموح.' }, { status: 403 })

    const status = String(mission.status || '')
    if (['completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'].includes(status)) {
      return NextResponse.json({ error: 'تم تسجيل نتيجة هذه المنشأة بالفعل.' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const facilityId = mission.target_facility_id || mission.facility_id
    const { data: facility } = await admin
      .from('facilities')
      .select('latitude, longitude')
      .eq('id', facilityId)
      .maybeSingle()
    const hasOfficialCoordinates =
      facility?.latitude !== null &&
      facility?.latitude !== undefined &&
      facility?.longitude !== null &&
      facility?.longitude !== undefined
    const distance = hasOfficialCoordinates
      ? distanceMetres(
          body.latitude!,
          body.longitude!,
          Number(facility.latitude),
          Number(facility.longitude)
        )
      : null
    const gpsVerified = distance === null ? false : distance <= 200
    const common = {
      gps_verified: body.action === 'not_performed' ? false : gpsVerified,
      actual_facility_id: facilityId,
      outcome_recorded_by: gate.user.profileId,
      outcome_recorded_at: now,
      updated_at: now,
    }
    const update = body.action === 'start'
      ? {
          ...common,
          status: 'in_progress',
          checkin_time: now,
          checkin_lat: body.latitude,
          checkin_lng: body.longitude,
        }
      : {
          ...common,
          status: 'completed',
          execution_outcome: 'not_performed',
          non_execution_reason_code: body.reason_code,
          non_execution_reason: body.reason!.trim(),
          checkin_time: now,
          checkout_time: now,
          checkin_lat: body.latitude,
          checkin_lng: body.longitude,
          checkout_lat: body.latitude,
          checkout_lng: body.longitude,
          completed_at: now,
        }

    const { error } = await admin.from('missions').update(update).eq('id', missionId)
    if (error) {
      console.error('[mission-field-outcome] update failed:', error.message)
      return NextResponse.json({ error: 'تعذر تسجيل حالة المنشأة.' }, { status: 500 })
    }
    return NextResponse.json({
      success: true,
      action: body.action,
      recorded_at: now,
      gps_verified: gpsVerified,
      distance_metres: distance,
    })
  } catch (error) {
    console.error('[mission-field-outcome] unexpected error:', error)
    return NextResponse.json({ error: 'حدث خطأ غير متوقع أثناء تسجيل الحالة.' }, { status: 500 })
  }
}
