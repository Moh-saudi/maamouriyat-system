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
    .select('level')
    .eq('auth_id', user.id)
    .maybeSingle<{ level: number }>()

  if (!profile || profile.level > 4) {
    redirect('/dashboard')
  }

  // Attempt to load facilities dynamically
  let liveFacilities: any[] = []
  try {
    const { data: facData } = await supabase
      .from('facilities')
      .select('id, name, address')
      .eq('is_active', true)
      .order('name')
    liveFacilities = facData ?? []
  } catch {
    liveFacilities = []
  }

  // Combine live/local physical health facilities with real ministry departments
  const baseFacilities = liveFacilities.length ? liveFacilities : realEgyptianMedicalFacilities
  const facilities = [
    ...realEgyptianMinistryUnits.map(unit => ({
      id: unit.id,
      name: `ديوان عام الوزارة - ${unit.name}`,
      address: unit.level || 'ديوان عام الوزارة'
    })),
    ...baseFacilities.map(fac => ({
      id: fac.id,
      name: fac.name,
      address: fac.address || ''
    }))
  ]

  // Safe querying with dynamic column checks
  let usersResult: any = await supabase
    .from('users')
    .select('id, full_name, job_title, level, department, is_active, email, phone, facility_id, financial_code, created_at, org_unit_id')
    .order('level')
    .order('full_name')
    .limit(300)

  if (usersResult.error && usersResult.error.code === '42703') {
    // Column undefined, fall back to safe core columns
    usersResult = await supabase
      .from('users')
      .select('id, full_name, job_title, level, department, is_active, created_at')
      .order('level')
      .order('full_name')
      .limit(300)
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

  const users = (usersResult.data ?? []).map((u: any) => {
    const stats = missionStatsMap[u.id] || { assigned: 0, completed: 0, created: 0, approved: 0 }
    return {
      ...u,
      real_assigned_count: stats.assigned,
      real_completed_count: stats.completed,
      real_created_count: stats.created,
      real_approved_count: stats.approved
    }
  }) as UserRow[]

  return (
    <DashboardShell view="users">
      <UserPortal initialUsers={users} facilities={facilities} currentUserLevel={profile?.level ?? 7} />
    </DashboardShell>
  )
}

