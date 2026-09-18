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
  created_at?: string | null
  created_by_user_id?: string | null
  updated_at?: string | null
  updated_by_user_id?: string | null
  lifecycle_status?: string | null
  deactivated_at?: string | null
  deactivated_by_user_id?: string | null
  archived_at?: string | null
  archived_by_user_id?: string | null
  [key: string]: unknown
}

const CAPABILITY_FIELDS = [
  'can_issue_missions',
  'can_approve_missions',
  'can_view_all_governorate',
  'can_view_sector_facilities',
] as const


type DatabaseErrorLike = {
  code?: string | null
  message?: string | null
  details?: string | null
}

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

const FALLBACK_ORGANIZATION_TYPES: OrganizationTypeRow[] = [
  {
    code: 'ministry',
    display_name_ar: 'الوزارة',
    description_ar: 'ديوان وزارة الصحة والسكان',
    sort_order: 10,
    is_active: true,
  },
  {
    code: 'sector',
    display_name_ar: 'قطاع',
    description_ar: 'قطاع مركزي بديوان الوزارة',
    sort_order: 20,
    is_active: true,
  },
  {
    code: 'central_administration',
    display_name_ar: 'إدارة مركزية',
    description_ar: 'إدارة مركزية بالديوان',
    sort_order: 30,
    is_active: true,
  },
  {
    code: 'general_administration',
    display_name_ar: 'إدارة عامة',
    description_ar: 'إدارة عامة داخل الديوان أو المديرية',
    sort_order: 40,
    is_active: true,
  },
  {
    code: 'administration',
    display_name_ar: 'إدارة',
    description_ar: 'إدارة إدارية أو فنية',
    sort_order: 50,
    is_active: true,
  },
  {
    code: 'department',
    display_name_ar: 'قسم',
    description_ar: 'قسم إداري أو فني',
    sort_order: 60,
    is_active: true,
  },
  {
    code: 'section',
    display_name_ar: 'وحدة تنظيمية / شعبة',
    description_ar: 'وحدة تنظيمية أصغر داخل الإدارة أو القسم',
    sort_order: 70,
    is_active: true,
  },
  {
    code: 'health_directorate',
    display_name_ar: 'مديرية الشؤون الصحية',
    description_ar: 'ديوان مديرية الشؤون الصحية بالمحافظة',
    sort_order: 80,
    is_active: true,
  },
  {
    code: 'health_administration',
    display_name_ar: 'إدارة صحية',
    description_ar: 'الإدارة الصحية الجغرافية التابعة للمديرية',
    sort_order: 90,
    is_active: true,
  },
]

const FALLBACK_ORGANIZATION_RELATIONS: OrganizationTypeRelationRow[] = [
  ['ministry', 'sector'],
  ['ministry', 'central_administration'],
  ['ministry', 'general_administration'],
  ['ministry', 'health_directorate'],
  ['sector', 'central_administration'],
  ['sector', 'general_administration'],
  ['sector', 'administration'],
  ['central_administration', 'general_administration'],
  ['central_administration', 'administration'],
  ['general_administration', 'administration'],
  ['general_administration', 'department'],
  ['general_administration', 'section'],
  ['administration', 'department'],
  ['administration', 'section'],
  ['department', 'section'],
  ['health_directorate', 'general_administration'],
  ['health_directorate', 'administration'],
  ['health_directorate', 'department'],
  ['health_directorate', 'section'],
  ['health_directorate', 'health_administration'],
  ['health_administration', 'administration'],
  ['health_administration', 'department'],
  ['health_administration', 'section'],
].map(([parent_type_code, child_type_code]) => ({
  parent_type_code,
  child_type_code,
  is_active: true,
}))

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

  if (typesError || relationsError) {
    console.warn('[organizations] taxonomy query fallback:', {
      typesError: typesError?.message ?? null,
      relationsError: relationsError?.message ?? null,
    })

    return {
      types: FALLBACK_ORGANIZATION_TYPES,
      relations: FALLBACK_ORGANIZATION_RELATIONS,
    }
  }

  const resolvedTypes = (types ?? []) as OrganizationTypeRow[]
  const resolvedRelations = (relations ?? []) as OrganizationTypeRelationRow[]

  if (resolvedTypes.length === 0 || resolvedRelations.length === 0) {
    return {
      types: FALLBACK_ORGANIZATION_TYPES,
      relations: FALLBACK_ORGANIZATION_RELATIONS,
    }
  }

  return {
    types: resolvedTypes,
    relations: resolvedRelations,
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

function inferOrganizationTypeCode(input: {
  levelLabel: string
  name: string
  healthAdmin: string | null
}): string {
  if (input.levelLabel === 'ministry') return 'ministry'
  if (input.levelLabel === 'sector') return 'sector'
  if (input.levelLabel === 'central_admin') return 'central_administration'
  if (input.levelLabel === 'general_admin') return 'general_administration'
  if (input.levelLabel === 'directorate') return 'health_directorate'

  if (input.levelLabel === 'health_admin') {
    if (
      input.healthAdmin?.trim() ||
      input.name.startsWith('الإدارة الصحية') ||
      input.name.startsWith('إدارة صحية') ||
      input.name.startsWith('ادارة صحية')
    ) {
      return 'health_administration'
    }

    return 'administration'
  }

  if (input.levelLabel === 'department') return 'department'
  if (input.levelLabel === 'section') return 'section'

  return 'administration'
}

type OrganizationUsageRow = {
  organization_id: string
  users_total: number | string | null
  users_active: number | string | null
  child_organizations_total: number | string | null
  child_organizations_active: number | string | null
  facilities_total: number | string | null
  facilities_active: number | string | null
  missions_created: number | string | null
  missions_inspector: number | string | null
  active_role_assignments: number | string | null
  form_templates_total: number | string | null
  violations_total: number | string | null
  leadership_targets_total: number | string | null
  mission_targets_total: number | string | null
}

function emptyOrganizationUsage() {
  return {
    usersTotal: 0,
    usersActive: 0,
    childOrganizationsTotal: 0,
    childOrganizationsActive: 0,
    facilitiesTotal: 0,
    facilitiesActive: 0,
    missionsCreated: 0,
    missionsInspector: 0,
    activeRoleAssignments: 0,
    formTemplatesTotal: 0,
    violationsTotal: 0,
    leadershipTargetsTotal: 0,
    missionTargetsTotal: 0,
  }
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

function organizationConflictResponse(
  error: DatabaseErrorLike | null | undefined
): NextResponse | null {
  if (error?.code !== '23505') return null

  const diagnostic = `${error.message ?? ''} ${error.details ?? ''}`

  if (diagnostic.includes('idx_org_code')) {
    return NextResponse.json(
      {
        error: 'كود الجهة مستخدم بالفعل',
        code: 'ORGANIZATION_CODE_CONFLICT',
      },
      { status: 409 }
    )
  }

  return NextResponse.json(
    {
      error: 'توجد جهة بنفس الاسم والنوع تحت الجهة الأم نفسها',
      code: 'ORGANIZATION_DUPLICATE',
    },
    { status: 409 }
  )
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
        organizationTypeCode: org.organization_type_code,
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

async function loadOrganizationUsage(
  organizationId: string
): Promise<ReturnType<typeof emptyOrganizationUsage>> {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('organization_usage_stats')
    .select(
      'organization_id, users_total, users_active, child_organizations_total, child_organizations_active, facilities_total, facilities_active, missions_created, missions_inspector, active_role_assignments, form_templates_total, violations_total, leadership_targets_total, mission_targets_total'
    )
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `[Organizations] Failed to load usage summary: ${error.message}`
    )
  }

  if (!data) return emptyOrganizationUsage()

  const row = data as OrganizationUsageRow

  return {
    usersTotal: Number(row.users_total ?? 0),
    usersActive: Number(row.users_active ?? 0),
    childOrganizationsTotal: Number(row.child_organizations_total ?? 0),
    childOrganizationsActive: Number(row.child_organizations_active ?? 0),
    facilitiesTotal: Number(row.facilities_total ?? 0),
    facilitiesActive: Number(row.facilities_active ?? 0),
    missionsCreated: Number(row.missions_created ?? 0),
    missionsInspector: Number(row.missions_inspector ?? 0),
    activeRoleAssignments: Number(row.active_role_assignments ?? 0),
    formTemplatesTotal: Number(row.form_templates_total ?? 0),
    violationsTotal: Number(row.violations_total ?? 0),
    leadershipTargetsTotal: Number(row.leadership_targets_total ?? 0),
    missionTargetsTotal: Number(row.mission_targets_total ?? 0),
  }
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

// GET: return organizations inside the caller's effective organizations.view scope.
export async function GET() {
  try {
    let gate: Awaited<ReturnType<typeof requireV2Permission>>

    try {
      gate = await requireV2Permission('organizations.view')
    } catch (guardError) {
      console.error(
        '[organizations:GET] permission guard failed:',
        guardError
      )
      return NextResponse.json(
        {
          error: 'تعذر التحقق من صلاحية عرض الهيكل التنظيمي',
          code: 'ORGANIZATIONS_GUARD_FAILED',
        },
        { status: 500 }
      )
    }

    if (!gate.ok) return gate.response

    const admin = getAdminSupabaseClient()
    const { data, error } = await admin
      .from('organizations')
      .select(
        'id, name, level, level_label, organization_type_code, parent_id, sector_id, governorate, health_admin, code, is_active, can_issue_missions, can_approve_missions, can_view_all_governorate, can_view_sector_facilities'
      )
      .order('level')
      .order('name')

    if (error) {
      console.error('[organizations:GET] organizations query failed:', error)
      return NextResponse.json(
        {
          error: 'تعذر تحميل بيانات الهيكل التنظيمي',
          code: 'ORGANIZATIONS_QUERY_FAILED',
        },
        { status: 500 }
      )
    }

    const organizations: OrganizationRow[] = (data ?? []).map((row) => ({
      ...row,
      organization_type_code:
        typeof row.organization_type_code === 'string' &&
        row.organization_type_code
          ? row.organization_type_code
          : inferOrganizationTypeCode({
              levelLabel: String(row.level_label || ''),
              name: String(row.name || ''),
              healthAdmin:
                typeof row.health_admin === 'string'
                  ? row.health_admin
                  : null,
            }),
    })) as OrganizationRow[]

    let allowed: OrganizationRow[]

    try {
      const facts = toOrganizationFacts(organizations)
      allowed = organizations.filter((organization) =>
        evaluateV2ResourceScope({
          user: gate.user,
          snapshot: gate.access,
          permissionKey: 'organizations.view',
          resource: toResource(organization),
          organizationFacts: facts,
        }).allowed
      )
    } catch (scopeError) {
      console.error(
        '[organizations:GET] scope evaluation failed:',
        scopeError
      )
      return NextResponse.json(
        {
          error: 'تعذر تحديد نطاق عرض الهيكل التنظيمي',
          code: 'ORGANIZATIONS_SCOPE_FAILED',
        },
        { status: 500 }
      )
    }

    const allowedIds = allowed.map((organization) => organization.id)
    const metadataById = new Map<string, Record<string, unknown>>()
    const usageById = new Map<string, ReturnType<typeof emptyOrganizationUsage>>()
    const actorIds = new Set<string>()

    if (allowedIds.length > 0) {
      const { data: metadataRows, error: metadataError } = await admin
        .from('organizations')
        .select(
          'id, created_at, created_by_user_id, updated_at, updated_by_user_id, lifecycle_status, deactivated_at, deactivated_by_user_id, archived_at, archived_by_user_id'
        )
        .in('id', allowedIds)

      if (metadataError) {
        console.warn(
          '[organizations:GET] lifecycle metadata unavailable:',
          metadataError.message
        )
      } else {
        for (const row of metadataRows ?? []) {
          metadataById.set(String(row.id), row as Record<string, unknown>)

          for (const value of [
            row.created_by_user_id,
            row.updated_by_user_id,
            row.deactivated_by_user_id,
            row.archived_by_user_id,
          ]) {
            if (value) actorIds.add(String(value))
          }
        }
      }

      const { data: usageRows, error: usageError } = await admin
        .from('organization_usage_stats')
        .select(
          'organization_id, users_total, users_active, child_organizations_total, child_organizations_active, facilities_total, facilities_active, missions_created, missions_inspector, active_role_assignments, form_templates_total, violations_total, leadership_targets_total, mission_targets_total'
        )
        .in('organization_id', allowedIds)

      if (usageError) {
        console.warn(
          '[organizations:GET] usage summary unavailable:',
          usageError.message
        )
      } else {
        for (const row of (usageRows ?? []) as OrganizationUsageRow[]) {
          usageById.set(String(row.organization_id), {
            usersTotal: Number(row.users_total ?? 0),
            usersActive: Number(row.users_active ?? 0),
            childOrganizationsTotal: Number(
              row.child_organizations_total ?? 0
            ),
            childOrganizationsActive: Number(
              row.child_organizations_active ?? 0
            ),
            facilitiesTotal: Number(row.facilities_total ?? 0),
            facilitiesActive: Number(row.facilities_active ?? 0),
            missionsCreated: Number(row.missions_created ?? 0),
            missionsInspector: Number(row.missions_inspector ?? 0),
            activeRoleAssignments: Number(
              row.active_role_assignments ?? 0
            ),
            formTemplatesTotal: Number(row.form_templates_total ?? 0),
            violationsTotal: Number(row.violations_total ?? 0),
            leadershipTargetsTotal: Number(
              row.leadership_targets_total ?? 0
            ),
            missionTargetsTotal: Number(row.mission_targets_total ?? 0),
          })
        }
      }
    }

    const actorNameById = new Map<string, string>()

    if (actorIds.size > 0) {
      const { data: actors, error: actorsError } = await admin
        .from('users')
        .select('id, full_name')
        .in('id', [...actorIds])

      if (actorsError) {
        console.warn(
          '[organizations:GET] actor names unavailable:',
          actorsError.message
        )
      } else {
        for (const actor of actors ?? []) {
          actorNameById.set(
            String(actor.id),
            String(actor.full_name || 'مستخدم')
          )
        }
      }
    }

    const typeNameByCode = new Map(
      FALLBACK_ORGANIZATION_TYPES.map((item) => [
        item.code,
        item.display_name_ar,
      ])
    )

    return NextResponse.json({
      success: true,
      data: allowed.map((organization) => {
        const metadata = metadataById.get(organization.id) ?? {}
        const createdById = metadata.created_by_user_id
          ? String(metadata.created_by_user_id)
          : null
        const updatedById = metadata.updated_by_user_id
          ? String(metadata.updated_by_user_id)
          : null
        const deactivatedById = metadata.deactivated_by_user_id
          ? String(metadata.deactivated_by_user_id)
          : null
        const archivedById = metadata.archived_by_user_id
          ? String(metadata.archived_by_user_id)
          : null

        return {
          ...organization,
          organization_type_name_ar:
            typeNameByCode.get(organization.organization_type_code) ||
            'جهة تنظيمية',
          lifecycle_status:
            typeof metadata.lifecycle_status === 'string'
              ? metadata.lifecycle_status
              : organization.is_active === false
                ? 'inactive'
                : 'active',
          created_at:
            typeof metadata.created_at === 'string'
              ? metadata.created_at
              : null,
          created_by_name: createdById
            ? actorNameById.get(createdById) || null
            : null,
          updated_at:
            typeof metadata.updated_at === 'string'
              ? metadata.updated_at
              : null,
          updated_by_name: updatedById
            ? actorNameById.get(updatedById) || null
            : null,
          deactivated_at:
            typeof metadata.deactivated_at === 'string'
              ? metadata.deactivated_at
              : null,
          deactivated_by_name: deactivatedById
            ? actorNameById.get(deactivatedById) || null
            : null,
          archived_at:
            typeof metadata.archived_at === 'string'
              ? metadata.archived_at
              : null,
          archived_by_name: archivedById
            ? actorNameById.get(archivedById) || null
            : null,
          usage: usageById.get(organization.id) ?? emptyOrganizationUsage(),
        }
      }),
      organizationTypes: FALLBACK_ORGANIZATION_TYPES.map((item) => ({
        code: item.code,
        nameAr: item.display_name_ar,
        descriptionAr: item.description_ar,
      })),
      typeRelations: FALLBACK_ORGANIZATION_RELATIONS.map((relation) => ({
        parentTypeCode: relation.parent_type_code,
        childTypeCode: relation.child_type_code,
      })),
    })
  } catch (error) {
    console.error('[organizations:GET] unexpected error:', error)
    return NextResponse.json(
      {
        error: 'تعذر تحميل الهيكل التنظيمي',
        code: 'ORGANIZATIONS_UNEXPECTED_ERROR',
      },
      { status: 500 }
    )
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
      created_by_user_id: gate.user.profileId,
      lifecycle_status: 'active',
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
      const conflictResponse = organizationConflictResponse(insertError)
      if (conflictResponse) return conflictResponse

      console.error('[organizations:POST] insert failed:', insertError.message)
      return NextResponse.json({ error: 'فشل حفظ الوحدة الفرعية' }, { status: 500 })
    }

    const insertedOrg = inserted as OrganizationRow

    const { error: auditError } = await admin
      .from('organization_change_audit')
      .insert({
        organization_id: insertedOrg.id,
        actor_user_id: gate.user.profileId,
        action: 'create',
        after_data: insertedOrg,
      })

    if (auditError) {
      console.warn(
        '[organizations:POST] create audit failed:',
        auditError.message
      )
    }

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
        const conflictResponse = organizationConflictResponse(moveError)
        if (conflictResponse) return conflictResponse

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

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by_user_id: gate.user.profileId,
    }

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
    let error: DatabaseErrorLike | null = null

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
      const conflictResponse = organizationConflictResponse(error)
      if (conflictResponse) return conflictResponse

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

    const { error: auditError } = await admin
      .from('organization_change_audit')
      .insert({
        organization_id: updatedOrg.id,
        actor_user_id: gate.user.profileId,
        action: 'update',
        before_data: current,
        after_data: updatedOrg,
      })

    if (auditError) {
      console.warn(
        '[organizations:PUT] update audit failed:',
        auditError.message
      )
    }

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

// PATCH: manage organization lifecycle without deleting historical data.
export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireV2Permission('organizations.edit')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    const action =
      body.action === 'deactivate' ||
      body.action === 'reactivate' ||
      body.action === 'archive'
        ? body.action
        : ''
    const reason =
      typeof body.reason === 'string'
        ? body.reason.trim().slice(0, 500)
        : ''

    if (!id || !action) {
      return NextResponse.json(
        { error: 'الجهة والإجراء مطلوبان' },
        { status: 400 }
      )
    }

    const current = await loadOrganization(id)
    if (!current) {
      return NextResponse.json(
        { error: 'الجهة التنظيمية غير موجودة' },
        { status: 404 }
      )
    }

    const scopeDecision = await authorizeOrganization({
      permissionKey: 'organizations.edit',
      user: gate.user,
      access: gate.access,
      organization: current,
    })

    if (!scopeDecision.allowed) {
      return NextResponse.json(
        {
          error: 'لا يمكن تغيير حالة جهة خارج نطاقك التنظيمي',
          code: 'SCOPE_DENIED',
        },
        { status: 403 }
      )
    }

    if (action !== 'reactivate') {
      const usage = await loadOrganizationUsage(id)

      if (
        usage.childOrganizationsActive > 0 ||
        usage.usersActive > 0 ||
        usage.facilitiesActive > 0 ||
        usage.activeRoleAssignments > 0
      ) {
        return NextResponse.json(
          {
            error:
              'لا يمكن إيقاف أو أرشفة الجهة قبل معالجة الجهات التابعة والحسابات والمنشآت وإسنادات العمل النشطة',
            code: 'ORGANIZATION_HAS_ACTIVE_DEPENDENCIES',
            usage,
          },
          { status: 409 }
        )
      }
    }

    const admin = getAdminSupabaseClient()
    const { error } = await admin.rpc('mutate_organization_lifecycle', {
      p_organization_id: id,
      p_action: action,
      p_actor_user_id: gate.user.profileId,
      p_reason: reason || null,
    })

    if (error) {
      console.error(
        '[organizations:PATCH] lifecycle mutation failed:',
        error.message
      )
      return NextResponse.json(
        { error: 'تعذر تغيير حالة الجهة' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[organizations:PATCH] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تغيير حالة الجهة' },
      { status: 500 }
    )
  }
}

// DELETE: hard-delete only a completely unused organization.
export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireV2Permission('organizations.delete')
    if (!gate.ok) return gate.response

    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'معرف الجهة مطلوب' },
        { status: 400 }
      )
    }

    const current = await loadOrganization(id)
    if (!current) {
      return NextResponse.json(
        { error: 'الجهة التنظيمية غير موجودة' },
        { status: 404 }
      )
    }

    if (current.organization_type_code === 'ministry') {
      return NextResponse.json(
        { error: 'لا يمكن حذف جهة الوزارة الرئيسية' },
        { status: 400 }
      )
    }

    const scopeDecision = await authorizeOrganization({
      permissionKey: 'organizations.delete',
      user: gate.user,
      access: gate.access,
      organization: current,
    })

    if (!scopeDecision.allowed) {
      return NextResponse.json(
        {
          error: 'لا يمكن حذف جهة خارج نطاقك التنظيمي',
          code: 'SCOPE_DENIED',
        },
        { status: 403 }
      )
    }

    const usage = await loadOrganizationUsage(id)
    const visibleLinkedRecords =
      usage.usersTotal +
      usage.childOrganizationsTotal +
      usage.facilitiesTotal +
      usage.missionsCreated +
      usage.missionsInspector +
      usage.activeRoleAssignments +
      usage.formTemplatesTotal +
      usage.violationsTotal +
      usage.leadershipTargetsTotal +
      usage.missionTargetsTotal

    if (visibleLinkedRecords > 0) {
      return NextResponse.json(
        {
          error:
            'لا يمكن حذف الجهة نهائيًا لأنها مرتبطة بسجلات تاريخية. استخدم الأرشفة بدلًا من ذلك.',
          code: 'ORGANIZATION_HAS_LINKED_RECORDS',
          usage,
        },
        { status: 409 }
      )
    }

    const admin = getAdminSupabaseClient()
    const { error: deleteError } = await admin
      .from('organizations')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.warn(
        '[organizations:DELETE] hard delete blocked:',
        deleteError.message
      )
      return NextResponse.json(
        {
          error:
            'لا يمكن حذف الجهة نهائيًا لوجود ارتباطات أخرى محفوظة في النظام. استخدم الأرشفة.',
          code: 'ORGANIZATION_DELETE_BLOCKED',
        },
        { status: 409 }
      )
    }

    const { error: auditError } = await admin
      .from('access_admin_audit')
      .insert({
        actor_user_id: gate.user.profileId,
        action: 'organization.hard_deleted',
        details: {
          organization_id: id,
          organization_name: current.name,
        },
      })

    if (auditError) {
      console.warn(
        '[organizations:DELETE] audit failed:',
        auditError.message
      )
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف الجهة غير المستخدمة نهائيًا.',
    })
  } catch (error) {
    console.error('[organizations:DELETE] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء حذف الجهة' },
      { status: 500 }
    )
  }
}
