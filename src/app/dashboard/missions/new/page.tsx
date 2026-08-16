import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { orgLevelToRole, canCreateMissions } from '@/lib/roles'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MissionCreateForm } from './mission-create-form'
import styles from './new-mission.module.css'

export const dynamic = 'force-dynamic'

export default async function NewMissionPage() {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    redirect('/login')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, org_level, sector_id, organization_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const userOrgLevel = profile.org_level ?? 7
  if (!canCreateMissions(userOrgLevel)) {
    redirect('/dashboard/missions')
  }

  const currentRole = orgLevelToRole(userOrgLevel)

  // 2. Fetch data in parallel (RLS will automatically scope results)
  const [employeesResult, facilitiesResult, orgsResult, templatesResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, job_title, org_level, organization_id, is_active')
      .eq('is_active', true)
      .order('org_level')
      .order('full_name'),
    supabase
      .from('facilities')
      .select('id, name, facility_type, governorate, health_admin, village_city, latitude, longitude, organization_id, sector_id')
      .eq('is_active', true)
      .order('name')
      .limit(4000),
    supabase
      .from('organizations')
      .select('id, name, level, level_label, governorate, health_admin, sector_id, code')
      .eq('is_active', true)
      .order('level')
      .order('name'),
    supabase
      .from('form_templates')
      .select('id, name, version, is_base')
      .eq('is_active', true)
  ])

  // Extract governorates uniquely
  const govMap = new Map<string, { id: string; name: string }>()
  for (const org of orgsResult.data ?? []) {
    if (org.level === 5 && org.governorate) {
      govMap.set(org.governorate, { id: org.id, name: org.governorate })
    }
  }

  const governorates = Array.from(govMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  return (
    <DashboardShell role={currentRole} view="missions">
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p>منظومة حوكمة المرور الميداني</p>
            <h1>تكليف بمأمورية جديدة</h1>
          </div>
          <span>تسكين المفتش والمنشأة الطبية المستهدفة والغرض المحوكم</span>
        </header>

        <MissionCreateForm
          currentUserId={profile.id}
          userOrgLevel={userOrgLevel}
          userSectorId={profile.sector_id}
          userOrgId={profile.organization_id}
          employees={employeesResult.data ?? []}
          facilities={facilitiesResult.data ?? []}
          governorates={governorates}
          organizations={orgsResult.data ?? []}
          orgUnits={orgsResult.data ?? []}
          templates={templatesResult.data ?? []}
        />
      </main>
    </DashboardShell>
  )
}
