import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
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
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    redirect('/login')
  }

  let defaultAffiliations: FacilityAffiliationOption[] = [
    ...healthDirectorateAffiliations.map((name) => ({ name, affiliation_type: 'directorate' as const })),
    ...centralHealthAffiliations.map((name) => ({ name, affiliation_type: 'central_entity' as const })),
  ]

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

  // Fetch facilities, affiliations, and users in parallel to optimize latency
  const [facilitiesResult, affiliationsResult, usersResultRaw] = await Promise.all([
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
      .order('name'),
    supabase
      .from('users')
      .select('id, full_name, job_title, level, department, is_active')
      .order('level')
      .order('full_name')
      .limit(300)
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

  const liveUsers = usersResultRaw.data ?? []

  return (
    <DashboardShell view="facilities">
      <FacilitiesPortal
        initialFacilities={facilities}
        initialAffiliations={affiliations}
        facilityStoreReady={facilityStoreReady}
        role={resolvedRole}
        initialUsers={liveUsers}
      />
    </DashboardShell>
  )
}
