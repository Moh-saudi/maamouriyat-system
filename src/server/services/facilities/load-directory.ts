import 'server-only'

import { getAdminSupabaseClient } from '@/server/supabase/admin'
import { STANDARD_FACILITY_TYPES } from '@/lib/facility-types'
import type {
  V2FacilityDirectoryData,
  V2FacilityDirectoryItem,
  V2HealthAdministrationOption,
} from '@/features/facilities/types'

const CHUNK_SIZE = 1000
const MAX_DIRECTORY_ROWS = 12000

type FacilityRow = {
  id: string
  name: string
  facility_type: string
  organization_id: string
  governorate: string
  health_admin: string
  urban_rural: string | null
  village_city: string | null
  latitude: number | string
  longitude: number | string
  is_active: boolean | null
  updated_at: string | null
}

type VisitStatRow = {
  facility_id: string
  completed_visits: number | string | null
  last_completed_visit_at: string | null
}

type HealthAdministrationRow = {
  id: string
  name: string
  governorate: string | null
  health_admin: string | null
}

const FACILITY_TYPE_LABELS = new Map(
  STANDARD_FACILITY_TYPES.map((item) => [item.key, item.label])
)

function facilityTypeLabel(value: string | null | undefined): string {
  if (!value) return 'منشأة صحية'

  const known = FACILITY_TYPE_LABELS.get(value)
  if (known) return known

  return /[\u0600-\u06FF]/.test(value) ? value : 'منشأة صحية'
}

async function loadAllFacilities(): Promise<FacilityRow[]> {
  const admin = getAdminSupabaseClient()
  const rows: FacilityRow[] = []

  for (let offset = 0; offset < MAX_DIRECTORY_ROWS; offset += CHUNK_SIZE) {
    const { data, error } = await admin
      .from('facilities')
      .select(
        'id, name, facility_type, organization_id, governorate, health_admin, urban_rural, village_city, latitude, longitude, is_active, updated_at'
      )
      .order('governorate', { ascending: true })
      .order('name', { ascending: true })
      .range(offset, offset + CHUNK_SIZE - 1)

    if (error) {
      throw new Error(
        `[Facilities Directory] Failed to load facilities: ${error.message}`
      )
    }

    const chunk = (data ?? []) as FacilityRow[]
    rows.push(...chunk)

    if (chunk.length < CHUNK_SIZE) break
  }

  if (rows.length >= MAX_DIRECTORY_ROWS) {
    throw new Error(
      '[Facilities Directory] Directory exceeded configured maximum row count.'
    )
  }

  return rows
}

async function loadVisitStats(): Promise<Map<string, VisitStatRow>> {
  const admin = getAdminSupabaseClient()
  const result = new Map<string, VisitStatRow>()

  for (let offset = 0; offset < MAX_DIRECTORY_ROWS; offset += CHUNK_SIZE) {
    const { data, error } = await admin
      .from('facility_visit_stats')
      .select('facility_id, completed_visits, last_completed_visit_at')
      .range(offset, offset + CHUNK_SIZE - 1)

    if (error) {
      throw new Error(
        `[Facilities Directory] Failed to load visit stats: ${error.message}`
      )
    }

    const chunk = (data ?? []) as VisitStatRow[]

    for (const row of chunk) {
      result.set(String(row.facility_id), row)
    }

    if (chunk.length < CHUNK_SIZE) break
  }

  return result
}

async function loadHealthAdministrations(): Promise<
  V2HealthAdministrationOption[]
> {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('organizations')
    .select('id, name, governorate, health_admin')
    .eq('level', 6)
    .eq('is_active', true)
    .order('governorate')
    .order('name')

  if (error) {
    throw new Error(
      `[Facilities Directory] Failed to load health administrations: ${error.message}`
    )
  }

  return ((data ?? []) as HealthAdministrationRow[])
    .filter((row) => Boolean(row.governorate))
    .map((row) => ({
      id: String(row.id),
      name:
        typeof row.health_admin === 'string' && row.health_admin.trim()
          ? row.health_admin.trim()
          : String(row.name),
      governorate: String(row.governorate),
    }))
}

export async function loadV2FacilityDirectory(): Promise<V2FacilityDirectoryData> {
  const [facilityRows, visitStats, healthAdministrations] = await Promise.all([
    loadAllFacilities(),
    loadVisitStats(),
    loadHealthAdministrations(),
  ])

  const facilities: V2FacilityDirectoryItem[] = facilityRows.map((row) => {
    const stats = visitStats.get(String(row.id))

    return {
      id: String(row.id),
      name: String(row.name || 'منشأة صحية'),
      facilityTypeLabel: facilityTypeLabel(row.facility_type),
      organizationId: String(row.organization_id),
      governorate: String(row.governorate || 'غير محددة'),
      healthAdmin: String(row.health_admin || 'غير محددة'),
      urbanRural: row.urban_rural ? String(row.urban_rural) : null,
      villageCity: row.village_city ? String(row.village_city) : null,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      isActive: row.is_active === true,
      visitCount: Number(stats?.completed_visits ?? 0),
      lastVisitAt: stats?.last_completed_visit_at ?? null,
      updatedAt: row.updated_at ?? null,
    }
  })

  const facilityTypes = [
    ...new Set(facilities.map((item) => item.facilityTypeLabel)),
  ].sort((a, b) => a.localeCompare(b, 'ar'))

  const governorateCount = new Set(
    facilities.map((item) => item.governorate).filter(Boolean)
  ).size

  return {
    facilities,
    healthAdministrations,
    facilityTypes,
    ministryTotal: facilities.length,
    activeTotal: facilities.filter((item) => item.isActive).length,
    governorateCount,
  }
}
