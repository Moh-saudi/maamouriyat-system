import { NextResponse } from 'next/server'
import {
  checkV2ResourceAccess,
  hasV2Permission,
} from '@/server/authorization'
import { requireAnyV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type OrgScopeRow = {
  id: string
  sector_id: string | null
  governorate: string | null
  organization_type_code: string | null
}

async function loadOrgScope(orgId: string): Promise<OrgScopeRow | null> {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('organizations')
    .select('id, sector_id, governorate, organization_type_code')
    .eq('id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load report organization scope: ${error.message}`)
  }

  return (data as OrgScopeRow | null) ?? null
}

async function allowedForOrg(input: {
  orgId: string
  permissionKey: string
  gate: Extract<
    Awaited<ReturnType<typeof requireAnyV2Permission>>,
    { ok: true }
  >
}) {
  const org = await loadOrgScope(input.orgId)
  if (!org) return false

  const decision = await checkV2ResourceAccess({
    user: input.gate.user,
    snapshot: input.gate.access,
    permissionKey: input.permissionKey,
    resource: {
      organizationId: org.id,
      sectorId:
        org.organization_type_code === 'sector'
          ? org.id
          : org.sector_id,
      governorate: org.governorate,
    },
  })

  return decision.allowed
}

export async function GET() {
  try {
    const gate = await requireAnyV2Permission([
      'reports.missions_view',
      'reports.finance_view',
    ])
    if (!gate.ok) return gate.response

    const admin = getAdminSupabaseClient()
    const canMissionReport = hasV2Permission(
      gate.access,
      'reports.missions_view'
    )
    const canFinanceReport = hasV2Permission(
      gate.access,
      'reports.finance_view'
    )

    let missionSummary:
      | {
          total: number
          pending_approval: number
          approved: number
          in_progress: number
          completed: number
          closed: number
          rejected: number
        }
      | null = null

    if (canMissionReport) {
      const { data: missions, error: missionsError } = await admin
        .from('missions')
        .select('id, status, facility_id')
        .order('created_at', { ascending: false })
        .limit(3000)

      if (missionsError) {
        throw new Error(missionsError.message)
      }

      const facilityIds = [
        ...new Set((missions ?? []).map((row) => String(row.facility_id))),
      ]

      const { data: facilities, error: facilitiesError } = facilityIds.length
        ? await admin
            .from('facilities')
            .select('id, organization_id')
            .in('id', facilityIds)
        : { data: [], error: null }

      if (facilitiesError) {
        throw new Error(facilitiesError.message)
      }

      const facilityOrg = new Map(
        (facilities ?? []).map((row) => [
          String(row.id),
          String(row.organization_id),
        ])
      )

      const visibleStatuses: string[] = []

      for (const mission of missions ?? []) {
        const orgId = facilityOrg.get(String(mission.facility_id))
        if (!orgId) continue

        if (
          await allowedForOrg({
            orgId,
            permissionKey: 'reports.missions_view',
            gate,
          })
        ) {
          visibleStatuses.push(String(mission.status || 'draft'))
        }
      }

      missionSummary = {
        total: visibleStatuses.length,
        pending_approval: visibleStatuses.filter(
          (status) => status === 'pending_approval'
        ).length,
        approved: visibleStatuses.filter((status) => status === 'approved')
          .length,
        in_progress: visibleStatuses.filter(
          (status) => status === 'in_progress'
        ).length,
        completed: visibleStatuses.filter((status) => status === 'completed')
          .length,
        closed: visibleStatuses.filter((status) => status === 'closed').length,
        rejected: visibleStatuses.filter((status) => status === 'rejected')
          .length,
      }
    }

    let financeSummary:
      | {
          count: number
          pending_review: number
          prepared: number
          approved_amount: number
          paid_amount: number
          rejected: number
        }
      | null = null

    if (canFinanceReport) {
      const { data: settlements, error: settlementsError } = await admin
        .from('mission_financial_settlements')
        .select('id, scope_org_id, status, total_amount')
        .order('created_at', { ascending: false })
        .limit(3000)

      if (settlementsError) {
        throw new Error(settlementsError.message)
      }

      const visible: Array<{ status: string; total: number }> = []

      for (const settlement of settlements ?? []) {
        if (
          await allowedForOrg({
            orgId: String(settlement.scope_org_id),
            permissionKey: 'reports.finance_view',
            gate,
          })
        ) {
          visible.push({
            status: String(settlement.status),
            total: Number(settlement.total_amount || 0),
          })
        }
      }

      financeSummary = {
        count: visible.length,
        pending_review: visible.filter(
          (row) => row.status === 'pending_review'
        ).length,
        prepared: visible.filter((row) => row.status === 'prepared').length,
        approved_amount: visible
          .filter((row) => row.status === 'approved')
          .reduce((sum, row) => sum + row.total, 0),
        paid_amount: visible
          .filter((row) => row.status === 'paid')
          .reduce((sum, row) => sum + row.total, 0),
        rejected: visible.filter((row) => row.status === 'rejected').length,
      }
    }

    return NextResponse.json({
      mission_report: missionSummary,
      finance_report: financeSummary,
    })
  } catch (error) {
    console.error('[reports:summary] unexpected error:', error)
    return NextResponse.json(
      { error: 'تعذر تحميل ملخص التقارير' },
      { status: 500 }
    )
  }
}
