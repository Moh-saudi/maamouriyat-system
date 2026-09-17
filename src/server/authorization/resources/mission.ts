import 'server-only'

import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type { V2ResourceScopeContext } from '@/server/authorization/scope-types'

type MissionScopeRow = {
  id: string
  facility_id: string | null
  target_facility_id: string | null
  sector_id: string | null
  inspector_org_id: string | null
  created_by_org: string | null
  assigned_user_id: string | null
  primary_inspector_id: string | null
  created_by: string | null
}

type FacilityScopeRow = {
  id: string
  organization_id: string | null
  sector_id: string | null
  governorate: string | null
}

export async function loadMissionResourceScope(
  missionId: string
): Promise<V2ResourceScopeContext | null> {
  const admin = getAdminSupabaseClient()

  const { data: mission, error } = await admin
    .from('missions')
    .select(
      'id, facility_id, target_facility_id, sector_id, inspector_org_id, created_by_org, assigned_user_id, primary_inspector_id, created_by'
    )
    .eq('id', missionId)
    .maybeSingle()

  if (error) {
    throw new Error(`[V2 Scope] Failed to load mission: ${error.message}`)
  }

  if (!mission) return null

  const row = mission as MissionScopeRow
  const facilityId = row.target_facility_id ?? row.facility_id
  let facility: FacilityScopeRow | null = null

  if (facilityId) {
    const { data: facilityData, error: facilityError } = await admin
      .from('facilities')
      .select('id, organization_id, sector_id, governorate')
      .eq('id', facilityId)
      .maybeSingle()

    if (facilityError) {
      throw new Error(
        `[V2 Scope] Failed to load mission facility: ${facilityError.message}`
      )
    }

    facility = (facilityData as FacilityScopeRow | null) ?? null
  }

  const assignedUserIds = [
    row.assigned_user_id,
    row.primary_inspector_id,
  ].filter((value): value is string => Boolean(value))

  return {
    ownerUserId: row.created_by,
    assignedUserIds: [...new Set(assignedUserIds)],
    organizationId:
      facility?.organization_id ?? row.inspector_org_id ?? row.created_by_org,
    sectorId: row.sector_id ?? facility?.sector_id ?? null,
    governorate: facility?.governorate ?? null,
  }
}
