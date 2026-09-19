import { NextResponse } from 'next/server'
import { checkV2ResourceAccess } from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type OrganizationRow = {
  id: string
  organization_type_code: string
  sector_id: string | null
  governorate: string | null
}

async function loadOrganization(organizationId: string): Promise<OrganizationRow | null> {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('organizations')
    .select('id, organization_type_code, sector_id, governorate')
    .eq('id', organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `Failed to load correction-specialty organization: ${error.message}`
    )
  }

  return (data as OrganizationRow | null) ?? null
}

function toResource(organization: OrganizationRow) {
  return {
    organizationId: organization.id,
    sectorId:
      organization.organization_type_code === 'sector'
        ? organization.id
        : organization.sector_id,
    governorate: organization.governorate,
  }
}

async function authorizeOrganization(input: {
  permissionKey: string
  gate: Extract<
    Awaited<ReturnType<typeof requireV2Permission>>,
    { ok: true }
  >
  organizationId: string
}) {
  const organization = await loadOrganization(input.organizationId)
  if (!organization) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'الجهة التنظيمية غير موجودة' },
        { status: 404 }
      ),
    }
  }

  const decision = await checkV2ResourceAccess({
    user: input.gate.user,
    snapshot: input.gate.access,
    permissionKey: input.permissionKey,
    resource: toResource(organization),
  })

  if (!decision.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'الجهة خارج نطاق إدارة اختصاصات التصحيح المسموح لك به',
          code: 'SCOPE_DENIED',
        },
        { status: 403 }
      ),
    }
  }

  return { ok: true as const, organization }
}

export async function GET(request: Request) {
  try {
    const gate = await requireV2Permission(
      'organizations.view_correction_specialties'
    )
    if (!gate.ok) return gate.response

    const organizationId = new URL(request.url).searchParams.get(
      'organization_id'
    )

    if (!organizationId) {
      return NextResponse.json(
        { error: 'معرف الجهة مطلوب' },
        { status: 400 }
      )
    }

    const authorization = await authorizeOrganization({
      permissionKey: 'organizations.view_correction_specialties',
      gate,
      organizationId,
    })

    if (!authorization.ok) return authorization.response

    const admin = getAdminSupabaseClient()
    const [
      { data: specialties, error: specialtiesError },
      { data: mappings, error: mappingsError },
    ] = await Promise.all([
      admin
        .from('correction_specialties')
        .select('id, code, name_ar, description_ar, sort_order')
        .eq('is_active', true)
        .order('sort_order')
        .order('name_ar'),
      admin
        .from('organization_correction_specialties')
        .select(
          'organization_id, specialty_id, service_scope_org_id, is_primary, is_active, created_at, updated_at'
        )
        .eq('organization_id', organizationId)
        .eq('is_active', true),
    ])

    if (specialtiesError || mappingsError) {
      console.error(
        '[correction-specialties:GET] query failed:',
        specialtiesError?.message || mappingsError?.message
      )
      return NextResponse.json(
        { error: 'تعذر تحميل اختصاصات جهة التصحيح' },
        { status: 500 }
      )
    }

    const scopeIds = [
      ...new Set(
        (mappings ?? []).map((row) => String(row.service_scope_org_id))
      ),
    ]

    const scopeNames = new Map<string, string>()

    if (scopeIds.length > 0) {
      const { data: scopeRows, error: scopeError } = await admin
        .from('organizations')
        .select('id, name')
        .in('id', scopeIds)

      if (scopeError) {
        console.error(
          '[correction-specialties:GET] scope names failed:',
          scopeError.message
        )
        return NextResponse.json(
          { error: 'تعذر تحميل نطاقات خدمة جهة التصحيح' },
          { status: 500 }
        )
      }

      for (const row of scopeRows ?? []) {
        scopeNames.set(String(row.id), String(row.name))
      }
    }

    const specialtyById = new Map(
      (specialties ?? []).map((specialty) => [
        String(specialty.id),
        specialty,
      ])
    )

    return NextResponse.json({
      specialties: specialties ?? [],
      mappings: (mappings ?? []).map((mapping) => {
        const specialty = specialtyById.get(String(mapping.specialty_id))
        return {
          organization_id: String(mapping.organization_id),
          specialty_id: String(mapping.specialty_id),
          specialty_code: specialty ? String(specialty.code) : null,
          specialty_name_ar: specialty
            ? String(specialty.name_ar)
            : 'اختصاص غير مسمى',
          service_scope_org_id: String(mapping.service_scope_org_id),
          service_scope_name:
            scopeNames.get(String(mapping.service_scope_org_id)) ||
            'نطاق غير مسمى',
          is_primary: mapping.is_primary === true,
          created_at: mapping.created_at,
          updated_at: mapping.updated_at,
        }
      }),
    })
  } catch (error) {
    console.error('[correction-specialties:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء تحميل اختصاصات التصحيح' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission(
      'organizations.manage_correction_specialties'
    )
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const organizationId =
      typeof body.organization_id === 'string' ? body.organization_id : ''
    const specialtyId =
      typeof body.specialty_id === 'string' ? body.specialty_id : ''
    const serviceScopeOrgId =
      typeof body.service_scope_org_id === 'string'
        ? body.service_scope_org_id
        : ''

    if (!organizationId || !specialtyId || !serviceScopeOrgId) {
      return NextResponse.json(
        { error: 'الجهة والاختصاص ونطاق الخدمة بيانات مطلوبة' },
        { status: 400 }
      )
    }

    const [organizationAuthorization, scopeAuthorization] = await Promise.all([
      authorizeOrganization({
        permissionKey: 'organizations.manage_correction_specialties',
        gate,
        organizationId,
      }),
      authorizeOrganization({
        permissionKey: 'organizations.manage_correction_specialties',
        gate,
        organizationId: serviceScopeOrgId,
      }),
    ])

    if (!organizationAuthorization.ok) {
      return organizationAuthorization.response
    }

    if (!scopeAuthorization.ok) {
      return scopeAuthorization.response
    }

    const admin = getAdminSupabaseClient()
    const { data: specialty, error: specialtyError } = await admin
      .from('correction_specialties')
      .select('id')
      .eq('id', specialtyId)
      .eq('is_active', true)
      .maybeSingle()

    if (specialtyError || !specialty) {
      return NextResponse.json(
        { error: 'اختصاص التصحيح غير موجود أو غير نشط' },
        { status: 400 }
      )
    }

    const isPrimary =
      typeof body.is_primary === 'boolean' ? body.is_primary : true

    if (isPrimary) {
      const { error: clearPrimaryError } = await admin
        .from('organization_correction_specialties')
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq('specialty_id', specialtyId)
        .eq('service_scope_org_id', serviceScopeOrgId)
        .eq('is_active', true)
        .eq('is_primary', true)

      if (clearPrimaryError) {
        console.error(
          '[correction-specialties:POST] clear primary failed:',
          clearPrimaryError.message
        )
        return NextResponse.json(
          { error: 'تعذر تحديث جهة التصحيح الأساسية لهذا النطاق' },
          { status: 500 }
        )
      }
    }

    const { error: saveError } = await admin
      .from('organization_correction_specialties')
      .upsert(
        {
          organization_id: organizationId,
          specialty_id: specialtyId,
          service_scope_org_id: serviceScopeOrgId,
          is_primary: isPrimary,
          is_active: true,
          created_by_user_id: gate.user.profileId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict:
            'organization_id,specialty_id,service_scope_org_id',
        }
      )

    if (saveError) {
      console.error(
        '[correction-specialties:POST] save failed:',
        saveError.message
      )
      const scopeMismatch = saveError.message.includes(
        'Correction unit must belong'
      )
      return NextResponse.json(
        {
          error: scopeMismatch
            ? 'نطاق الخدمة يجب أن يكون الجهة نفسها أو جهة أعلى تحتوي جهة التصحيح داخل هيكلها'
            : 'تعذر حفظ اختصاص جهة التصحيح',
        },
        { status: scopeMismatch ? 400 : 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[correction-specialties:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء حفظ اختصاص جهة التصحيح' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const gate = await requireV2Permission(
      'organizations.manage_correction_specialties'
    )
    if (!gate.ok) return gate.response

    const params = new URL(request.url).searchParams
    const organizationId = params.get('organization_id') || ''
    const specialtyId = params.get('specialty_id') || ''
    const serviceScopeOrgId = params.get('service_scope_org_id') || ''

    if (!organizationId || !specialtyId || !serviceScopeOrgId) {
      return NextResponse.json(
        { error: 'بيانات اختصاص جهة التصحيح غير مكتملة' },
        { status: 400 }
      )
    }

    const authorization = await authorizeOrganization({
      permissionKey: 'organizations.manage_correction_specialties',
      gate,
      organizationId,
    })

    if (!authorization.ok) return authorization.response

    const admin = getAdminSupabaseClient()
    const { error } = await admin
      .from('organization_correction_specialties')
      .update({
        is_active: false,
        is_primary: false,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('specialty_id', specialtyId)
      .eq('service_scope_org_id', serviceScopeOrgId)
      .eq('is_active', true)

    if (error) {
      console.error(
        '[correction-specialties:DELETE] update failed:',
        error.message
      )
      return NextResponse.json(
        { error: 'تعذر إيقاف اختصاص جهة التصحيح' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[correction-specialties:DELETE] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء إيقاف اختصاص جهة التصحيح' },
      { status: 500 }
    )
  }
}
