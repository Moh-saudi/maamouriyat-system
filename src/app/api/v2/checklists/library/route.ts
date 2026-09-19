import { NextResponse } from 'next/server'
import { checkV2ResourceAccess } from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
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
