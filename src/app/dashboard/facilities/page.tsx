import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { orgLevelToRole } from '@/lib/roles'
import { realEgyptianSectors } from '@/lib/real-facilities'
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

  // حصر نطاق القطاع: قيادة الوزارة فقط (المستوى 1) ترى كافة القطاعات
  // رؤساء القطاعات (المستوى 2) وبقية المستويات محصورون بدقة في قطاعهم المحدد
  const userEmail = user.email || profile?.email || ''
  let userSectorId: string | null = null

  if (orgLevel === 1) {
    userSectorId = 'all'
  } else {
    // التحقق من قطاع المستخدم المسجل في جدول users
    const candidateSectorId = profile?.sector_id || profile?.organization_id
    const isValidSector = realEgyptianSectors.some(s => s.id === candidateSectorId)

    if (candidateSectorId && isValidSector) {
      userSectorId = candidateSectorId
    } else {
      // استنتاج القطاع بدقة من القسم أو البريد الإلكتروني في حال عدم تسجيله
      const dept = (profile?.department || '').toLowerCase()
      const em = userEmail.toLowerCase()
      if (dept.includes('علاجي') || em.includes('cur') || em.includes('treatment') || em.includes('sector.head')) {
        userSectorId = '00000000-0000-0000-0000-000000000011' // قطاع الطب العلاجي
      } else if (dept.includes('وقائي') || em.includes('prv') || em.includes('preventive')) {
        userSectorId = '00000000-0000-0000-0000-000000000012' // قطاع الصحة الوقائية
      } else if (dept.includes('تدريب') || em.includes('trn') || em.includes('training')) {
        userSectorId = '00000000-0000-0000-0000-000000000013' // قطاع التدريب
      } else if (dept.includes('حوكمة') || em.includes('gov') || em.includes('governance')) {
        userSectorId = '00000000-0000-0000-0000-000000000014' // قطاع الحوكمة
      } else {
        userSectorId = '00000000-0000-0000-0000-000000000010' // قطاع الرعاية الأولية وتنمية الأسرة
      }
    }
  }

  // جلب المنشآت والجهات والمستخدمين والمأموريات بالتوازي
  const [facilitiesData, orgsResult, usersResult, missionsResult] = await Promise.all([
    fetchAllFacilities(supabase),
    supabase
      .from('organizations')
      .select('id, name, level, level_label, governorate, health_admin, sector_id, code, parent_id')
      .eq('is_active', true)
      .order('level')
      .order('name'),
    supabase
      .from('users')
      .select('id, full_name, job_title, org_level, organization_id, is_active, department, email')
      .eq('is_active', true)
      .order('full_name')
      .limit(300),
    supabase
      .from('missions')
      .select('id, target_facility_id, facility_id, status')
  ])

  // Calculate visit stats dynamically for each facility
  const facilityVisitStats: Record<string, { visited: boolean; count: number }> = {}
  for (const m of missionsResult.data ?? []) {
    const fId = m.target_facility_id || (m as any).facility_id
    if (fId) {
      if (!facilityVisitStats[fId]) {
        facilityVisitStats[fId] = { visited: false, count: 0 }
      }
      facilityVisitStats[fId].count += 1
      if (m.status === 'completed' || m.status === 'منفذة') {
        facilityVisitStats[fId].visited = true
      }
    }
  }

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
        facilityVisitStats={facilityVisitStats}
      />
    </DashboardShell>
  )
}
