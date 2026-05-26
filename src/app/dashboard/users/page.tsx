import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { getDemoSessionEmail, getDemoSessionRole } from '@/lib/demo-session'
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
      { id: 'demo-u4', full_name: 'المهندس عمرو عبد العزيز', job_title: 'مدير الإدارة التقنية والدعم الفني', level: 0, department: 'الإدارة العامة لنظم المعلومات والتحول الرقمي', is_active: true, email: 'techadmin@mohp.gov.eg', phone: '01222222222', financial_code: 'FIN-000001', facility_id: 'demo-f4' },
      { id: 'demo-u1', full_name: 'أحمد محمود العشري', job_title: 'مدير عام المتابعة والرقابة', level: 1, department: 'ديوان عام وزارة الصحة والسكان', is_active: true, email: 'admin@admin.com', phone: '01012345678', financial_code: 'FIN-100293', facility_id: 'demo-f4' },
      { id: 'demo-u8', full_name: 'د. أحمد عبد الرحمن', job_title: 'رئيس إدارة مركزية للطب العلاجي', level: 2, department: 'الإدارة المركزية للشئون العلاجية', is_active: true, email: 'director@director.com', phone: '01020020020', financial_code: 'FIN-200100', facility_id: 'demo-f4' },
      { id: 'demo-u5', full_name: 'د. ميرفت أحمد الجندي', job_title: 'مدير عام المستشفيات العلاجية', level: 3, department: 'الإدارة العامة للمستشفيات', is_active: true, email: 'generalmanager@mohp.gov.eg', phone: '01033333333', financial_code: 'FIN-300100', facility_id: 'demo-f4' },
      { id: 'demo-u3', full_name: 'محمد علي سليم', job_title: 'مشرف ميداني ومتابع تشغيل', level: 3, department: 'إدارة الصيدلة والمستلزمات', is_active: true, email: 'supervisor@supervisor.com', phone: '01234567890', financial_code: 'FIN-300482' },
      { id: 'demo-u6', full_name: 'د. ياسر جلال المنشاوي', job_title: 'موظف تكليف وتشغيل ميداني', level: 4, department: 'قسم التشغيل والتكليف', is_active: true, email: 'creator@mohp.gov.eg', phone: '01044444444', financial_code: 'FIN-400100' },
      { id: 'demo-u7', full_name: 'أ. طارق عبد الحميد', job_title: 'مفتش ومراجع مالي وإداري', level: 5, department: 'الإدارة الشؤون المالية والإدارية', is_active: true, email: 'financial@mohp.gov.eg', phone: '01055555555', financial_code: 'FIN-500100' },
      { id: 'demo-u2', full_name: 'سارة خالد البشري', job_title: 'مفتش منشآت صحية ومكافحة عدوى', level: 7, department: 'إدارة مكافحة العدوى', is_active: true, email: 'inspector@inspector.com', phone: '01122334455', financial_code: 'FIN-200384' },
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
