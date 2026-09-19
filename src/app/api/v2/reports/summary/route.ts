import { NextResponse } from 'next/server'
import {
  evaluateV2ResourceScope,
  hasV2Permission,
} from '@/server/authorization'
import { requireAnyV2Permission } from '@/server/authorization/http-guard'
import { loadV2OrganizationFacts } from '@/server/authorization/organization-scope-repository'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

function collectAuthorizationFactIds(input: {
  userOrganizationId: string | null
  roleAnchors: Array<string | null>
  resourceOrgIds: string[]
}) {
  const ids = new Set<string>(input.resourceOrgIds)
  if (input.userOrganizationId) ids.add(input.userOrganizationId)
  for (const anchor of input.roleAnchors) {
    if (anchor) ids.add(anchor)
  }
  return [...ids]
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

      const missionOrgIds = [
        ...new Set(
          (missions ?? [])
            .map((mission) =>
              facilityOrg.get(String(mission.facility_id))
            )
            .filter((value): value is string => Boolean(value))
        ),
      ]

      const missionFacts = await loadV2OrganizationFacts(
        collectAuthorizationFactIds({
          userOrganizationId: gate.user.organizationId,
          roleAnchors: gate.access.roles.map(
            (role) => role.assignmentOrganizationId
          ),
          resourceOrgIds: missionOrgIds,
        })
      )

      const visibleStatuses = (missions ?? [])
        .filter((mission) => {
          const orgId = facilityOrg.get(String(mission.facility_id))
          if (!orgId) return false
          const fact = missionFacts.get(orgId)
          if (!fact) return false

          return evaluateV2ResourceScope({
            user: gate.user,
            snapshot: gate.access,
            permissionKey: 'reports.missions_view',
            organizationFacts: missionFacts,
            resource: {
              organizationId: orgId,
              sectorId:
                fact.organizationTypeCode === 'sector'
                  ? fact.id
                  : fact.sectorId,
              governorate: fact.governorate,
            },
          }).allowed
        })
        .map((mission) => String(mission.status || 'draft'))

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

      const financeOrgIds = [
        ...new Set(
          (settlements ?? []).map((settlement) =>
            String(settlement.scope_org_id)
          )
        ),
      ]

      const financeFacts = await loadV2OrganizationFacts(
        collectAuthorizationFactIds({
          userOrganizationId: gate.user.organizationId,
          roleAnchors: gate.access.roles.map(
            (role) => role.assignmentOrganizationId
          ),
          resourceOrgIds: financeOrgIds,
        })
      )

      const visible = (settlements ?? [])
        .filter((settlement) => {
          const orgId = String(settlement.scope_org_id)
          const fact = financeFacts.get(orgId)
          if (!fact) return false

          return evaluateV2ResourceScope({
            user: gate.user,
            snapshot: gate.access,
            permissionKey: 'reports.finance_view',
            organizationFacts: financeFacts,
            resource: {
              organizationId: orgId,
              sectorId:
                fact.organizationTypeCode === 'sector'
                  ? fact.id
                  : fact.sectorId,
              governorate: fact.governorate,
            },
          }).allowed
        })
        .map((settlement) => ({
          status: String(settlement.status),
          total: Number(settlement.total_amount || 0),
        }))

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
