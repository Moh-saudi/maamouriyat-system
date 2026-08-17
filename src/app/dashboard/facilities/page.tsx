import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { orgLevelToRole } from '@/lib/roles'
import { FacilitiesPortal } from './facilities-portal'

export const dynamic = 'force-dynamic'

async function fetchAllFacilities(supabase: any) {
  // Fetch in parallel chunks of 1000 to bypass Supabase PostgREST default max-rows limit
  const queries = [
    supabase.from('facilities').select(`
      id, name, facility_type, governorate, health_admin,
      urban_rural, village_city, latitude, longitude,
      population, land_area, building_area, year_built, year_renovated,
      is_active, organization_id, sector_id
    `).eq('is_active', true).order('governorate').order('name').range(0, 999),
    supabase.from('facilities').select(`
      id, name, facility_type, governorate, health_admin,
      urban_rural, village_city, latitude, longitude,
      population, land_area, building_area, year_built, year_renovated,
      is_active, organization_id, sector_id
    `).eq('is_active', true).order('governorate').order('name').range(1000, 1999),
    supabase.from('facilities').select(`
      id, name, facility_type, governorate, health_admin,
      urban_rural, village_city, latitude, longitude,
      population, land_area, building_area, year_built, year_renovated,
      is_active, organization_id, sector_id
    `).eq('is_active', true).order('governorate').order('name').range(2000, 2999),
    supabase.from('facilities').select(`
      id, name, facility_type, governorate, health_admin,
      urban_rural, village_city, latitude, longitude,
      population, land_area, building_area, year_built, year_renovated,
      is_active, organization_id, sector_id
    `).eq('is_active', true).order('governorate').order('name').range(3000, 3999),
  ]

  const results = await Promise.all(queries)
  const allFacilities: any[] = []
  for (const res of results) {
    if (res.data) allFacilities.push(...res.data)
  }
  return allFacilities
}

export default async function FacilitiesPage() {
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/login')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // جلب بيانات المستخدم الحالي مع org_level الجديد
  const { data: profile } = await supabase
    .from('users')
    .select('org_level, organization_id, sector_id, department, email')
    .eq('auth_id', user.id)
    .maybeSingle()

  const orgLevel = profile?.org_level ?? 7
  const role = orgLevelToRole(orgLevel)

  // Determine user's sector
  const userEmail = user.email || profile?.email || ''
  let userSectorId = profile?.sector_id || null
  if (!userSectorId) {
    if (orgLevel === 1 || userEmail.toLowerCase().includes('admin@')) {
      userSectorId = 'all' // مشرف عام ديوان الوزارة يرى كافة القطاعات
    } else if (userEmail.toLowerCase().includes('phc') || profile?.department?.includes('رعاية') || profile?.department?.includes('أسرة')) {
      userSectorId = '00000000-0000-0000-0000-000000000010'
    } else {
      userSectorId = '00000000-0000-0000-0000-000000000011'
    }
  }

  // جلب المنشآت والجهات والمستخدمين بالتوازي
  const [facilitiesData, orgsResult, usersResult] = await Promise.all([
    fetchAllFacilities(supabase),
    supabase
      .from('organizations')
      .select('id, name, level, level_label, governorate, health_admin, sector_id, code')
      .eq('is_active', true)
      .in('level', [5, 6])
      .order('level')
      .order('name'),
    supabase
      .from('users')
      .select('id, full_name, job_title, org_level, organization_id, is_active, department, email')
      .eq('is_active', true)
      .order('full_name')
      .limit(300)
  ])

  return (
    <DashboardShell role={role} view="facilities">
      <FacilitiesPortal
        initialFacilities={facilitiesData}
        initialOrganizations={orgsResult.data ?? []}
        initialUsers={usersResult.data ?? []}
        role={role}
        userOrgLevel={orgLevel}
        userSectorId={userSectorId}
        userEmail={userEmail}
      />
    </DashboardShell>
  )
}
