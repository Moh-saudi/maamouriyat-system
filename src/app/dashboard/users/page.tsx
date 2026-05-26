import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { getDemoSessionEmail, getDemoSessionRole } from '@/lib/demo-session'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { UserPortal } from './user-portal'

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
}

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const demoEmail = await getDemoSessionEmail()
  const demoRole = await getDemoSessionRole()
  const supabase = await createServerSupabaseClient()

  // Attempt to load facilities dynamically
  let liveFacilities: any[] = []
  if (supabase) {
    const { data: facData } = await supabase
      .from('facilities')
      .select('id, name, address')
      .eq('is_active', true)
      .order('name')
    liveFacilities = facData ?? []
  }

  const defaultMockFacilities = [
    { id: 'demo-f1', name: 'مستشفى النيل العام', address: 'القاهرة' },
    { id: 'demo-f2', name: 'مركز صحة الأسرة النموذجي', address: 'الجيزة' },
    { id: 'demo-f3', name: 'مستشفى القاهرة الجديدة', address: 'التجمع' },
    { id: 'demo-f4', name: 'ديوان عام وزارة الصحة والسكان', address: 'العاصمة الإدارية' }
  ]
  const facilities = liveFacilities.length ? liveFacilities : defaultMockFacilities

  // --- DEMO MODE WORKFLOW PORTAL ---
  if (!supabase || demoEmail) {
    const store = await cookies()
    const rawDemoUsers = store.get('maamouriyat_demo_users')?.value
    let demoUsers: UserRow[] = []

    if (rawDemoUsers) {
      try {
        demoUsers = JSON.parse(decodeURIComponent(rawDemoUsers))
      } catch {}
    }

    const defaultDemoUsers = [
      { id: 'demo-u1', full_name: 'أحمد محمود', job_title: 'مدير عام المتابعة', level: 2, department: 'ديوان عام وزارة الصحة والسكان', is_active: true, email: 'admin@admin.com', phone: '01012345678', financial_code: 'FIN-100293', facility_id: 'demo-f4' },
      { id: 'demo-u2', full_name: 'سارة خالد', job_title: 'مفتش منشآت صحية', level: 7, department: 'إدارة مكافحة العدوى', is_active: true, email: 'inspector@inspector.com', phone: '01122334455', financial_code: 'FIN-200384' },
      { id: 'demo-u3', full_name: 'محمد علي', job_title: 'مشرف ميداني', level: 5, department: 'إدارة الصيدلة والمستلزمات', is_active: true, email: 'supervisor@supervisor.com', phone: '01234567890', financial_code: 'FIN-300482' },
    ]

    let currentUserLevel = 7
    if (demoRole === 'techadmin') currentUserLevel = 0
    else if (demoRole === 'superadmin') currentUserLevel = 1
    else if (demoRole === 'central') currentUserLevel = 2
    else if (demoRole === 'generalmanager') currentUserLevel = 3
    else if (demoRole === 'creator') currentUserLevel = 4
    else if (demoRole === 'financial') currentUserLevel = 5

    return (
      <DashboardShell role={demoRole} view="users">
        <UserPortal initialUsers={demoUsers.length ? demoUsers : defaultDemoUsers} demoMode={true} facilities={facilities} currentUserLevel={currentUserLevel} />
      </DashboardShell>
    )
  }

  // --- LIVE PRODUCTION MODE (SUPABASE) ---
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

  // Safe querying with dynamic column checks
  let usersResult: any = await supabase
    .from('users')
    .select('id, full_name, job_title, level, department, is_active, email, phone, facility_id, financial_code')
    .order('level')
    .order('full_name')
    .limit(300)

  if (usersResult.error && usersResult.error.code === '42703') {
    // Column undefined, fall back to safe core columns
    usersResult = await supabase
      .from('users')
      .select('id, full_name, job_title, level, department, is_active')
      .order('level')
      .order('full_name')
      .limit(300)
  }

  const users = (usersResult.data ?? []) as UserRow[]

  return (
    <DashboardShell view="users">
      <UserPortal initialUsers={users} demoMode={false} facilities={facilities} currentUserLevel={profile?.level ?? 7} />
    </DashboardShell>
  )
}
