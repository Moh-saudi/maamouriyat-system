import { NextResponse } from 'next/server'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import {
  canInformationCenterManageFacility,
  getFacilityManagementCapabilities,
} from '@/server/facilities/management-access'
import { STANDARD_FACILITY_TYPES } from '@/lib/facility-types'

type FacilityRow = {
  id: string
  name: string
  facility_type: string
  organization_id: string
  sector_id: string
  governorate: string
  health_admin: string
  urban_rural: string | null
  village_city: string | null
  latitude: number
  longitude: number
  is_active: boolean | null
}

type OrganizationRow = {
  id: string
  name: string
  level: number
  sector_id: string | null
  governorate: string | null
  health_admin: string | null
  is_active: boolean | null
}

function resolveFacilityType(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null

  const normalized = value.trim()
  const known = STANDARD_FACILITY_TYPES.find(
    (item) => item.key === normalized || item.label === normalized
  )

  if (known) return known.key

  return /[\u0600-\u06FF]/.test(normalized) ? normalized : null
}

function cleanText(value: unknown, maxLength = 200): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().slice(0, maxLength)
  return cleaned || null
}

function cleanCoordinate(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  const number = Number(value)
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    return null
  }
  return number
}

async function loadFacility(facilityId: string): Promise<FacilityRow | null> {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('facilities')
    .select(
      'id, name, facility_type, organization_id, sector_id, governorate, health_admin, urban_rural, village_city, latitude, longitude, is_active'
    )
    .eq('id', facilityId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `[Facility Admin] Failed to load facility: ${error.message}`
    )
  }

  return (data as FacilityRow | null) ?? null
}

async function loadHealthAdministration(
  organizationId: string
): Promise<OrganizationRow | null> {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('organizations')
    .select(
      'id, name, level, sector_id, governorate, health_admin, is_active'
    )
    .eq('id', organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `[Facility Admin] Failed to load organization: ${error.message}`
    )
  }

  const row = (data as OrganizationRow | null) ?? null

  if (
    !row ||
    row.is_active !== true ||
    row.level !== 6 ||
    !row.sector_id ||
    !row.governorate
  ) {
    return null
  }

  return row
}

function facilityResource(row: Pick<FacilityRow, 'organization_id' | 'governorate'>) {
  return {
    organizationId: row.organization_id,
    governorate: row.governorate,
  }
}

function organizationResource(row: OrganizationRow) {
  return {
    organizationId: row.id,
    governorate: row.governorate,
  }
}

async function requireInformationCenterManagement(
  permissionKey:
    | 'facilities.create'
    | 'facilities.edit'
    | 'facilities.deactivate'
) {
  const gate = await requireV2Permission(permissionKey)
  if (!gate.ok) return gate

  const capabilities = await getFacilityManagementCapabilities({
    user: gate.user,
    access: gate.access,
  })

  if (!capabilities.isInformationCenter) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'إدارة بيانات المنشآت متاحة لمسؤولي مراكز المعلومات فقط',
          code: 'INFORMATION_CENTER_REQUIRED',
        },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true as const,
    user: gate.user,
    access: gate.access,
    capabilities,
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireInformationCenterManagement('facilities.create')
    if (!gate.ok) return gate.response

    if (!gate.capabilities.canCreate) {
      return NextResponse.json(
        { error: 'لا يمكنك إضافة منشأة في نطاقك الحالي' },
        { status: 403 }
      )
    }

    const body = (await request.json()) as Record<string, unknown>
    const name = cleanText(body.name)
    const facilityType = resolveFacilityType(body.facility_type)
    const organizationId = cleanText(body.organization_id, 80)
    const latitude = cleanCoordinate(body.latitude, -90, 90)
    const longitude = cleanCoordinate(body.longitude, -180, 180)
    const urbanRural = cleanText(body.urban_rural, 30)
    const villageCity = cleanText(body.village_city, 150)
    const reason = cleanText(body.reason, 500)

    if (
      !name ||
      !facilityType ||
      !organizationId ||
      latitude === null ||
      longitude === null
    ) {
      return NextResponse.json(
        { error: 'بيانات المنشأة أو الموقع غير مكتملة' },
        { status: 400 }
      )
    }

    const organization = await loadHealthAdministration(organizationId)
    if (!organization) {
      return NextResponse.json(
        { error: 'الإدارة الصحية المختارة غير صحيحة أو غير نشطة' },
        { status: 400 }
      )
    }

    if (
      !canInformationCenterManageFacility({
        capabilities: gate.capabilities,
        resource: organizationResource(organization),
      })
    ) {
      return NextResponse.json(
        {
          error: 'الإدارة الصحية المختارة خارج نطاق مركز المعلومات',
          code: 'FACILITY_MANAGEMENT_SCOPE_DENIED',
        },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()
    const { data: facilityId, error } = await admin.rpc(
      'mutate_facility_with_audit',
      {
        p_facility_id: null,
        p_action: 'create',
        p_actor_user_id: gate.user.profileId,
        p_actor_organization_id: gate.user.organizationId,
        p_payload: {
          name,
          facility_type: facilityType,
          organization_id: organization.id,
          sector_id: organization.sector_id,
          governorate: organization.governorate,
          health_admin: organization.health_admin || organization.name,
          urban_rural: urbanRural,
          village_city: villageCity,
          latitude,
          longitude,
          is_active: true,
        },
        p_reason: reason,
      }
    )

    if (error || !facilityId) {
      console.error('[Facility Admin] create RPC failed:', error?.message)
      return NextResponse.json(
        { error: 'تعذر إضافة المنشأة' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      facility_id: String(facilityId),
    })
  } catch (error) {
    console.error('[Facility Admin] create failed:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء إضافة المنشأة' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const facilityId = cleanText(body.facility_id, 80)
    const action =
      body.action === 'deactivate' || body.action === 'reactivate'
        ? body.action
        : 'update'

    if (!facilityId) {
      return NextResponse.json(
        { error: 'معرف المنشأة مطلوب' },
        { status: 400 }
      )
    }

    const permissionKey =
      action === 'update' ? 'facilities.edit' : 'facilities.deactivate'

    const gate = await requireInformationCenterManagement(permissionKey)
    if (!gate.ok) return gate.response

    if (
      (action === 'update' && !gate.capabilities.canEdit) ||
      (action !== 'update' && !gate.capabilities.canDeactivate)
    ) {
      return NextResponse.json(
        { error: 'لا يمكنك تنفيذ هذا الإجراء في نطاقك الحالي' },
        { status: 403 }
      )
    }

    const current = await loadFacility(facilityId)
    if (!current) {
      return NextResponse.json(
        { error: 'المنشأة غير موجودة' },
        { status: 404 }
      )
    }

    if (
      !canInformationCenterManageFacility({
        capabilities: gate.capabilities,
        resource: facilityResource(current),
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

    const reason = cleanText(body.reason, 500)
    const payload: Record<string, unknown> = {}

    if (action === 'update') {
      const name = cleanText(body.name)
      const facilityType = resolveFacilityType(body.facility_type)
      const organizationId = cleanText(body.organization_id, 80)
      const latitude = cleanCoordinate(body.latitude, -90, 90)
      const longitude = cleanCoordinate(body.longitude, -180, 180)

      if (
        !name ||
        !facilityType ||
        !organizationId ||
        latitude === null ||
        longitude === null
      ) {
        return NextResponse.json(
          { error: 'بيانات المنشأة أو الموقع غير مكتملة' },
          { status: 400 }
        )
      }

      const organization = await loadHealthAdministration(organizationId)
      if (!organization) {
        return NextResponse.json(
          { error: 'الإدارة الصحية المختارة غير صحيحة أو غير نشطة' },
          { status: 400 }
        )
      }

      if (
        !canInformationCenterManageFacility({
          capabilities: gate.capabilities,
          resource: organizationResource(organization),
        })
      ) {
        return NextResponse.json(
          {
            error: 'لا يمكنك نقل المنشأة إلى هذا النطاق',
            code: 'FACILITY_TARGET_SCOPE_DENIED',
          },
          { status: 403 }
        )
      }

      Object.assign(payload, {
        name,
        facility_type: facilityType,
        organization_id: organization.id,
        sector_id: organization.sector_id,
        governorate: organization.governorate,
        health_admin: organization.health_admin || organization.name,
        urban_rural: cleanText(body.urban_rural, 30),
        village_city: cleanText(body.village_city, 150),
        latitude,
        longitude,
      })
    }

    const admin = getAdminSupabaseClient()
    const { error } = await admin.rpc('mutate_facility_with_audit', {
      p_facility_id: facilityId,
      p_action: action,
      p_actor_user_id: gate.user.profileId,
      p_actor_organization_id: gate.user.organizationId,
      p_payload: payload,
      p_reason: reason,
    })

    if (error) {
      console.error('[Facility Admin] mutation RPC failed:', error.message)
      return NextResponse.json(
        { error: 'تعذر حفظ تعديل المنشأة' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Facility Admin] update failed:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء تعديل المنشأة' },
      { status: 500 }
    )
  }
}
