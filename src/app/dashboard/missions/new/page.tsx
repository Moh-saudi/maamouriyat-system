import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MissionCreateForm, type MissionOption } from './mission-create-form'
import styles from './new-mission.module.css'

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

  const [profileResult, employeesResult, unitsResult, facilitiesResult, governoratesResult] = await Promise.all([
    supabase.from('users').select('id, full_name, level, department').eq('auth_id', user.id).single(),
    supabase.from('users').select('id, full_name, job_title, level, department').eq('is_active', true).order('level').order('full_name'),
    supabase.from('organizational_units').select('id, code, name, unit_type, parent_id, level').eq('is_active', true).order('level').order('sort_order'),
    supabase.from('facilities').select('id, name, facility_type, address, governorate_id, org_unit_id').eq('is_active', true).order('name'),
    supabase.from('governorates').select('id, name, region').eq('is_active', true).order('name'),
  ])

  if (profileResult.error || !profileResult.data) {
    redirect('/login')
  }

  return (
    <DashboardShell view="missions">
      <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>قطاع الطب العلاجي</p>
          <h1>إنشاء مأمورية جديدة</h1>
        </div>
        <span>تسكين الموظف والوجهة والغرض من الزيارة</span>
      </header>

      <MissionCreateForm
        currentUserId={profileResult.data.id}
        employees={(employeesResult.data ?? []) as MissionOption['employees']}
        facilities={(facilitiesResult.data ?? []) as MissionOption['facilities']}
        governorates={(governoratesResult.data ?? []) as MissionOption['governorates']}
        orgUnits={(unitsResult.data ?? []) as MissionOption['orgUnits']}
      />
      </main>
    </DashboardShell>
  )
}
