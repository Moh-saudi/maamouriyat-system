import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { UserPortal } from './user-portal'
import { realEgyptianMedicalFacilities, realEgyptianMinistryUnits } from '@/lib/real-facilities'

type UserRow = {
  id: string
  full_name: string
  job_title: string | null
  level: number
  department: string | null
  is_active: boolean | null
  email?: string | null
  phone?: string | null
  facility_id?: string | null
  financial_code?: string | null
  created_at?: string | null
  real_assigned_count?: number
  real_completed_count?: number
  real_created_count?: number
  real_approved_count?: number
}

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
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

  const { data: profile } = await supabase
    .from('users')
    .select('id, level, org_level, sector_id, organization_id, job_title')
    .eq('auth_id', user.id)
    .maybeSingle<{ id: string; level: number; org_level: number; sector_id: string | null; organization_id: string | null; job_title: string | null }>()

  const callerLevel = profile?.level ?? profile?.org_level ?? 7

  if (!profile || callerLevel > 4) {
    redirect('/dashboard')
  }

  const { orgLevelToRole } = await import('@/lib/roles')
  const currentRole = orgLevelToRole(callerLevel, profile?.job_title)
  const callerSectorId = profile?.sector_id || profile?.organization_id

  // 1. Load active facilities
  let liveFacilities: any[] = []
  try {
    const { data: facData } = await supabase
      .from('facilities')
      .select('id, name, facility_type, governorate, health_admin, village_city, organization_id, sector_id')
      .eq('is_active', true)
      .order('name')
      .limit(4000)
    liveFacilities = facData ?? []
  } catch {
    liveFacilities = []
  }

  // 2. Load active organizations (Ministry, Sectors, Directorates, Health Administrations)
  let liveOrganizations: any[] = []
  try {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id, name, level, level_label, governorate, health_admin, sector_id, code')
      .eq('is_active', true)
      .order('level')
      .order('name')
    liveOrganizations = orgData ?? []
  } catch {
    liveOrganizations = []
  }

  const facilities = liveFacilities.length ? liveFacilities : realEgyptianMedicalFacilities

  // 3. Safe querying users with full organizational and facility links
  let usersResult: any = await supabase
    .from('users')
    .select('id, full_name, job_title, level, org_level, department, is_active, email, phone, facility_id, financial_code, created_at, organization_id, sector_id, org_unit_id')
    .order('level')
    .order('full_name')
    .limit(500)

  if (usersResult.error && usersResult.error.code === '42703') {
    usersResult = await supabase
      .from('users')
      .select('id, full_name, job_title, level, department, is_active, created_at')
      .order('level')
      .order('full_name')
      .limit(500)
  }

  // Fetch all missions to aggregate real counts per user
  const { data: missionsData } = await supabase
    .from('missions')
    .select('assigned_user_id, created_by, approved_by, status')

  const missionStatsMap: Record<string, { assigned: number; completed: number; created: number; approved: number }> = {}

  if (missionsData) {
    missionsData.forEach(m => {
      if (m.assigned_user_id) {
        if (!missionStatsMap[m.assigned_user_id]) {
          missionStatsMap[m.assigned_user_id] = { assigned: 0, completed: 0, created: 0, approved: 0 }
        }
        if (m.status === 'completed') {
          missionStatsMap[m.assigned_user_id].completed++
        } else {
          missionStatsMap[m.assigned_user_id].assigned++
        }
      }
      if (m.created_by) {
        if (!missionStatsMap[m.created_by]) {
          missionStatsMap[m.created_by] = { assigned: 0, completed: 0, created: 0, approved: 0 }
        }
        missionStatsMap[m.created_by].created++
      }
      if (m.approved_by) {
        if (!missionStatsMap[m.approved_by]) {
          missionStatsMap[m.approved_by] = { assigned: 0, completed: 0, created: 0, approved: 0 }
        }
        missionStatsMap[m.approved_by].approved++
      }
    })
  }

  let allUsers = (usersResult.data ?? []).map((u: any) => {
    const stats = missionStatsMap[u.id] || { assigned: 0, completed: 0, created: 0, approved: 0 }
    return {
      ...u,
      real_assigned_count: stats.assigned,
      real_completed_count: stats.completed,
      real_created_count: stats.created,
      real_approved_count: stats.approved
    }
  }) as UserRow[]

  // Strict Sector Scoping: Level 2..4 only see users and organizations belonging to their sector
  let scopedUsers = allUsers
  let scopedOrganizations = liveOrganizations
  let scopedFacilities = facilities

  if (callerLevel > 1 && callerSectorId) {
    scopedUsers = allUsers.filter((u: any) => 
      u.sector_id === callerSectorId || 
      u.organization_id === callerSectorId || 
      u.id === profile?.id
    )
    scopedOrganizations = liveOrganizations.filter((o: any) => 
      o.sector_id === callerSectorId || 
      o.id === callerSectorId
    )
    scopedFacilities = facilities.filter((f: any) => 
      f.sector_id === callerSectorId || 
      f.organization_id === callerSectorId
    )
  }

  return (
    <DashboardShell role={currentRole} view="users">
      <UserPortal 
        initialUsers={scopedUsers} 
        facilities={scopedFacilities} 
        organizations={scopedOrganizations} 
        currentUserLevel={callerLevel} 
      />
    </DashboardShell>
  )
}

