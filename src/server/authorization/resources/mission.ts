import 'server-only'

import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type { V2ResourceScopeContext } from '@/server/authorization/scope-types'

type MissionScopeRow = {
  id: string
  sector_id: string | null
  inspector_org_id: string | null
  created_by_org: string | null
  assigned_user_id: string | null
  primary_inspector_id: string | null
  created_by: string | null
}

type UserScopeRow = {
  id: string
  organization_id: string | null
  sector_id: string | null
}

type OrganizationScopeRow = {
  id: string
  governorate: string | null
}

export async function loadMissionResourceScope(
  missionId: string
): Promise<V2ResourceScopeContext | null> {
  const admin = getAdminSupabaseClient()

  const { data: mission, error } = await admin
    .from('missions')
    .select(
      'id, sector_id, inspector_org_id, created_by_org, assigned_user_id, primary_inspector_id, created_by'
    )
    .eq('id', missionId)
    .maybeSingle()

  if (error) {
    throw new Error(`[V2 Scope] Failed to load mission: ${error.message}`)
  }

  if (!mission) return null

  const row = mission as MissionScopeRow

  let creator: UserScopeRow | null = null
  if (row.created_by) {
    const { data: creatorData, error: creatorError } = await admin
      .from('users')
      .select('id, organization_id, sector_id')
      .eq('id', row.created_by)
      .maybeSingle()

    if (creatorError) {
      throw new Error(
        `[V2 Scope] Failed to load mission creator: ${creatorError.message}`
      )
    }

    creator = (creatorData as UserScopeRow | null) ?? null
  }

  const missionOrganizationId =
    row.inspector_org_id ??
    row.created_by_org ??
    creator?.organization_id ??
    null

  const missionSectorId =
    row.sector_id ??
    creator?.sector_id ??
    null

  let missionGovernorate: string | null = null
  if (missionOrganizationId) {
    const { data: organizationData, error: organizationError } = await admin
      .from('organizations')
      .select('id, governorate')
      .eq('id', missionOrganizationId)
      .maybeSingle()

    if (organizationError) {
      throw new Error(
        `[V2 Scope] Failed to load mission organization: ${organizationError.message}`
      )
    }

    missionGovernorate =
      (organizationData as OrganizationScopeRow | null)?.governorate ?? null
  }

  const assignedUserIds = [
    row.assigned_user_id,
    row.primary_inspector_id,
  ].filter((value): value is string => Boolean(value))

  return {
    ownerUserId: row.created_by,
    assignedUserIds: Array.from(new Set(assignedUserIds)),
    organizationId: missionOrganizationId,
    sectorId: missionSectorId,
    governorate: missionGovernorate,
  }
}
