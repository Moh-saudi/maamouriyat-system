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
    const { data, error } = await admin
      .from('organizations')
      .select('*')
      .order('level')
      .order('name')

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

    return NextResponse.json({ success: true, data: allowed })
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

    if (!name) {
      return NextResponse.json({ error: 'اسم الوحدة أو الإدارة الفرعية مطلوب' }, { status: 400 })
    }

    if (!parentId) {
      return NextResponse.json(
        { error: 'يجب اختيار الجهة الأم من الشجرة التنظيمية' },
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
    const parent = await loadOrganization(parentId)

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

    const resolvedLevel = Number(parent.level) + 1

    if (resolvedLevel < 2 || resolvedLevel > 7) {
      return NextResponse.json(
        { error: 'لا يمكن إنشاء مستوى تنظيمي أسفل هذه الجهة' },
        { status: 400 }
      )
    }

    const validLevelLabels: Record<number, string> = {
      1: 'ministry',
      2: 'sector',
      3: 'central_admin',
      4: 'general_admin',
      5: 'directorate',
      6: 'health_admin',
      7: 'unit',
    }

    const requestedLabel =
      typeof body.level_label === 'string' ? body.level_label : ''
    const finalLevelLabel =
      requestedLabel === validLevelLabels[resolvedLevel]
        ? requestedLabel
        : validLevelLabels[resolvedLevel]

    const newOrganizationId = randomUUID()
    const resolvedSectorId =
      resolvedLevel === 2
        ? newOrganizationId
        : parent.sector_id ?? (parent.level === 2 ? parent.id : null)

    const payload: Record<string, unknown> = {
      id: newOrganizationId,
      name,
      code: code || `SUB-${Date.now().toString(36).toUpperCase()}`,
      parent_id: parent.id,
      sector_id: resolvedSectorId,
      level: resolvedLevel,
      level_label: finalLevelLabel,
      governorate:
        typeof body.governorate === 'string'
          ? body.governorate
          : parent.governorate,
      health_admin:
        typeof body.health_admin === 'string'
          ? body.health_admin
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
      typeof body.parent_id === 'string' ? body.parent_id : null

    if (
      requestedParentId &&
      requestedParentId !== current.parent_id
    ) {
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
            error: 'لا يمكنك نقل الوحدة إلى جهة أم خارج نطاقك التنظيمي',
            code: 'PARENT_SCOPE_DENIED',
          },
          { status: 403 }
        )
      }

      const { error: reparentError } = await getAdminSupabaseClient().rpc(
        'reparent_v2_organization',
        {
          p_actor_user_id: gate.user.profileId,
          p_organization_id: current.id,
          p_new_parent_id: requestedParentId,
        }
      )

      if (reparentError) {
        console.error(
          '[organizations:PUT] reparent failed:',
          reparentError.message
        )
        return NextResponse.json(
          { error: 'تعذر تغيير الجهة الأم: ' + reparentError.message },
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
