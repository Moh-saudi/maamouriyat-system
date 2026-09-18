import { NextResponse } from 'next/server'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import {
  canInformationCenterManageFacility,
  getFacilityManagementCapabilities,
} from '@/server/facilities/management-access'
import { STANDARD_FACILITY_TYPES } from '@/lib/facility-types'

const ACTION_LABELS: Record<string, string> = {
  create: 'إضافة المنشأة',
  update: 'تعديل بيانات المنشأة',
  deactivate: 'إيقاف المنشأة',
  reactivate: 'إعادة تفعيل المنشأة',
  merge: 'دمج سجل المنشأة',
}

const FIELD_LABELS: Record<string, string> = {
  name: 'اسم المنشأة',
  facility_type: 'نوع المنشأة',
  governorate: 'المحافظة',
  health_admin: 'الإدارة الصحية',
  urban_rural: 'التصنيف الجغرافي',
  village_city: 'المدينة / القرية',
  latitude: 'خط العرض',
  longitude: 'خط الطول',
  is_active: 'حالة المنشأة',
}

type FacilityRow = {
  id: string
  organization_id: string
  governorate: string
}

type AuditRow = {
  id: string
  action: string
  reason: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  changed_fields: string[] | null
  created_at: string
  actor_user_id: string
}

function facilityTypeLabel(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—'

  return (
    STANDARD_FACILITY_TYPES.find(
      (item) => item.key === value || item.label === value
    )?.label ??
    (/[\u0600-\u06FF]/.test(value) ? value : 'منشأة صحية')
  )
}

function displayValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'

  if (field === 'facility_type') {
    return facilityTypeLabel(value)
  }

  if (field === 'is_active') {
    return value === true ? 'نشطة' : 'موقوفة'
  }

  if (field === 'latitude' || field === 'longitude') {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric.toFixed(6) : '—'
  }

  return String(value)
}

export async function GET(request: Request) {
  try {
    const gate = await requireV2Permission('facilities.audit')
    if (!gate.ok) return gate.response

    const facilityId = new URL(request.url).searchParams.get('facility_id')
    if (!facilityId) {
      return NextResponse.json(
        { error: 'معرف المنشأة مطلوب' },
        { status: 400 }
      )
    }

    const capabilities = await getFacilityManagementCapabilities({
      user: gate.user,
      access: gate.access,
    })

    if (!capabilities.isInformationCenter || !capabilities.canAudit) {
      return NextResponse.json(
        {
          error: 'سجل تعديلات المنشآت متاح لمسؤولي مراكز المعلومات فقط',
          code: 'INFORMATION_CENTER_REQUIRED',
        },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()
    const { data: facility, error: facilityError } = await admin
      .from('facilities')
      .select('id, organization_id, governorate')
      .eq('id', facilityId)
      .maybeSingle()

    if (facilityError) {
      throw new Error(
        `[Facility Audit] Failed to load facility: ${facilityError.message}`
      )
    }

    if (!facility) {
      return NextResponse.json(
        { error: 'المنشأة غير موجودة' },
        { status: 404 }
      )
    }

    const resource = facility as FacilityRow

    if (
      !canInformationCenterManageFacility({
        capabilities,
        resource: {
          organizationId: resource.organization_id,
          governorate: resource.governorate,
        },
      })
    ) {
      return NextResponse.json(
        {
          error: 'المنشأة خارج نطاق مركز المعلومات',
          code: 'FACILITY_MANAGEMENT_SCOPE_DENIED',
        },
        { status: 403 }
      )
    }

    const { data: auditRows, error: auditError } = await admin
      .from('facility_change_audit')
      .select(
        'id, action, reason, before_data, after_data, changed_fields, created_at, actor_user_id'
      )
      .eq('facility_id', facilityId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (auditError) {
      throw new Error(
        `[Facility Audit] Failed to load audit: ${auditError.message}`
      )
    }

    const rows = (auditRows ?? []) as AuditRow[]
    const actorIds = [
      ...new Set(rows.map((row) => row.actor_user_id).filter(Boolean)),
    ]

    const actorNames = new Map<string, string>()

    if (actorIds.length > 0) {
      const { data: actors, error: actorError } = await admin
        .from('users')
        .select('id, full_name')
        .in('id', actorIds)

      if (actorError) {
        throw new Error(
          `[Facility Audit] Failed to load actors: ${actorError.message}`
        )
      }

      for (const actor of actors ?? []) {
        actorNames.set(String(actor.id), String(actor.full_name || 'مستخدم'))
      }
    }

    const entries = rows.map((row) => {
      const changedFields = (row.changed_fields ?? []).filter(
        (field) => field in FIELD_LABELS
      )

      return {
        id: row.id,
        action: ACTION_LABELS[row.action] || 'تعديل المنشأة',
        actorName: actorNames.get(row.actor_user_id) || 'مستخدم',
        createdAt: row.created_at,
        reason: row.reason,
        changes: changedFields.map((field) => ({
          label: FIELD_LABELS[field],
          before: displayValue(field, row.before_data?.[field]),
          after: displayValue(field, row.after_data?.[field]),
        })),
      }
    })

    return NextResponse.json({ entries })
  } catch (error) {
    console.error('[Facility Audit] failed:', error)
    return NextResponse.json(
      { error: 'تعذر تحميل سجل تعديلات المنشأة' },
      { status: 500 }
    )
  }
}
