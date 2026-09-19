import { NextResponse } from 'next/server'
import {
  evaluateV2ResourceScope,
  hasV2Permission,
} from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { loadV2OrganizationFacts } from '@/server/authorization/organization-scope-repository'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type FacilityRow = {
  id: string
  name: string
  facility_type: string
  organization_id: string
  sector_id: string | null
  governorate: string | null
  health_admin: string | null
  village_city: string | null
}

type ProgramRow = {
  id: string
  code: string
  name: string
  description: string | null
  program_type: string
  scope_organization_id: string | null
  is_active: boolean
  sort_order: number
}


const SUPABASE_PAGE_SIZE = 1000

async function loadAllActiveFacilities(): Promise<FacilityRow[]> {
  const admin = getAdminSupabaseClient()
  const rows: FacilityRow[] = []

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await admin
      .from('facilities')
      .select(
        'id, name, facility_type, organization_id, sector_id, governorate, health_admin, village_city'
      )
      .eq('is_active', true)
      .order('name')
      .order('id')
      .range(from, from + SUPABASE_PAGE_SIZE - 1)

    if (error) {
      throw new Error(
        `[facility-programs] failed to load facilities page: ${error.message}`
      )
    }

    const page = (data ?? []) as FacilityRow[]
    rows.push(...page)

    if (page.length < SUPABASE_PAGE_SIZE) break
  }

  return rows
}

async function loadActiveFacilityOrganizationsByIds(
  facilityIds: readonly string[]
): Promise<Array<{ id: string; organization_id: string }>> {
  const admin = getAdminSupabaseClient()
  const rows: Array<{ id: string; organization_id: string }> = []
  const chunkSize = 500

  for (let index = 0; index < facilityIds.length; index += chunkSize) {
    const chunk = facilityIds.slice(index, index + chunkSize)
    const { data, error } = await admin
      .from('facilities')
      .select('id, organization_id')
      .in('id', chunk)
      .eq('is_active', true)

    if (error) {
      throw new Error(
        `[facility-programs] failed to validate facility chunk: ${error.message}`
      )
    }

    rows.push(
      ...(data ?? []).map((row) => ({
        id: String(row.id),
        organization_id: String(row.organization_id),
      }))
    )
  }

  return rows
}

async function loadAllProgramFacilityLinks(): Promise<
  Array<{ program_id: string; facility_id: string }>
> {
  const admin = getAdminSupabaseClient()
  const rows: Array<{ program_id: string; facility_id: string }> = []

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await admin
      .from('facility_program_facilities')
      .select('program_id, facility_id')
      .order('program_id')
      .order('facility_id')
      .range(from, from + SUPABASE_PAGE_SIZE - 1)

    if (error) {
      throw new Error(
        `[facility-programs] failed to load program links page: ${error.message}`
      )
    }

    const page = (data ?? []).map((row) => ({
      program_id: String(row.program_id),
      facility_id: String(row.facility_id),
    }))
    rows.push(...page)

    if (page.length < SUPABASE_PAGE_SIZE) break
  }

  return rows
}

function hasNationalManage(
  access: Parameters<typeof hasV2Permission>[0]
): boolean {
  const permission = access.permissions['facility_programs.manage']
  return Boolean(
    permission?.granted &&
      permission.sources.some((source) => source.scopeType === 'national')
  )
}

async function loadFactsFor(
  gate: Extract<Awaited<ReturnType<typeof requireV2Permission>>, { ok: true }>,
  resourceOrganizationIds: string[]
) {
  const ids = new Set(resourceOrganizationIds)
  if (gate.user.organizationId) ids.add(gate.user.organizationId)

  for (const role of gate.access.roles) {
    if (role.assignmentOrganizationId) ids.add(role.assignmentOrganizationId)
  }

  return ids.size > 0
    ? loadV2OrganizationFacts([...ids])
    : new Map()
}

function organizationAllowed(input: {
  gate: Extract<Awaited<ReturnType<typeof requireV2Permission>>, { ok: true }>
  organizationId: string
  facts: Awaited<ReturnType<typeof loadV2OrganizationFacts>>
}) {
  const fact = input.facts.get(input.organizationId)
  if (!fact) return false

  return evaluateV2ResourceScope({
    user: input.gate.user,
    snapshot: input.gate.access,
    permissionKey: 'facility_programs.manage',
    organizationFacts: input.facts,
    resource: {
      organizationId: fact.id,
      sectorId:
        fact.organizationTypeCode === 'sector'
          ? fact.id
          : fact.sectorId,
      governorate: fact.governorate,
    },
  }).allowed
}

export async function GET() {
  try {
    const gate = await requireV2Permission('facility_programs.manage')
    if (!gate.ok) return gate.response

    const admin = getAdminSupabaseClient()

    const [
      { data: programRows, error: programsError },
      linkRows,
      facilities,
    ] = await Promise.all([
      admin
        .from('facility_programs')
        .select(
          'id, code, name, description, program_type, scope_organization_id, is_active, sort_order'
        )
        .order('sort_order')
        .order('name'),
      loadAllProgramFacilityLinks(),
      loadAllActiveFacilities(),
    ])

    if (programsError) {
      throw new Error(programsError.message)
    }

    const programs = (programRows ?? []) as ProgramRow[]
    const facts = await loadFactsFor(gate, [
      ...facilities.map((facility) => facility.organization_id),
      ...programs
        .map((program) => program.scope_organization_id)
        .filter((value): value is string => Boolean(value)),
    ])

    const national = hasNationalManage(gate.access)

    const manageableFacilities = facilities.filter((facility) =>
      organizationAllowed({
        gate,
        organizationId: facility.organization_id,
        facts,
      })
    )

    const manageableFacilityIds = new Set(
      manageableFacilities.map((facility) => facility.id)
    )

    const facilityIdsByProgram = new Map<string, string[]>()
    for (const link of linkRows) {
      const programId = String(link.program_id)
      const facilityId = String(link.facility_id)
      const current = facilityIdsByProgram.get(programId) ?? []
      current.push(facilityId)
      facilityIdsByProgram.set(programId, current)
    }

    const visiblePrograms = programs.filter((program) => {
      if (!program.scope_organization_id) return national
      return organizationAllowed({
        gate,
        organizationId: program.scope_organization_id,
        facts,
      })
    })

    return NextResponse.json({
      can_manage_national: national,
      programs: visiblePrograms.map((program) => {
        const allIds = facilityIdsByProgram.get(program.id) ?? []
        const visibleIds = allIds.filter((id) =>
          manageableFacilityIds.has(id)
        )

        return {
          ...program,
          facility_ids: visibleIds,
          facility_count: visibleIds.length,
          hidden_facility_count: allIds.length - visibleIds.length,
        }
      }),
      facilities: manageableFacilities,
    })
  } catch (error) {
    console.error('[facility-programs:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'تعذر تحميل برامج ومشروعات المنشآت' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('facility_programs.manage')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const action =
      body.action === 'set_facilities' ? 'set_facilities' : 'save_program'
    const admin = getAdminSupabaseClient()
    const national = hasNationalManage(gate.access)

    if (action === 'save_program') {
      const id = typeof body.id === 'string' ? body.id.trim() : ''
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const description =
        typeof body.description === 'string'
          ? body.description.trim().slice(0, 4000)
          : null
      const programType =
        body.program_type === 'initiative' ||
        body.program_type === 'project' ||
        body.program_type === 'campaign'
          ? body.program_type
          : 'program'
      const requestedScope =
        typeof body.scope_organization_id === 'string' &&
        body.scope_organization_id.trim()
          ? body.scope_organization_id.trim()
          : null

      if (!name) {
        return NextResponse.json(
          { error: 'اسم المشروع أو المبادرة مطلوب' },
          { status: 400 }
        )
      }

      let scopeOrganizationId = requestedScope

      if (!national && !scopeOrganizationId && !id) {
        scopeOrganizationId = gate.user.organizationId
      }

      if (!national && !scopeOrganizationId && !id) {
        return NextResponse.json(
          { error: 'يجب تحديد نطاق تنظيمي للمشروع' },
          { status: 400 }
        )
      }

      if (scopeOrganizationId) {
        const facts = await loadFactsFor(gate, [scopeOrganizationId])
        if (
          !organizationAllowed({
            gate,
            organizationId: scopeOrganizationId,
            facts,
          })
        ) {
          return NextResponse.json(
            { error: 'نطاق المشروع خارج صلاحياتك' },
            { status: 403 }
          )
        }
      }

      if (id) {
        const { data: current } = await admin
          .from('facility_programs')
          .select('id, scope_organization_id')
          .eq('id', id)
          .maybeSingle()

        if (!current) {
          return NextResponse.json(
            { error: 'المشروع غير موجود' },
            { status: 404 }
          )
        }

        if (!current.scope_organization_id && !national) {
          return NextResponse.json(
            { error: 'إدارة مشروع قومي تتطلب نطاقًا قوميًّا' },
            { status: 403 }
          )
        }

        if (!requestedScope) {
          scopeOrganizationId = current.scope_organization_id
        }

        if (scopeOrganizationId) {
          const updateFacts = await loadFactsFor(gate, [scopeOrganizationId])
          if (
            !organizationAllowed({
              gate,
              organizationId: scopeOrganizationId,
              facts: updateFacts,
            })
          ) {
            return NextResponse.json(
              { error: 'نطاق المشروع خارج صلاحياتك' },
              { status: 403 }
            )
          }
        }

        const { data, error } = await admin
          .from('facility_programs')
          .update({
            name,
            description: description || null,
            program_type: programType,
            scope_organization_id: scopeOrganizationId,
            is_active: body.is_active !== false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single()

        if (error) throw new Error(error.message)
        return NextResponse.json({ success: true, program: data })
      }

      const code =
        typeof body.code === 'string' && body.code.trim()
          ? body.code.trim().toUpperCase()
          : 'PROGRAM-' + Date.now().toString(36).toUpperCase()

      const { data, error } = await admin
        .from('facility_programs')
        .insert({
          code,
          name,
          description: description || null,
          program_type: programType,
          scope_organization_id: scopeOrganizationId,
          is_active: true,
          created_by: gate.user.profileId,
        })
        .select('*')
        .single()

      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true, program: data })
    }

    const programId =
      typeof body.program_id === 'string' ? body.program_id.trim() : ''
    const facilityIds = Array.isArray(body.facility_ids)
      ? [
          ...new Set(
            body.facility_ids.filter(
              (value): value is string => typeof value === 'string'
            )
          ),
        ]
      : []

    if (!programId) {
      return NextResponse.json(
        { error: 'معرف المشروع مطلوب' },
        { status: 400 }
      )
    }

    const { data: program } = await admin
      .from('facility_programs')
      .select('id, scope_organization_id')
      .eq('id', programId)
      .maybeSingle()

    if (!program) {
      return NextResponse.json(
        { error: 'المشروع غير موجود' },
        { status: 404 }
      )
    }

    if (!program.scope_organization_id && !national) {
      return NextResponse.json(
        { error: 'تعديل منشآت مشروع قومي يتطلب نطاقًا قوميًّا' },
        { status: 403 }
      )
    }

    if (facilityIds.length > 0) {
      const rows = await loadActiveFacilityOrganizationsByIds(facilityIds)

      if (rows.length !== facilityIds.length) {
        return NextResponse.json(
          { error: 'توجد منشأة غير صحيحة ضمن الاختيار' },
          { status: 400 }
        )
      }

      const facts = await loadFactsFor(
        gate,
        rows.map((row) => row.organization_id)
      )

      for (const row of rows) {
        if (
          !organizationAllowed({
            gate,
            organizationId: row.organization_id,
            facts,
          })
        ) {
          return NextResponse.json(
            { error: 'إحدى المنشآت المختارة خارج نطاقك' },
            { status: 403 }
          )
        }
      }
    }

    const { error: replaceError } = await admin.rpc(
      'replace_facility_program_facilities',
      {
        p_program_id: programId,
        p_facility_ids: facilityIds,
      }
    )

    if (replaceError) {
      throw new Error(replaceError.message)
    }

    return NextResponse.json({
      success: true,
      facility_count: facilityIds.length,
    })
  } catch (error) {
    console.error('[facility-programs:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'تعذر حفظ برنامج المنشآت' },
      { status: 500 }
    )
  }
}
