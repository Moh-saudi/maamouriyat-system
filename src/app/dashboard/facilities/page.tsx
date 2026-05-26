import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { getDemoSessionEmail, getDemoSessionRole } from '@/lib/demo-session'
import {
  centralHealthAffiliations,
  healthDirectorateAffiliations,
  type FacilityAffiliationOption
} from '@/lib/facility-affiliations'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { FacilitiesPortal } from './facilities-portal'

type FacilityRow = {
  id: string
  name: string
  facility_type: string
  address: string
  is_active: boolean | null
  latitude?: number
  longitude?: number
  governorates: { name: string } | null
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

// 51 Real Egyptian Medical Facilities (34 Hospitals, 10 Family Health Centers, 7 Supply Warehouses)
import { realEgyptianMedicalFacilities } from '@/lib/real-facilities'

export const dynamic = 'force-dynamic'

export default async function FacilitiesPage() {
  const demoEmail = await getDemoSessionEmail()
  const demoRole = await getDemoSessionRole()
  const supabase = await createServerSupabaseClient()

  let defaultAffiliations: FacilityAffiliationOption[] = [
    ...healthDirectorateAffiliations.map((name) => ({ name, affiliation_type: 'directorate' as const })),
    ...centralHealthAffiliations.map((name) => ({ name, affiliation_type: 'central_entity' as const })),
  ]

  // Demo / local testing view (no active Supabase connection or demo session active)
  if (!supabase || demoEmail) {
    return (
      <DashboardShell role={demoRole} view="facilities">
        <FacilitiesPortal
          initialFacilities={realEgyptianMedicalFacilities}
          initialAffiliations={defaultAffiliations}
          facilityStoreReady={false}
          role={demoRole}
        />
      </DashboardShell>
    )
  }

  // Live Supabase integration
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('level')
    .eq('auth_id', user.id)
    .maybeSingle<{ level: number }>()

  const userLevel = profile?.level ?? 7
  const resolvedRole = userLevel === 0 ? 'techadmin' : userLevel === 1 ? 'superadmin' : userLevel === 2 ? 'central' : userLevel === 3 ? 'generalmanager' : userLevel === 4 ? 'creator' : userLevel === 5 ? 'financial' : 'inspector'

  // Fetch facilities and affiliations in parallel to optimize latency
  const [facilitiesResult, affiliationsResult] = await Promise.all([
    supabase
      .from('facilities')
      .select(`
        id,
        name,
        facility_type,
        address,
        is_active,
        latitude,
        longitude,
        governorates:governorate_id(name)
      `)
      .order('name')
      .limit(1000),
    supabase
      .from('facility_affiliations')
      .select('id, name, affiliation_type')
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
  ])

  // Process facilities list
  let facilities = ((facilitiesResult.data ?? []) as any).map((row: any) => ({
    ...row,
    governorates: normalizeRelation(row.governorates),
  }))

  // If DB is empty, use the real MOHP medical facilities
  if (facilities.length === 0) {
    facilities = realEgyptianMedicalFacilities
  } else {
    // If facilities are in DB but don't have lat/lon, map them or merge with our real ones
    facilities = facilities.map((f: any) => {
      const match = realEgyptianMedicalFacilities.find(real => real.name === f.name)
      return {
        ...f,
        latitude: f.latitude ?? match?.latitude ?? 30.0444, // Default to Cairo center
        longitude: f.longitude ?? match?.longitude ?? 31.2357
      }
    })
  }

  // Process affiliations list
  let affiliations = defaultAffiliations
  let facilityStoreReady = false

  if (!affiliationsResult.error && affiliationsResult.data?.length) {
    affiliations = affiliationsResult.data as FacilityAffiliationOption[]
    facilityStoreReady = true
  }

  return (
    <DashboardShell view="facilities">
      <FacilitiesPortal
        initialFacilities={facilities}
        initialAffiliations={affiliations}
        facilityStoreReady={facilityStoreReady}
        role={resolvedRole}
      />
    </DashboardShell>
  )
}
