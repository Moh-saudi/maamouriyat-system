import { NextResponse } from 'next/server'
import { checkV2ResourceAccess } from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { loadMissionResourceScope } from '@/server/authorization/resources/mission'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type RouteContext = { params: Promise<{ missionId: string }> }
type Payload = {
  action?: 'start' | 'not_performed'
  reason?: string
  latitude?: number
  longitude?: number
}

function validCoordinate(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
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
    const common = {
      gps_verified: true,
      actual_facility_id: mission.target_facility_id || mission.facility_id,
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
    return NextResponse.json({ success: true, action: body.action, recorded_at: now })
  } catch (error) {
    console.error('[mission-field-outcome] unexpected error:', error)
    return NextResponse.json({ error: 'حدث خطأ غير متوقع أثناء تسجيل الحالة.' }, { status: 500 })
  }
}
