import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  checkV2ResourceAccess,
  evaluateV2ResourceScope,
  hasV2Permission,
} from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type {
  V2OrganizationFact,
  V2ResourceScopeContext,
} from '@/server/authorization/scope-types'

export const dynamic = 'force-dynamic'

type OrganizationRow = {
  id: string
  name: string
  level: number
  level_label: string
  organization_type_code: string
  parent_id: string | null
  sector_id: string | null
  governorate: string | null
  health_admin: string | null
  code: string | null
  is_active: boolean | null
  can_issue_missions: boolean
  can_approve_missions: boolean
  can_view_all_governorate: boolean
  can_view_sector_facilities: boolean
  [key: string]: unknown
}

const CAPABILITY_FIELDS = [
  'can_issue_missions',
  'can_approve_missions',
  'can_view_all_governorate',
  'can_view_sector_facilities',
] as const


type OrganizationTypeRow = {
  code: string
  display_name_ar: string
  description_ar: string | null
  sort_order: number
  is_active: boolean
}

type OrganizationTypeRelationRow = {
  parent_type_code: string
  child_type_code: string
  is_active: boolean
}

const LEGACY_LEVEL_LABEL_BY_TYPE: Record<string, string> = {
  ministry: 'ministry',
  sector: 'sector',
  central_administration: 'central_admin',
  general_administration: 'general_admin',
  administration: 'administration',
  department: 'department',
  section: 'section',
  health_directorate: 'directorate',
  health_administration: 'health_admin',
}

async function loadOrganizationTaxonomy() {
  const admin = getAdminSupabaseClient()
  const [
    { data: types, error: typesError },
    { data: relations, error: relationsError },
  ] = await Promise.all([
    admin
      .from('organization_types')
      .select('code, display_name_ar, description_ar, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order')
      .order('display_name_ar'),
    admin
      .from('organization_type_relations')
      .select('parent_type_code, child_type_code, is_active')
      .eq('is_active', true),
  ])

  if (typesError) {
    throw new Error(
      `Failed to load organization types: ${typesError.message}`
    )
  }

  if (relationsError) {
    throw new Error(
      `Failed to load organization type relations: ${relationsError.message}`
    )
  }

  return {
    types: (types ?? []) as OrganizationTypeRow[],
    relations: (relations ?? []) as OrganizationTypeRelationRow[],
  }
}

function isAllowedTypeRelation(input: {
  parentType: string
  childType: string
  relations: readonly OrganizationTypeRelationRow[]
}): boolean {
  return input.relations.some(
    (relation) =>
      relation.parent_type_code === input.parentType &&
      relation.child_type_code === input.childType &&
      relation.is_active === true
  )
}

function toResource(org: Pick<OrganizationRow, 'id' | 'sector_id' | 'governorate'>): V2ResourceScopeContext {
  return {
    organizationId: org.id,
    sectorId: org.sector_id,
    governorate: org.governorate,
  }
}

function hasCapabilityMutation(body: Record<string, unknown>): boolean {
  return CAPABILITY_FIELDS.some((field) => field in body)
}

function toOrganizationFacts(
  organizations: readonly OrganizationRow[]
): Map<string, V2OrganizationFact> {
  return new Map(
    organizations.map((org) => [
      org.id,
      {
        id: org.id,
        parentId: org.parent_id,
        sectorId: org.sector_id,
        governorate: org.governorate,
        level: Number(org.level),
      },
    ])
  )
}

async function loadOrganization(id: string): Promise<OrganizationRow | null> {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('organizations')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load organization: ${error.message}`)
  }

  return (data as OrganizationRow | null) ?? null
}

async function authorizeOrganization(input: {
  permissionKey: string
  user: Awaited<ReturnType<typeof requireV2Permission>> extends infer T
    ? T extends { ok: true; user: infer U }
      ? U
      : never
    : never
  access: Awaited<ReturnType<typeof requireV2Permission>> extends infer T
    ? T extends { ok: true; access: infer A }
      ? A
      : never
    : never
  organization: OrganizationRow
}) {
  return checkV2ResourceAccess({
    user: input.user,
    snapshot: input.access,
    permissionKey: input.permissionKey,
    resource: toResource(input.organization),
  })
}

// GET: return only organizations inside the caller's effective organizations.view scope.
export async function GET() {
  try {
    const gate = await requireV2Permission('organizations.view')
    if (!gate.ok) return gate.response

    const admin = getAdminSupabaseClient()
    const [
      { data, error },
      taxonomy,
    ] = await Promise.all([
      admin
        .from('organizations')
        .select('*')
        .order('level')
        .order('name'),
      loadOrganizationTaxonomy(),
    ])

    if (error) {
      console.error('[organizations:GET] query failed:', error.message)
      return NextResponse.json({ error: 'تعذر تحميل الهيكل التنظيمي' }, { status: 500 })
    }

    const organizations = (data ?? []) as OrganizationRow[]
    const facts = toOrganizationFacts(organizations)

    const allowed = organizations.filter((organization) =>
      evaluateV2ResourceScope({
        user: gate.user,
        snapshot: gate.access,
        permissionKey: 'organizations.view',
        resource: toResource(organization),
        organizationFacts: facts,
      }).allowed
    )

    const typeNameByCode = new Map(
      taxonomy.types.map((item) => [item.code, item.display_name_ar])
    )

    return NextResponse.json({
      success: true,
      data: allowed.map((organization) => ({
        ...organization,
        organization_type_name_ar:
          typeNameByCode.get(organization.organization_type_code) ||
          'جهة تنظيمية',
      })),
      organizationTypes: taxonomy.types.map((item) => ({
        code: item.code,
        nameAr: item.display_name_ar,
        descriptionAr: item.description_ar,
      })),
      typeRelations: taxonomy.relations.map((relation) => ({
        parentTypeCode: relation.parent_type_code,
        childTypeCode: relation.child_type_code,
      })),
    })
  } catch (error) {
    console.error('[organizations:GET] unexpected error:', error)
    return NextResponse.json({ error: 'خطأ غير متوقع' }, { status: 500 })
  }
}

// POST: create a child organization only inside the caller's organizations.create scope.
export async function POST(request: NextRequest) {
  try {
    const gate = await requireV2Permission('organizations.create')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const parentId = typeof body.parent_id === 'string' ? body.parent_id : ''
    const requestedType =
      typeof body.organization_type_code === 'string'
        ? body.organization_type_code.trim()
        : ''

    if (!name) {
      return NextResponse.json({ error: 'اسم الوحدة أو الإدارة الفرعية مطلوب' }, { status: 400 })
    }

    if (!parentId) {
      return NextResponse.json(
        { error: 'يجب اختيار الجهة الأم من الشجرة التنظيمية' },
        { status: 400 }
      )
    }

    if (!requestedType) {
      return NextResponse.json(
        { error: 'يجب اختيار نوع الجهة' },
        { status: 400 }
      )
    }

    if (hasCapabilityMutation(body) && !hasV2Permission(gate.access, 'organizations.manage_capabilities')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية ضبط خصائص الجهة', code: 'CAPABILITY_PERMISSION_DENIED' },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()
    const [parent, taxonomy] = await Promise.all([
      loadOrganization(parentId),
      loadOrganizationTaxonomy(),
    ])

    if (!parent) {
      return NextResponse.json({ error: 'الجهة الرئيسية المحددة غير موجودة في قاعدة البيانات' }, { status: 400 })
    }

    const scopeDecision = await authorizeOrganization({
      permissionKey: 'organizations.create',
      user: gate.user,
      access: gate.access,
      organization: parent,
    })

    if (!scopeDecision.allowed) {
      return NextResponse.json(
        { error: 'لا يمكن إنشاء جهة خارج نطاقك التنظيمي', code: 'SCOPE_DENIED' },
        { status: 403 }
      )
    }

    const requestedTypeDefinition = taxonomy.types.find(
      (item) => item.code === requestedType
    )

    if (!requestedTypeDefinition) {
      return NextResponse.json(
        { error: 'نوع الجهة المحدد غير متاح' },
        { status: 400 }
      )
    }

    if (
      !isAllowedTypeRelation({
        parentType: parent.organization_type_code,
        childType: requestedType,
        relations: taxonomy.relations,
      })
    ) {
      return NextResponse.json(
        {
          error: `لا يمكن إضافة ${requestedTypeDefinition.display_name_ar} تحت هذه الجهة`,
          code: 'ORGANIZATION_TYPE_RELATION_DENIED',
        },
        { status: 400 }
      )
    }

    const resolvedLevel = Number(parent.level) + 1

    if (resolvedLevel < 2 || resolvedLevel > 7) {
      return NextResponse.json(
        { error: 'تم الوصول إلى أقصى عمق تنظيمي مسموح' },
        { status: 400 }
      )
    }

    const finalLevelLabel =
      LEGACY_LEVEL_LABEL_BY_TYPE[requestedType] || 'administration'

    const newOrganizationId = randomUUID()
    const resolvedSectorId =
      requestedType === 'sector'
        ? newOrganizationId
        : parent.organization_type_code === 'sector'
          ? parent.id
          : parent.sector_id

    if (
      requestedType === 'health_directorate' &&
      (typeof body.governorate !== 'string' || !body.governorate.trim())
    ) {
      return NextResponse.json(
        { error: 'المحافظة مطلوبة عند إضافة مديرية شؤون صحية' },
        { status: 400 }
      )
    }

    const payload: Record<string, unknown> = {
      id: newOrganizationId,
      name,
      code: code || `SUB-${Date.now().toString(36).toUpperCase()}`,
      parent_id: parent.id,
      sector_id: resolvedSectorId,
      level: resolvedLevel,
      level_label: finalLevelLabel,
      organization_type_code: requestedType,
      governorate:
        requestedType === 'health_directorate'
          ? typeof body.governorate === 'string'
            ? body.governorate.trim() || null
            : null
          : parent.governorate,
      health_admin:
        requestedType === 'health_administration'
          ? typeof body.health_admin === 'string' &&
            body.health_admin.trim()
            ? body.health_admin.trim()
            : name
          : parent.organization_type_code === 'health_administration'
            ? parent.health_admin || parent.name
            : parent.health_admin,
      is_active: true,
    }

    if (hasV2Permission(gate.access, 'organizations.manage_capabilities')) {
      for (const field of CAPABILITY_FIELDS) {
        if (field in body) payload[field] = Boolean(body[field])
      }
    }

    const { data: inserted, error: insertError } = await admin
      .from('organizations')
      .insert(payload)
      .select('*')
      .single()

    if (insertError) {
      console.error('[organizations:POST] insert failed:', insertError.message)
      return NextResponse.json({ error: 'فشل حفظ الوحدة الفرعية' }, { status: 500 })
    }

    const insertedOrg = inserted as OrganizationRow
    return NextResponse.json({
      success: true,
      data: insertedOrg,
      message: `تم إنشاء وتسجيل الوحدة الفرعية (${insertedOrg.name}) بنجاح.`,
    })
  } catch (error) {
    console.error('[organizations:POST] unexpected error:', error)
    return NextResponse.json({ error: 'خطأ غير متوقع' }, { status: 500 })
  }
}

// PUT: edit an organization in-scope; capability changes require an extra permission.
export async function PUT(request: NextRequest) {
  try {
    const gate = await requireV2Permission('organizations.edit')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    const requestedType =
      typeof body.organization_type_code === 'string'
        ? body.organization_type_code.trim()
        : ''

    if (!id) {
      return NextResponse.json({ error: 'معرف الوحدة مطلوب' }, { status: 400 })
    }

    const current = await loadOrganization(id)
    if (!current) {
      return NextResponse.json({ error: 'الوحدة التنظيمية غير موجودة' }, { status: 404 })
    }

    const scopeDecision = await authorizeOrganization({
      permissionKey: 'organizations.edit',
      user: gate.user,
      access: gate.access,
      organization: current,
    })

    if (!scopeDecision.allowed) {
      return NextResponse.json(
        { error: 'لا يمكن تعديل جهة خارج نطاقك التنظيمي', code: 'SCOPE_DENIED' },
        { status: 403 }
      )
    }

    if (hasCapabilityMutation(body) && !hasV2Permission(gate.access, 'organizations.manage_capabilities')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل خصائص الجهة', code: 'CAPABILITY_PERMISSION_DENIED' },
        { status: 403 }
      )
    }

    const requestedParentId =
      typeof body.parent_id === 'string' ? body.parent_id : current.parent_id

    const finalType = requestedType || current.organization_type_code

    if (!requestedParentId && finalType !== 'ministry') {
      return NextResponse.json(
        { error: 'يجب اختيار الجهة الأم' },
        { status: 400 }
      )
    }

    const hierarchyChanged =
      requestedParentId !== current.parent_id ||
      finalType !== current.organization_type_code

    if (hierarchyChanged) {
      if (!requestedParentId) {
        return NextResponse.json(
          { error: 'لا يمكن تعديل تبعية الوزارة الرئيسية' },
          { status: 400 }
        )
      }

      const newParent = await loadOrganization(requestedParentId)

      if (!newParent) {
        return NextResponse.json(
          { error: 'الجهة الأم الجديدة غير موجودة' },
          { status: 400 }
        )
      }

      const parentScopeDecision = await authorizeOrganization({
        permissionKey: 'organizations.edit',
        user: gate.user,
        access: gate.access,
        organization: newParent,
      })

      if (!parentScopeDecision.allowed) {
        return NextResponse.json(
          {
            error: 'لا يمكنك نقل الجهة إلى جهة أم خارج نطاقك التنظيمي',
            code: 'PARENT_SCOPE_DENIED',
          },
          { status: 403 }
        )
      }

      const taxonomy = await loadOrganizationTaxonomy()
      const typeDefinition = taxonomy.types.find(
        (item) => item.code === finalType
      )

      if (
        !typeDefinition ||
        !isAllowedTypeRelation({
          parentType: newParent.organization_type_code,
          childType: finalType,
          relations: taxonomy.relations,
        })
      ) {
        return NextResponse.json(
          {
            error: 'نوع الجهة غير مسموح تحت الجهة الأم المختارة',
            code: 'ORGANIZATION_TYPE_RELATION_DENIED',
          },
          { status: 400 }
        )
      }

      const { error: moveError } = await getAdminSupabaseClient().rpc(
        'move_organization_by_type',
        {
          p_actor_user_id: gate.user.profileId,
          p_organization_id: current.id,
          p_new_parent_id: requestedParentId,
          p_new_type_code: finalType,
        }
      )

      if (moveError) {
        console.error(
          '[organizations:PUT] type-aware move failed:',
          moveError.message
        )
        return NextResponse.json(
          { error: 'تعذر تحديث النوع أو التبعية: ' + moveError.message },
          { status: 400 }
        )
      }
    }

    const updatePayload: Record<string, unknown> = {}

    if (typeof body.name === 'string') updatePayload.name = body.name.trim()
    if (typeof body.code === 'string') updatePayload.code = body.code.trim().toUpperCase()
    if (typeof body.is_active === 'boolean') updatePayload.is_active = body.is_active

    if (hasV2Permission(gate.access, 'organizations.manage_capabilities')) {
      for (const field of CAPABILITY_FIELDS) {
        if (field in body) updatePayload[field] = Boolean(body[field])
      }
    }

    const admin = getAdminSupabaseClient()

    let updated: OrganizationRow | null = null
    let error: { message: string } | null = null

    if (Object.keys(updatePayload).length > 0) {
      const updateResult = await admin
        .from('organizations')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single()

      updated = updateResult.data as OrganizationRow | null
      error = updateResult.error
    } else {
      const reloadResult = await admin
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single()

      updated = reloadResult.data as OrganizationRow | null
      error = reloadResult.error
    }

    if (error) {
      console.error('[organizations:PUT] update failed:', error.message)
      return NextResponse.json({ error: 'فشل تحديث بيانات الوحدة' }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'تعذر إعادة تحميل الوحدة بعد التحديث' },
        { status: 500 }
      )
    }

    const updatedOrg = updated
    return NextResponse.json({
      success: true,
      data: updatedOrg,
      message: `تم تحديث بيانات الوحدة (${updatedOrg.name}) بنجاح.`,
    })
  } catch (error) {
    console.error('[organizations:PUT] unexpected error:', error)
    return NextResponse.json({ error: 'خطأ غير متوقع' }, { status: 500 })
  }
}

// DELETE: soft-disable an organization only with organizations.delete and matching scope.
export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireV2Permission('organizations.delete')
    if (!gate.ok) return gate.response

    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'معرف الوحدة مطلوب' }, { status: 400 })
    }

    const current = await loadOrganization(id)
    if (!current) {
      return NextResponse.json({ error: 'الوحدة التنظيمية غير موجودة' }, { status: 404 })
    }

    const scopeDecision = await authorizeOrganization({
      permissionKey: 'organizations.delete',
      user: gate.user,
      access: gate.access,
      organization: current,
    })

    if (!scopeDecision.allowed) {
      return NextResponse.json(
        { error: 'لا يمكن تعطيل جهة خارج نطاقك التنظيمي', code: 'SCOPE_DENIED' },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()
    const { error } = await admin
      .from('organizations')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('[organizations:DELETE] update failed:', error.message)
      return NextResponse.json({ error: 'فشل تعطيل الوحدة' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'تم تعطيل الوحدة التنظيمية بنجاح.',
    })
  } catch (error) {
    console.error('[organizations:DELETE] unexpected error:', error)
    return NextResponse.json({ error: 'خطأ غير متوقع' }, { status: 500 })
  }
}
