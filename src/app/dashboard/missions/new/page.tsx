import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { getDemoSessionEmail, getDemoSessionRole } from '@/lib/demo-session'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MissionCreateForm, type MissionOption } from './mission-create-form'
import { realEgyptianGovernorates, realEgyptianMedicalFacilities, realEgyptianMinistryUnits } from '@/lib/real-facilities'
import styles from './new-mission.module.css'

const demoMissionOptions: MissionOption = {
  employees: realEgyptianMinistryUnits.flatMap(unit => {
    const cleanName = unit.name
      .replace(/^رئيس /, '')
      .replace(/^الإدارة العامة لـ/, '')
      .replace(/^الإدارة العامة ل/, '')
      .replace(/^الإدارة العامة /, '')
      .replace(/^الإدارة المركزية لـ/, '')
      .replace(/^الإدارة المركزية ل/, '')
      .replace(/^الإدارة المركزية /, '')
      .replace(/^إدارة /, '')
    
    return [
      {
        id: `demo-inspector-${unit.id}-1`,
        full_name: `د. أحمد عبد الرحمن (${cleanName})`,
        job_title: `عضو تفتيش فني`,
        level: 4,
        department: unit.name,
        org_unit_id: unit.id
      },
      {
        id: `demo-inspector-${unit.id}-2`,
        full_name: `أ. محمد علي (${cleanName})`,
        job_title: `مفتش إداري ومالي`,
        level: 4,
        department: unit.name,
        org_unit_id: unit.id
      }
    ]
  }),
  orgUnits: realEgyptianMinistryUnits.map(unit => ({
    id: unit.id,
    code: unit.id.toUpperCase().replace(/-/g, '_'),
    name: unit.name,
    unit_type: unit.levelIndex === 0 ? 'sector' : unit.levelIndex === 1 ? 'central_administration' : unit.levelIndex === 2 ? 'general_administration' : 'supervisory_unit',
    parent_id: unit.parent,
    level: unit.levelIndex
  })),
  facilities: realEgyptianMedicalFacilities.map(f => ({
    id: f.id,
    name: f.name,
    facility_type: f.facility_type,
    address: f.address,
    governorate_id: f.governorate_id,
    org_unit_id: 'gen-hospitals',
    latitude: f.latitude,
    longitude: f.longitude
  })),
  governorates: realEgyptianGovernorates,
}

export default async function NewMissionPage() {
  const demoEmail = await getDemoSessionEmail()
  const demoRole = await getDemoSessionRole()
  const supabase = await createServerSupabaseClient()

  if (demoEmail) {
    return (
      <DashboardShell role={demoRole} view="missions">
        <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p>قطاع الطب العلاجي</p>
            <h1>إنشاء مأمورية جديدة</h1>
          </div>
          <span>وضع تجربة: يمكن اختبار النموذج بدون حفظ نهائي</span>
        </header>

        <MissionCreateForm
          currentUserId="demo-admin"
          demoMode
          employees={demoMissionOptions.employees}
          facilities={demoMissionOptions.facilities}
          governorates={demoMissionOptions.governorates}
          orgUnits={demoMissionOptions.orgUnits}
        />
        </main>
      </DashboardShell>
    )
  }

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
    supabase.from('users').select('id, full_name, job_title, level, department, org_unit_id').eq('is_active', true).order('level').order('full_name'),
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
