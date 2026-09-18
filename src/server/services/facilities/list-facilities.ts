import 'server-only'

import { getAdminSupabaseClient } from '@/server/supabase/admin'
import { STANDARD_FACILITY_TYPES } from '@/lib/facility-types'

const DEFAULT_PAGE_SIZE = 30
const MAX_PAGE_SIZE = 60

export type V2FacilityStatusFilter = 'active' | 'inactive' | 'all'

export type V2FacilityListItem = {
  id: string
  name: string
  facilityType: string
  facilityTypeLabel: string
  governorate: string
  healthAdmin: string
  urbanRural: string | null
  villageCity: string | null
  latitude: number | null
  longitude: number | null
  isActive: boolean
}

export type V2FacilityFilterOptions = {
  governorates: string[]
  healthAdmins: string[]
  facilityTypes: string[]
}

export type V2FacilitiesPageResult = {
  items: V2FacilityListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  ministryTotal: number
  activeTotal: number
  governorateCount: number
  filters: V2FacilityFilterOptions
}

const FACILITY_TYPE_LABELS = new Map(
  STANDARD_FACILITY_TYPES.map((item) => [item.key, item.label])
)

function safeFacilityTypeLabel(value: string | null | undefined): string {
  if (!value) return 'منشأة صحية'

  const known = FACILITY_TYPE_LABELS.get(value)
  if (known) return known

  if (/[\u0600-\u06FF]/.test(value)) {
    return value
  }

  return 'منشأة صحية'
}

function sanitizeSearch(value: string): string {
  return value.replace(/[%_,()]/g, ' ').trim().slice(0, 100)
}

function normalizeFilter(value: string | null | undefined): string {
  return (value ?? '').trim().slice(0, 120)
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => value?.trim() ?? '')
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, 'ar'))
}

async function loadFilterOptions(input: {
  governorate: string
}): Promise<V2FacilityFilterOptions> {
  const admin = getAdminSupabaseClient()

  const [
    { data: governorateRows, error: governoratesError },
    { data: typeRows, error: typesError },
  ] = await Promise.all([
    admin
      .from('organizations')
      .select('governorate')
      .eq('level', 5)
      .eq('is_active', true)
      .not('governorate', 'is', null),
    admin
      .from('facilities')
      .select('facility_type')
      .eq('is_active', true)
      .limit(10000),
  ])

  if (governoratesError) {
    throw new Error(
      `[Facilities List] Failed to load governorates: ${governoratesError.message}`
    )
  }

  if (typesError) {
    throw new Error(
      `[Facilities List] Failed to load facility types: ${typesError.message}`
    )
  }

  const governorates = uniqueSorted(
    (governorateRows ?? []).map((row) =>
      typeof row.governorate === 'string' ? row.governorate : null
    )
  )

  let healthAdminQuery = admin
    .from('facilities')
    .select('health_admin')
    .eq('is_active', true)
    .not('health_admin', 'is', null)
    .limit(10000)

  if (input.governorate) {
    healthAdminQuery = healthAdminQuery.eq('governorate', input.governorate)
  }

  const { data: healthAdminRows, error: healthAdminsError } =
    await healthAdminQuery

  if (healthAdminsError) {
    throw new Error(
      `[Facilities List] Failed to load health administrations: ${healthAdminsError.message}`
    )
  }

  const healthAdmins = uniqueSorted(
    (healthAdminRows ?? []).map((row) =>
      typeof row.health_admin === 'string' ? row.health_admin : null
    )
  )

  const facilityTypes = [
    ...new Set(
      uniqueSorted(
        (typeRows ?? []).map((row) =>
          typeof row.facility_type === 'string' ? row.facility_type : null
        )
      ).map((value) => safeFacilityTypeLabel(value))
    ),
  ].sort((a, b) => a.localeCompare(b, 'ar'))

  return {
    governorates,
    healthAdmins,
    facilityTypes,
  }
}

export async function listV2Facilities(input: {
  page?: number
  pageSize?: number
  search?: string
  governorate?: string
  healthAdmin?: string
  facilityTypeLabel?: string
  status?: V2FacilityStatusFilter
}): Promise<V2FacilitiesPageResult> {
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE))
  )
  const offset = (page - 1) * pageSize

  const search = sanitizeSearch(input.search ?? '')
  const governorate = normalizeFilter(input.governorate)
  const healthAdmin = normalizeFilter(input.healthAdmin)
  const facilityTypeLabel = normalizeFilter(input.facilityTypeLabel)
  const facilityType =
    facilityTypeLabel
      ? STANDARD_FACILITY_TYPES.find(
          (item) => item.label === facilityTypeLabel
        )?.key ??
        (/[\u0600-\u06FF]/.test(facilityTypeLabel)
          ? facilityTypeLabel
          : '')
      : ''
  const status: V2FacilityStatusFilter =
    input.status === 'inactive' || input.status === 'all'
      ? input.status
      : 'active'

  const admin = getAdminSupabaseClient()

  let query = admin
    .from('facilities')
    .select(
      'id, name, facility_type, governorate, health_admin, urban_rural, village_city, latitude, longitude, is_active',
      { count: 'exact' }
    )
    .order('governorate', { ascending: true })
    .order('name', { ascending: true })
    .range(offset, offset + pageSize - 1)

  if (status === 'active') {
    query = query.eq('is_active', true)
  } else if (status === 'inactive') {
    query = query.eq('is_active', false)
  }

  if (governorate) {
    query = query.eq('governorate', governorate)
  }

  if (healthAdmin) {
    query = query.eq('health_admin', healthAdmin)
  }

  if (facilityType) {
    query = query.eq('facility_type', facilityType)
  }

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,health_admin.ilike.%${search}%,village_city.ilike.%${search}%`
    )
  }

  const [
    { data, error, count },
    { count: ministryTotal, error: ministryCountError },
    { count: activeTotal, error: activeCountError },
    filters,
  ] = await Promise.all([
    query,
    admin
      .from('facilities')
      .select('id', { count: 'exact', head: true }),
    admin
      .from('facilities')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    loadFilterOptions({ governorate }),
  ])

  if (error) {
    throw new Error(
      `[Facilities List] Failed to list facilities: ${error.message}`
    )
  }

  if (ministryCountError) {
    throw new Error(
      `[Facilities List] Failed to count facilities: ${ministryCountError.message}`
    )
  }

  if (activeCountError) {
    throw new Error(
      `[Facilities List] Failed to count active facilities: ${activeCountError.message}`
    )
  }

  const items: V2FacilityListItem[] = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name || 'منشأة صحية'),
    facilityType: String(row.facility_type || ''),
    facilityTypeLabel: safeFacilityTypeLabel(
      row.facility_type ? String(row.facility_type) : null
    ),
    governorate: String(row.governorate || 'غير محددة'),
    healthAdmin: String(row.health_admin || 'غير محددة'),
    urbanRural: row.urban_rural ? String(row.urban_rural) : null,
    villageCity: row.village_city ? String(row.village_city) : null,
    latitude:
      typeof row.latitude === 'number'
        ? row.latitude
        : row.latitude !== null && row.latitude !== undefined
          ? Number(row.latitude)
          : null,
    longitude:
      typeof row.longitude === 'number'
        ? row.longitude
        : row.longitude !== null && row.longitude !== undefined
          ? Number(row.longitude)
          : null,
    isActive: row.is_active === true,
  }))

  const total = count ?? 0

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    ministryTotal: ministryTotal ?? 0,
    activeTotal: activeTotal ?? 0,
    governorateCount: filters.governorates.length,
    filters,
  }
}
