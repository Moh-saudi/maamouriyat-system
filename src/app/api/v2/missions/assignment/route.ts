import { NextResponse } from 'next/server'
import {
  evaluateV2ResourceScope,
  hasV2Permission,
} from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import type { V2AuthorizationSnapshot } from '@/server/authorization/types'
import type { V2AuthenticatedUser } from '@/server/auth/types'
import type { V2OrganizationFact } from '@/server/authorization/scope-types'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type OrganizationRow = {
  id: string
  name: string
  parent_id: string | null
  sector_id: string | null
  governorate: string | null
  level: number
  organization_type_code: string | null
}

type FacilityRow = {
  id: string
  name: string
  facility_type: string
  organization_id: string
  sector_id: string | null
  governorate: string | null
  health_admin: string | null
  village_city: string | null
  is_active: boolean | null
}

type UserRow = {
  id: string
  full_name: string
  job_title: string | null
  organization_id: string | null
  sector_id: string | null
  org_level: number | null
  level: number | null
  is_active: boolean | null
}

type TemplateRow = {
  id: string
  name: string
  version: string | null
  description: string | null
  created_by_org: string | null
  applicable_sectors: string[] | null
  applicable_levels: number[] | null
  applicable_facility_types: string[] | null
  is_base: boolean | null
  is_active: boolean | null
}

function buildOrganizationFacts(
  organizations: readonly OrganizationRow[]
): Map<string, V2OrganizationFact> {
  return new Map(
    organizations.map((organization) => [
      organization.id,
      {
        id: organization.id,
        parentId: organization.parent_id,
        sectorId: organization.sector_id,
        governorate: organization.governorate,
        level: organization.level,
        organizationTypeCode: organization.organization_type_code,
      },
    ])
  )
}

function resourceAllowed(input: {
  user: V2AuthenticatedUser
  access: V2AuthorizationSnapshot
  permissionKey: string
  organizationFacts: ReadonlyMap<string, V2OrganizationFact>
  organizationId: string | null
  sectorId?: string | null
  governorate?: string | null
}): boolean {
  return evaluateV2ResourceScope({
    user: input.user,
    snapshot: input.access,
    permissionKey: input.permissionKey,
    organizationFacts: input.organizationFacts,
    resource: {
      organizationId: input.organizationId,
      sectorId: input.sectorId ?? null,
      governorate: input.governorate ?? null,
    },
  }).allowed
}

async function loadOrganizations(): Promise<OrganizationRow[]> {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('organizations')
    .select(
      'id, name, parent_id, sector_id, governorate, level, organization_type_code'
    )
    .eq('is_active', true)
    .eq('lifecycle_status', 'active')
    .order('level')
    .order('name')

  if (error) {
    throw new Error(
      `[V2 Mission Assignment] Failed to load organizations: ${error.message}`
    )
  }

  return (data ?? []) as OrganizationRow[]
}

async function loadExecutionEligibleUserIds(): Promise<Set<string>> {
  const admin = getAdminSupabaseClient()
  const nowIso = new Date().toISOString()

  const { data: grants, error: grantsError } = await admin
    .from('role_permission_grants')
    .select('role_id')
    .eq('permission_key', 'missions.execute')

  if (grantsError) {
    throw new Error(
      `[V2 Mission Assignment] Failed to load execute roles: ${grantsError.message}`
    )
  }

  const roleIds = [
    ...new Set((grants ?? []).map((row) => String(row.role_id))),
  ]

  if (roleIds.length === 0) return new Set()

  const { data: assignments, error: assignmentsError } = await admin
    .from('user_roles')
    .select('user_id, role_id, valid_until')
    .in('role_id', roleIds)
    .eq('is_active', true)
    .or(`valid_until.is.null,valid_until.gt.${nowIso}`)

  if (assignmentsError) {
    throw new Error(
      `[V2 Mission Assignment] Failed to load execute assignments: ${assignmentsError.message}`
    )
  }

  const userIds = [
    ...new Set((assignments ?? []).map((row) => String(row.user_id))),
  ]

  if (userIds.length === 0) return new Set()

  const { data: deniedOverrides, error: overridesError } = await admin
    .from('user_permission_overrides')
    .select('user_id')
    .in('user_id', userIds)
    .eq('permission_key', 'missions.execute')
    .eq('effect', 'deny')
    .eq('is_active', true)

  if (overridesError) {
    throw new Error(
      `[V2 Mission Assignment] Failed to load execute overrides: ${overridesError.message}`
    )
  }

  const deniedIds = new Set(
    (deniedOverrides ?? []).map((row) => String(row.user_id))
  )

  return new Set(userIds.filter((id) => !deniedIds.has(id)))
}

async function loadAssignmentOptions(input: {
  user: V2AuthenticatedUser
  access: V2AuthorizationSnapshot
}) {
  const admin = getAdminSupabaseClient()
  const organizations = await loadOrganizations()
  const organizationFacts = buildOrganizationFacts(organizations)
  const organizationById = new Map(
    organizations.map((organization) => [organization.id, organization])
  )

  const executeUserIds = await loadExecutionEligibleUserIds()

  const [
    { data: facilityRows, error: facilitiesError },
    { data: userRows, error: usersError },
    { data: templateRows, error: templatesError },
  ] = await Promise.all([
    admin
      .from('facilities')
      .select(
        'id, name, facility_type, organization_id, sector_id, governorate, health_admin, village_city, is_active'
      )
      .eq('is_active', true)
      .order('name')
      .limit(6000),
    executeUserIds.size > 0
      ? admin
          .from('users')
          .select(
            'id, full_name, job_title, organization_id, sector_id, org_level, level, is_active'
          )
          .in('id', [...executeUserIds])
          .eq('is_active', true)
          .order('full_name')
          .limit(2000)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from('form_templates')
      .select(
        'id, name, version, description, created_by_org, applicable_sectors, applicable_levels, applicable_facility_types, is_base, is_active'
      )
      .eq('is_active', true)
      .order('is_base', { ascending: false })
      .order('name'),
  ])

  if (facilitiesError || usersError || templatesError) {
    throw new Error(
      '[V2 Mission Assignment] Failed to load assignment options: ' +
        (facilitiesError?.message ||
          usersError?.message ||
          templatesError?.message)
    )
  }

  const facilities = ((facilityRows ?? []) as FacilityRow[])
    .filter((facility) =>
      resourceAllowed({
        user: input.user,
        access: input.access,
        permissionKey: 'missions.create',
        organizationFacts,
        organizationId: facility.organization_id,
        sectorId: facility.sector_id,
        governorate: facility.governorate,
      })
    )
    .map((facility) => ({
      id: facility.id,
      name: facility.name,
      facility_type: facility.facility_type,
      organization_id: facility.organization_id,
      organization_name:
        organizationById.get(facility.organization_id)?.name ?? 'جهة غير مسماة',
      governorate: facility.governorate,
      health_admin: facility.health_admin,
      village_city: facility.village_city,
    }))

  const inspectors = ((userRows ?? []) as UserRow[])
    .filter((candidate) => {
      if (!candidate.organization_id) return false

      const organization = organizationById.get(candidate.organization_id)
      if (!organization) return false

      return resourceAllowed({
        user: input.user,
        access: input.access,
        permissionKey: 'missions.assign',
        organizationFacts,
        organizationId: candidate.organization_id,
        sectorId:
          candidate.sector_id ??
          organization.sector_id,
        governorate: organization.governorate,
      })
    })
    .map((candidate) => ({
      id: candidate.id,
      full_name: candidate.full_name,
      job_title: candidate.job_title,
      organization_id: candidate.organization_id,
      organization_name: candidate.organization_id
        ? organizationById.get(candidate.organization_id)?.name ?? 'جهة غير مسماة'
        : 'جهة غير محددة',
      org_level: candidate.org_level ?? candidate.level ?? 7,
    }))

  const templates = ((templateRows ?? []) as TemplateRow[]).map((template) => ({
    id: template.id,
    name: template.name,
    version: template.version,
    description: template.description,
    is_base: template.is_base === true,
    applicable_facility_types: template.applicable_facility_types,
  }))

  return {
    facilities,
    inspectors,
    templates,
    canApprove: hasV2Permission(input.access, 'missions.approve'),
  }
}

function parseIdArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ].slice(0, max)
}

function parseDate(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function dateOnlyToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const gate = await requireV2Permission('missions.create')
    if (!gate.ok) return gate.response

    if (!hasV2Permission(gate.access, 'missions.assign')) {
      return NextResponse.json(
        {
          error: 'إنشاء تكليف مأمورية يتطلب صلاحية تكليف فريق العمل',
          code: 'ASSIGN_PERMISSION_REQUIRED',
        },
        { status: 403 }
      )
    }

    const options = await loadAssignmentOptions({
      user: gate.user,
      access: gate.access,
    })

    return NextResponse.json({
      success: true,
      caller: {
        id: gate.user.profileId,
        name: gate.user.fullName,
        organization_id: gate.user.organizationId,
        organization_name: gate.user.organizationName,
      },
      ...options,
    })
  } catch (error) {
    console.error('[v2-mission-assignment:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'تعذر تحميل بيانات تكليف المأمورية' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('missions.create')
    if (!gate.ok) return gate.response

    if (!hasV2Permission(gate.access, 'missions.assign')) {
      return NextResponse.json(
        {
          error: 'إنشاء تكليف مأمورية يتطلب صلاحية تكليف فريق العمل',
          code: 'ASSIGN_PERMISSION_REQUIRED',
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as Record<string, unknown>

    const facilityIds = parseIdArray(body.facility_ids, 50)
    const teamUserIds = parseIdArray(body.team_user_ids, 20)
    const primaryUserId =
      typeof body.primary_user_id === 'string'
        ? body.primary_user_id.trim()
        : ''
    const templateId =
      typeof body.template_id === 'string' ? body.template_id.trim() : ''
    const scheduledDate = parseDate(body.scheduled_date)
    const expectedEndDate =
      parseDate(body.expected_end_date) || scheduledDate
    const priority =
      body.priority === 'urgent' || body.priority === 'high'
        ? body.priority
        : 'normal'
    const visitPurpose =
      typeof body.visit_purpose === 'string'
        ? body.visit_purpose.trim().slice(0, 2000)
        : ''
    const notes =
      typeof body.notes === 'string'
        ? body.notes.trim().slice(0, 4000)
        : ''
    const sourceTargetId =
      typeof body.source_target_id === 'string' && body.source_target_id.trim()
        ? body.source_target_id.trim()
        : null

    if (
      facilityIds.length === 0 ||
      teamUserIds.length === 0 ||
      !primaryUserId ||
      !teamUserIds.includes(primaryUserId) ||
      !templateId ||
      !scheduledDate ||
      !visitPurpose
    ) {
      return NextResponse.json(
        { error: 'بيانات التكليف الأساسية غير مكتملة' },
        { status: 400 }
      )
    }

    if (
      Number.isNaN(Date.parse(`${scheduledDate}T00:00:00Z`)) ||
      Number.isNaN(Date.parse(`${expectedEndDate}T00:00:00Z`)) ||
      expectedEndDate < scheduledDate
    ) {
      return NextResponse.json(
        { error: 'تواريخ المأمورية غير صحيحة' },
        { status: 400 }
      )
    }

    if (scheduledDate < dateOnlyToday()) {
      return NextResponse.json(
        {
          error:
            'لا يمكن إصدار تكليف جديد بتاريخ سابق من V2. المأموريات بأثر رجعي تحتاج إجراءً إداريًا منفصلًا.',
          code: 'PAST_DATE_DENIED',
        },
        { status: 400 }
      )
    }

    const admin = getAdminSupabaseClient()
    const organizations = await loadOrganizations()
    const organizationFacts = buildOrganizationFacts(organizations)
    const organizationById = new Map(
      organizations.map((organization) => [organization.id, organization])
    )

    const [
      { data: facilities, error: facilitiesError },
      { data: users, error: usersError },
      { data: template, error: templateError },
    ] = await Promise.all([
      admin
        .from('facilities')
        .select(
          'id, name, facility_type, organization_id, sector_id, governorate, health_admin, village_city, is_active'
        )
        .in('id', facilityIds)
        .eq('is_active', true),
      admin
        .from('users')
        .select(
          'id, full_name, job_title, organization_id, sector_id, org_level, level, is_active'
        )
        .in('id', teamUserIds)
        .eq('is_active', true),
      admin
        .from('form_templates')
        .select(
          'id, name, version, description, created_by_org, applicable_sectors, applicable_levels, applicable_facility_types, is_base, is_active'
        )
        .eq('id', templateId)
        .eq('is_active', true)
        .maybeSingle(),
    ])

    if (facilitiesError || usersError || templateError) {
      console.error(
        '[v2-mission-assignment:POST] lookup failed:',
        facilitiesError?.message ||
          usersError?.message ||
          templateError?.message
      )
      return NextResponse.json(
        { error: 'تعذر التحقق من بيانات التكليف' },
        { status: 500 }
      )
    }

    const facilityRows = (facilities ?? []) as FacilityRow[]
    const userRows = (users ?? []) as UserRow[]

    if (facilityRows.length !== facilityIds.length) {
      return NextResponse.json(
        { error: 'توجد منشأة غير موجودة أو غير نشطة ضمن التكليف' },
        { status: 400 }
      )
    }

    if (userRows.length !== teamUserIds.length) {
      return NextResponse.json(
        { error: 'يوجد عضو فريق غير موجود أو غير نشط' },
        { status: 400 }
      )
    }

    if (!template) {
      return NextResponse.json(
        { error: 'نموذج المرور غير موجود أو غير نشط' },
        { status: 400 }
      )
    }

    for (const facility of facilityRows) {
      if (
        !resourceAllowed({
          user: gate.user,
          access: gate.access,
          permissionKey: 'missions.create',
          organizationFacts,
          organizationId: facility.organization_id,
          sectorId: facility.sector_id,
          governorate: facility.governorate,
        })
      ) {
        return NextResponse.json(
          {
            error: `المنشأة "${facility.name}" خارج نطاق إنشاء المأموريات المسموح لك به`,
            code: 'FACILITY_SCOPE_DENIED',
          },
          { status: 403 }
        )
      }
    }

    const executionEligibleIds = await loadExecutionEligibleUserIds()

    for (const candidate of userRows) {
      if (!executionEligibleIds.has(candidate.id)) {
        return NextResponse.json(
          {
            error: `المستخدم "${candidate.full_name}" غير مخول حاليًا لتنفيذ مأموريات ميدانية`,
            code: 'INSPECTOR_NOT_ELIGIBLE',
          },
          { status: 400 }
        )
      }

      if (!candidate.organization_id) {
        return NextResponse.json(
          {
            error: `المستخدم "${candidate.full_name}" بلا جهة تنظيمية موثوقة`,
            code: 'INSPECTOR_ORG_MISSING',
          },
          { status: 400 }
        )
      }

      const organization = organizationById.get(candidate.organization_id)
      if (
        !organization ||
        !resourceAllowed({
          user: gate.user,
          access: gate.access,
          permissionKey: 'missions.assign',
          organizationFacts,
          organizationId: candidate.organization_id,
          sectorId:
            candidate.sector_id ??
            organization.sector_id,
          governorate: organization.governorate,
        })
      ) {
        return NextResponse.json(
          {
            error: `لا يمكنك تكليف المستخدم "${candidate.full_name}" خارج نطاقك`,
            code: 'INSPECTOR_SCOPE_DENIED',
          },
          { status: 403 }
        )
      }
    }

    const templateRow = template as TemplateRow
    if (
      Array.isArray(templateRow.applicable_facility_types) &&
      templateRow.applicable_facility_types.length > 0
    ) {
      const incompatible = facilityRows.find(
        (facility) =>
          !templateRow.applicable_facility_types?.includes(
            facility.facility_type
          )
      )

      if (incompatible) {
        return NextResponse.json(
          {
            error: `نموذج المرور المحدد غير مخصص لنوع المنشأة "${incompatible.name}"`,
            code: 'TEMPLATE_FACILITY_TYPE_MISMATCH',
          },
          { status: 400 }
        )
      }
    }

    if (sourceTargetId) {
      const { data: target, error: targetError } = await admin
        .from('mission_targets')
        .select('id, status, start_date, end_date')
        .eq('id', sourceTargetId)
        .eq('status', 'active')
        .maybeSingle()

      if (targetError) {
        return NextResponse.json(
          { error: 'تعذر التحقق من المستهدف المرتبط' },
          { status: 500 }
        )
      }

      if (
        !target ||
        scheduledDate < String(target.start_date) ||
        scheduledDate > String(target.end_date)
      ) {
        return NextResponse.json(
          {
            error: 'المستهدف غير نشط أو تاريخ المأمورية خارج فترة المستهدف',
            code: 'TARGET_DATE_MISMATCH',
          },
          { status: 400 }
        )
      }
    }

    const initialStatus = hasV2Permission(
      gate.access,
      'missions.approve'
    )
      ? 'approved'
      : 'pending_approval'

    const { data: created, error: createError } = await admin.rpc(
      'create_v2_mission_assignment_batch',
      {
        p_actor_user_id: gate.user.profileId,
        p_actor_org_id: gate.user.organizationId,
        p_team_user_ids: teamUserIds,
        p_primary_user_id: primaryUserId,
        p_facility_ids: facilityIds,
        p_template_id: templateId,
        p_scheduled_date: scheduledDate,
        p_expected_end_date: expectedEndDate,
        p_priority: priority,
        p_visit_purpose: visitPurpose,
        p_notes: notes || null,
        p_requires_overnight: body.requires_overnight === true,
        p_requires_hotel_booking: body.requires_hotel_booking === true,
        p_status: initialStatus,
        p_source_target_id: sourceTargetId,
      }
    )

    if (createError) {
      console.error(
        '[v2-mission-assignment:POST] RPC failed:',
        createError.message
      )
      return NextResponse.json(
        { error: 'تعذر إصدار تكليف المأموريات' },
        { status: 500 }
      )
    }

    const rows = (created ?? []) as Array<{
      batch_id: string
      mission_id: string
      serial_number: string
      facility_id: string
    }>

    return NextResponse.json({
      success: true,
      batch_id: rows[0]?.batch_id ?? null,
      status: initialStatus,
      missions: rows,
      message:
        initialStatus === 'approved'
          ? `تم إصدار واعتماد ${rows.length} مأمورية بنجاح`
          : `تم إنشاء ${rows.length} مأمورية وإرسالها للاعتماد`,
    })
  } catch (error) {
    console.error('[v2-mission-assignment:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء إصدار التكليف' },
      { status: 500 }
    )
  }
}
