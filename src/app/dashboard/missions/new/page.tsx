import { redirect } from 'next/navigation'
import fs from 'fs'
import path from 'path'
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

  // 1. Fetch user profile and organization
  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, org_level, sector_id, organization_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const { data: userOrg } = profile.organization_id
    ? await supabase
        .from('organizations')
        .select('id, name, level, governorate, health_admin, sector_id')
        .eq('id', profile.organization_id)
        .maybeSingle()
    : { data: null }

  const userOrgLevel = profile.org_level ?? 7
  if (!canCreateMissions(userOrgLevel)) {
    redirect('/dashboard/missions')
  }

  const currentRole = orgLevelToRole(userOrgLevel)

  // 2. Fetch data in parallel
  const [employeesResult, facilitiesResult, orgsResult, templatesResult, missionsResult] = await Promise.all([
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
      .eq('is_active', true),
    supabase
      .from('missions')
      .select('id, target_facility_id, facility_id, status')
  ])

  // Extract governorates uniquely
  const govMap = new Map<string, { id: string; name: string }>()
  for (const org of orgsResult.data ?? []) {
    if (org.level === 5 && org.governorate) {
      govMap.set(org.governorate, { id: org.id, name: org.governorate })
    }
  }

  let governorates = Array.from(govMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  let scopedFacilities = facilitiesResult.data ?? []
  const userGov = userOrg?.governorate || (profile.full_name?.includes('القاهرة') ? 'القاهرة' : '')
  const userHealthAdmin = userOrg?.health_admin

  // HIERARCHY SCOPING:
  // If user is Level 5 (Directorate e.g. Cairo Directorate), ONLY show facilities in their governorate!
  // And lock governorates list to their governorate.
  if (userOrgLevel === 5 && userGov) {
    scopedFacilities = scopedFacilities.filter(f => (f.governorate || '').trim() === userGov.trim())
    const matchedGov = governorates.find(g => g.name === userGov)
    if (matchedGov) {
      governorates = [matchedGov]
    }
  } else if (userOrgLevel === 6) {
    // Health Admin level (e.g. Abnoub)
    if (userHealthAdmin) {
      scopedFacilities = scopedFacilities.filter(f => (f.health_admin || '').trim() === userHealthAdmin.trim())
    } else if (userGov) {
      scopedFacilities = scopedFacilities.filter(f => (f.governorate || '').trim() === userGov.trim())
    }
    if (userGov) {
      const matchedGov = governorates.find(g => g.name === userGov)
      if (matchedGov) governorates = [matchedGov]
    }
  }

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

  // Read active mission targets directly on the server for instant availability
  const targetsPath = path.join(process.cwd(), 'src', 'data', 'mission-targets.json')
  let initialTargets: any[] = []
  if (fs.existsSync(targetsPath)) {
    try {
      initialTargets = JSON.parse(fs.readFileSync(targetsPath, 'utf8')).filter((t: any) => t.status === 'active')
    } catch {}
  }

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
          userGovernorate={userGov}
          employees={employeesResult.data ?? []}
          facilities={scopedFacilities}
          governorates={governorates}
          organizations={orgsResult.data ?? []}
          orgUnits={orgsResult.data ?? []}
          templates={templatesResult.data ?? []}
          facilityVisitStats={facilityVisitStats}
          initialTargets={initialTargets}
        />
      </main>
    </DashboardShell>
  )
}
