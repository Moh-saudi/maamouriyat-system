import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { orgLevelToRole } from '@/lib/roles'
import { realEgyptianSectors } from '@/lib/real-facilities'
import { OrganizationsTablePortal } from './organizations-table-portal'

export const dynamic = 'force-dynamic'

export default async function OrganizationsPage() {
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/login')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // جلب بيانات المستخدم الحالي مع org_level والقطاع
  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, org_level, organization_id, sector_id, department, email')
    .eq('auth_id', user.id)
    .maybeSingle()

  const orgLevel = profile?.org_level ?? 7
  const role = orgLevelToRole(orgLevel)

  // جلب بيانات جهة المستخدم المسكن عليها
  const { data: userOrg } = profile?.organization_id
    ? await supabase
        .from('organizations')
        .select('id, name, level, level_label, governorate, health_admin, sector_id')
        .eq('id', profile.organization_id)
        .maybeSingle()
    : { data: null }

  // استنتاج المحافظة والإدارة الصحية للمستويين 5 و 6
  let userGov = userOrg?.governorate || null
  let userHealthAdmin = userOrg?.health_admin || null

  if (!userGov && profile?.department) {
    for (const g of [
      'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'البحيرة', 'بورسعيد',
      'الإسماعيلية', 'السويس', 'الغربية', 'المنوفية', 'الدقهلية', 'الشرقية',
      'كفر الشيخ', 'دمياط', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط',
      'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد',
      'مطروح', 'شمال سيناء', 'جنوب سيناء'
    ]) {
      if (profile.department.includes(g) || (profile.full_name && profile.full_name.includes(g))) {
        userGov = g
        break
      }
    }
  }

  // حظر أمني وحصر نطاق القطاع:
  // المستوى 1 فقط (قيادة الوزارة) يرى كافة القطاعات
  // المستوى 2 (رؤساء القطاعات) وبقية المستويات محصورون بدقة في قطاعهم
  const userEmail = user.email || profile?.email || ''
  let userSectorId: string | null = null

  if (orgLevel === 1) {
    userSectorId = 'all'
  } else {
    const candidateSectorId = profile?.sector_id || profile?.organization_id
    const isValidSector = realEgyptianSectors.some(s => s.id === candidateSectorId)

    if (candidateSectorId && isValidSector) {
      userSectorId = candidateSectorId
    } else {
      const dept = (profile?.department || '').toLowerCase()
      const em = userEmail.toLowerCase()
      if (dept.includes('علاجي') || em.includes('cur') || em.includes('treatment') || em.includes('sector.head')) {
        userSectorId = '00000000-0000-0000-0000-000000000011'
      } else if (dept.includes('وقائي') || em.includes('prv') || em.includes('preventive')) {
        userSectorId = '00000000-0000-0000-0000-000000000012'
      } else if (dept.includes('تدريب') || em.includes('trn') || em.includes('training')) {
        userSectorId = '00000000-0000-0000-0000-000000000013'
      } else if (dept.includes('حوكمة') || em.includes('gov') || em.includes('governance')) {
        userSectorId = '00000000-0000-0000-0000-000000000014'
      } else {
        userSectorId = '00000000-0000-0000-0000-000000000010'
      }
    }
  }

  // استعلام المنشآت والجهات والمستخدمين بالتوازي
  const [orgsResult, usersResult, missionsResult, facilitiesResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, level, level_label, governorate, health_admin, sector_id, code, parent_id, is_active, created_at')
      .eq('is_active', true)
      .order('level')
      .order('name'),
    supabase
      .from('users')
      .select('id, full_name, job_title, org_level, organization_id, is_active, department, email')
      .eq('is_active', true)
      .limit(500),
    supabase
      .from('missions')
      .select('id, target_facility_id, facility_id, status'),
    (orgLevel === 5 || orgLevel === 6)
      ? supabase
          .from('facilities')
          .select('id, name, facility_type, governorate, health_admin, village_city, is_active, organization_id, sector_id')
          .eq('is_active', true)
          .order('name')
          .limit(2000)
      : Promise.resolve({ data: [] })
  ])

  // فلترة المنشآت المحلية للمستويات الميدانية بدقة
  let scopedFacilities = facilitiesResult.data ?? []
  if (orgLevel === 5 && userGov) {
    scopedFacilities = scopedFacilities.filter(f => (f.governorate || '').trim() === userGov.trim())
  } else if (orgLevel === 6) {
    if (userHealthAdmin) {
      scopedFacilities = scopedFacilities.filter(f => (f.health_admin || '').trim() === userHealthAdmin.trim())
    } else if (userGov) {
      scopedFacilities = scopedFacilities.filter(f => (f.governorate || '').trim() === userGov.trim())
    }
  }

  return (
    <DashboardShell role={role}>
      <OrganizationsTablePortal
        role={role}
        userOrgLevel={orgLevel}
        userSectorId={userSectorId}
        userEmail={userEmail}
        userGovernorate={userGov}
        userHealthAdmin={userHealthAdmin}
        initialOrganizations={orgsResult.data ?? []}
        initialUsers={usersResult.data ?? []}
        initialFacilities={scopedFacilities}
        missionsCount={missionsResult.data?.length ?? 0}
      />
    </DashboardShell>
  )
}
