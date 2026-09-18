import 'server-only'

import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type { V2ResourceScopeContext } from '@/server/authorization/scope-types'

export type UserAuthorizationProfile = {
  id: string
  auth_id: string | null
  full_name: string
  email: string | null
  job_title: string | null
  level: number | null
  org_level: number | null
  organization_id: string | null
  org_unit_id: string | null
  sector_id: string | null
  is_active: boolean | null
  department?: string | null
  facility_id?: string | null
  phone?: string | null
  financial_code?: string | null
}

export async function loadUserAuthorizationResource(
  userId: string
): Promise<{
  profile: UserAuthorizationProfile
  resource: V2ResourceScopeContext
} | null> {
  const admin = getAdminSupabaseClient()

  const { data: profileData, error } = await admin
    .from('users')
    .select(
      'id, auth_id, full_name, email, job_title, level, org_level, organization_id, org_unit_id, sector_id, is_active, department, facility_id, phone, financial_code'
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`[V2 Scope] Failed to load user profile: ${error.message}`)
  }

  if (!profileData) return null

  const profile = profileData as UserAuthorizationProfile
  let governorate: string | null = null

  if (profile.organization_id) {
    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .select('governorate, sector_id, level')
      .eq('id', profile.organization_id)
      .maybeSingle()

    if (organizationError) {
      throw new Error(
        `[V2 Scope] Failed to load user organization: ${organizationError.message}`
      )
    }

    governorate = organization?.governorate ?? null

    if (!profile.sector_id) {
      profile.sector_id =
        organization?.level === 2
          ? profile.organization_id
          : organization?.sector_id ?? null
    }
  }

  return {
    profile,
    resource: {
      ownerUserId: profile.id,
      organizationId: profile.organization_id,
      sectorId: profile.sector_id,
      governorate,
    },
  }
}
