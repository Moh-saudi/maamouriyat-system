import { NextResponse } from 'next/server'
import {
  checkV2ResourceAccess,
  hasV2Permission,
} from '@/server/authorization'
import {
  requireAnyV2Permission,
  requireV2Permission,
} from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

async function canUseTemplate(input: {
  templateId: string
  gate: Extract<
    Awaited<ReturnType<typeof requireV2Permission>>,
    { ok: true }
  >
}) {
  const admin = getAdminSupabaseClient()
  const { data: template, error } = await admin
    .from('form_templates')
    .select(
      'id, is_active, visibility, created_by_user_id, created_by_org'
    )
    .eq('id', input.templateId)
    .maybeSingle()

  if (error || !template || template.is_active !== true) {
    return false
  }

  if (template.visibility === 'system') return true

  if (
    template.visibility === 'private' &&
    template.created_by_user_id === input.gate.user.profileId
  ) {
    return true
  }

  if (
    template.visibility === 'organization' &&
    typeof template.created_by_org === 'string'
  ) {
    const { data: organization } = await admin
      .from('organizations')
      .select('id, sector_id, governorate, organization_type_code')
      .eq('id', template.created_by_org)
      .maybeSingle()

    if (!organization) return false

    return (
      await checkV2ResourceAccess({
        user: input.gate.user,
        snapshot: input.gate.access,
        permissionKey: 'checklists.library',
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
    ).allowed
  }

  return false
}

export async function GET() {
  try {
    const gate = await requireAnyV2Permission([
      'checklists.library',
      'checklists.design',
      'checklists.view',
    ])
    if (!gate.ok) return gate.response

    // Capture the narrowed authorized context before declaring nested async
    // helpers. TypeScript does not preserve the discriminated-union narrowing
    // of `gate` reliably inside the closure below.
    const authorizedUser = gate.user
    const authorizedAccess = gate.access

    const permissionKey = hasV2Permission(
      authorizedAccess,
      'checklists.library'
    )
      ? 'checklists.library'
      : hasV2Permission(authorizedAccess, 'checklists.design')
        ? 'checklists.design'
        : 'checklists.view'

    const admin = getAdminSupabaseClient()

    const [
      { data: templateRows, error: templatesError },
      { data: libraryRows, error: libraryError },
      { data: sectionRows, error: sectionsError },
      { data: criteriaRows, error: criteriaError },
    ] = await Promise.all([
      admin
        .from('form_templates')
        .select(
          'id, name, version, description, created_by_org, created_by_user_id, visibility, applicable_facility_types, is_base, is_active, created_at, updated_at'
        )
        .eq('is_active', true)
        .order('is_base', { ascending: false })
        .order('updated_at', { ascending: false }),
      admin
        .from('user_template_library')
        .select('template_id, source_type, is_default')
        .eq('user_id', authorizedUser.profileId),
      admin
        .from('form_sections')
        .select('id, template_id')
        .eq('is_active', true),
      admin
        .from('form_criteria')
        .select('id, template_id')
        .eq('is_active', true),
    ])

    const firstError =
      templatesError || libraryError || sectionsError || criteriaError

    if (firstError) {
      throw new Error(firstError.message)
    }

    const libraryById = new Map(
      (libraryRows ?? []).map((row) => [
        String(row.template_id),
        {
          source_type: String(row.source_type),
          is_default: row.is_default === true,
        },
      ])
    )

    const sectionCount = new Map<string, number>()
    for (const row of sectionRows ?? []) {
      const id = String(row.template_id)
      sectionCount.set(id, (sectionCount.get(id) ?? 0) + 1)
    }

    const criteriaCount = new Map<string, number>()
    for (const row of criteriaRows ?? []) {
      const id = String(row.template_id)
      criteriaCount.set(id, (criteriaCount.get(id) ?? 0) + 1)
    }

    const organizationCache = new Map<
      string,
      {
        id: string
        sector_id: string | null
        governorate: string | null
        organization_type_code: string | null
      } | null
    >()

    async function organizationTemplateAllowed(
      organizationId: string
    ): Promise<boolean> {
      if (!organizationCache.has(organizationId)) {
        const { data } = await admin
          .from('organizations')
          .select('id, sector_id, governorate, organization_type_code')
          .eq('id', organizationId)
          .maybeSingle()

        organizationCache.set(
          organizationId,
          data
            ? {
                id: String(data.id),
                sector_id: data.sector_id
                  ? String(data.sector_id)
                  : null,
                governorate:
                  typeof data.governorate === 'string'
                    ? data.governorate
                    : null,
                organization_type_code:
                  typeof data.organization_type_code === 'string'
                    ? data.organization_type_code
                    : null,
              }
            : null
        )
      }

      const organization = organizationCache.get(organizationId)
      if (!organization) return false

      return (
        await checkV2ResourceAccess({
          user: authorizedUser,
          snapshot: authorizedAccess,
          permissionKey,
          resource: {
            organizationId: organization.id,
            sectorId:
              organization.organization_type_code === 'sector'
                ? organization.id
                : organization.sector_id,
            governorate: organization.governorate,
          },
        })
      ).allowed
    }

    const templates = []

    for (const template of templateRows ?? []) {
      const visibility =
        template.visibility === 'private' ||
        template.visibility === 'organization'
          ? template.visibility
          : 'system'

      const createdByMe =
        template.created_by_user_id === authorizedUser.profileId

      let allowed = visibility === 'system' || createdByMe

      if (
        !allowed &&
        visibility === 'organization' &&
        typeof template.created_by_org === 'string'
      ) {
        allowed = await organizationTemplateAllowed(template.created_by_org)
      }

      if (!allowed) continue

      const templateId = String(template.id)
      const library = libraryById.get(templateId)

      templates.push({
        id: templateId,
        name: String(template.name),
        version:
          typeof template.version === 'string' ? template.version : null,
        description:
          typeof template.description === 'string'
            ? template.description
            : null,
        visibility,
        is_base: template.is_base === true,
        created_by_me: createdByMe,
        in_my_library: Boolean(library) || createdByMe,
        library_source:
          library?.source_type ?? (createdByMe ? 'created' : null),
        is_default: library?.is_default ?? false,
        section_count: sectionCount.get(templateId) ?? 0,
        criteria_count: criteriaCount.get(templateId) ?? 0,
        applicable_facility_types: Array.isArray(
          template.applicable_facility_types
        )
          ? template.applicable_facility_types
          : null,
        updated_at: template.updated_at ?? template.created_at ?? null,
      })
    }

    return NextResponse.json({
      can_design: hasV2Permission(authorizedAccess, 'checklists.design'),
      can_manage_library: hasV2Permission(
        authorizedAccess,
        'checklists.library'
      ),
      templates,
    })
  } catch (error) {
    console.error('[template-library:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'تعذر تحميل مكتبة الاستمارات' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('checklists.library')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const templateId =
      typeof body.template_id === 'string' ? body.template_id.trim() : ''

    if (!templateId) {
      return NextResponse.json(
        { error: 'معرف الاستمارة مطلوب' },
        { status: 400 }
      )
    }

    if (!(await canUseTemplate({ templateId, gate }))) {
      return NextResponse.json(
        {
          error: 'هذه الاستمارة غير متاحة لمكتبتك',
          code: 'TEMPLATE_LIBRARY_DENIED',
        },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()
    const { error } = await admin
      .from('user_template_library')
      .upsert(
        {
          user_id: gate.user.profileId,
          template_id: templateId,
          source_type: 'saved',
          is_default: body.is_default === true,
        },
        { onConflict: 'user_id,template_id' }
      )

    if (error) {
      console.error('[template-library:POST] failed:', error.message)
      return NextResponse.json(
        { error: 'تعذر حفظ الاستمارة في مكتبتك' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[template-library:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء حفظ الاستمارة' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const gate = await requireV2Permission('checklists.library')
    if (!gate.ok) return gate.response

    const templateId = new URL(request.url).searchParams.get('template_id')
    if (!templateId) {
      return NextResponse.json(
        { error: 'معرف الاستمارة مطلوب' },
        { status: 400 }
      )
    }

    const admin = getAdminSupabaseClient()

    const { data: template } = await admin
      .from('form_templates')
      .select('id, created_by_user_id')
      .eq('id', templateId)
      .maybeSingle()

    if (template?.created_by_user_id === gate.user.profileId) {
      return NextResponse.json(
        { error: 'الاستمارة التي أنشأتها تظل ضمن استماراتك' },
        { status: 409 }
      )
    }

    const { error } = await admin
      .from('user_template_library')
      .delete()
      .eq('user_id', gate.user.profileId)
      .eq('template_id', templateId)

    if (error) {
      console.error('[template-library:DELETE] failed:', error.message)
      return NextResponse.json(
        { error: 'تعذر إزالة الاستمارة من مكتبتك' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[template-library:DELETE] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء تحديث مكتبة الاستمارات' },
      { status: 500 }
    )
  }
}
