import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { defaultCorrectionUnits, type CorrectionUnitOption } from '@/lib/correction-units'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MissionExecutionForm } from './mission-execution-form'
import styles from './execute.module.css'

type PageProps = {
  params: Promise<{ id: string }>
}

const EGYPTIAN_GOVERNORATES = [
  { id: 'cairo', name: 'القاهرة' },
  { id: 'giza', name: 'الجيزة' },
  { id: 'alexandria', name: 'الإسكندرية' },
  { id: 'asyut', name: 'أسيوط' },
  { id: 'dakahlia', name: 'الدقهلية' },
  { id: 'gharbia', name: 'الغربية' },
  { id: 'sharkia', name: 'الشرقية' },
  { id: 'beheira', name: 'البحيرة' },
  { id: 'damietta', name: 'دمياط' },
  { id: 'kafr_el_sheikh', name: 'كفر الشيخ' },
  { id: 'menoufia', name: 'المنوفية' },
  { id: 'qalyubia', name: 'القليوبية' },
  { id: 'fayoum', name: 'الفيوم' },
  { id: 'beni_suef', name: 'بني سويف' },
  { id: 'minya', name: 'المنيا' },
  { id: 'sohag', name: 'سوهاج' },
  { id: 'qena', name: 'قنا' },
  { id: 'luxor', name: 'الأقصر' },
  { id: 'aswan', name: 'أسوان' },
  { id: 'red_sea', name: 'البحر الأحمر' },
  { id: 'new_valley', name: 'الوادي الجديد' },
  { id: 'matrouh', name: 'مطروح' },
  { id: 'north_sinai', name: 'شمال سيناء' },
  { id: 'south_sinai', name: 'جنوب سيناء' },
  { id: 'ismailia', name: 'الإسماعيلية' },
  { id: 'suez', name: 'السويس' },
  { id: 'port_said', name: 'بورسعيد' }
]

export default async function ExecuteMissionPage({ params }: PageProps) {
  const { id } = await params
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

  const [profileResult, missionResult, facilitiesResult, orgsResult, usersResult, savedResultsResult] = await Promise.all([
    supabase.from('users').select('id, full_name, level, org_level, department, org_unit_id, job_title, sector_id').eq('auth_id', user.id).single(),
    supabase
      .from('missions')
      .select(`
        id,
        serial_number,
        status,
        scheduled_date,
        expected_end_date,
        destination_type,
        visit_purpose,
        notes,
        target_facility_id,
        target_governorate_id,
        assigned_user_id,
        primary_inspector_id,
        sector_id,
        facilities:target_facility_id(id, name, facility_type, governorate, health_admin, latitude, longitude),
        assigned_user:assigned_user_id(full_name, job_title)
      `)
      .eq('id', id)
      .single(),
    supabase.from('facilities').select('id, name, facility_type, governorate, health_admin, latitude, longitude').eq('is_active', true).order('name').limit(4000),
    supabase.from('organizations').select('id, name, level, level_label').eq('is_active', true).order('name'),
    supabase.from('users').select('id, full_name, level, department, job_title, email').eq('is_active', true).order('full_name'),
    supabase.from('mission_results').select('checklist_item_id, answer, notes').eq('mission_id', id)
  ])

  if (profileResult.error || missionResult.error || !profileResult.data || !missionResult.data) {
    redirect('/dashboard/missions')
  }

  const rawMission = missionResult.data as any
  const currentUserId = profileResult.data.id
  const userLevel = profileResult.data.level ?? (profileResult.data as any).org_level ?? 7

  const { orgLevelToRole } = await import('@/lib/roles')
  const currentRole = orgLevelToRole(userLevel, profileResult.data.job_title)

  // Authorization Guard: The assigned inspector, sector head (Level 2), or superadmin can execute/open the mission
  const isAssigned =
    rawMission.assigned_user_id === currentUserId ||
    rawMission.primary_inspector_id === currentUserId ||
    userLevel <= 2 ||
    (userLevel <= 4 && profileResult.data.sector_id === rawMission.sector_id)

  if (!isAssigned) {
    const assignedName = Array.isArray(rawMission.assigned_user) 
      ? rawMission.assigned_user[0]?.full_name 
      : rawMission.assigned_user?.full_name

    return (
      <DashboardShell role={currentRole} view="missions">
        <main className={styles.page}>
          <div style={{
            maxWidth: '620px',
            margin: '60px auto',
            background: 'white',
            border: '1px solid #cfdcde',
            borderRadius: '16px',
            padding: '36px 24px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              background: '#fff3e0',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              fontSize: '32px'
            }}>
              🚫
            </div>
            <h2 style={{ color: '#e65100', fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>
              تنبيه صلاحيات: أنت لست القائم بالمرور المكلف بهذه المأمورية
            </h2>
            <p style={{ color: '#546e7a', fontSize: '14px', lineHeight: '1.7', marginBottom: '24px' }}>
              تنفيذ وتسجيل استمارات التفتيش الميداني مخصص حصرياً للمفتش / الموظف المكلف بها رسمياً
              {assignedName ? <strong style={{ color: '#102027' }}> ({assignedName})</strong> : ''}.
              <br />
              يمكنك متابعة تفاصيل المأمورية ونتائجها بعد اعتمادها من خلال جدول المأموريات.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/dashboard/missions"
                style={{
                  background: 'var(--brand)',
                  color: 'white',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  fontSize: '13.5px'
                }}
              >
                ← العودة إلى قائمة المأموريات
              </Link>
            </div>
          </div>
        </main>
      </DashboardShell>
    )
  }

  const mission = {
    ...rawMission,
    facilities: Array.isArray(rawMission.facilities) ? rawMission.facilities[0] ?? null : rawMission.facilities ?? null,
    governorates: Array.isArray(rawMission.governorates) ? rawMission.governorates[0] ?? null : rawMission.governorates ?? null,
  }

  const correctionUnits: CorrectionUnitOption[] = (orgsResult.data && orgsResult.data.length > 0)
    ? orgsResult.data.map((o: any) => ({ name: o.name }))
    : defaultCorrectionUnits.map((name) => ({ name }))

  const liveUsers = (usersResult?.data ?? []) as any[]

  return (
    <DashboardShell role={currentRole} view="missions">
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p>{missionResult.data.serial_number}</p>
            <h1>تنفيذ المأمورية</h1>
          </div>
          <span>{missionResult.data.scheduled_date}</span>
        </header>

        <MissionExecutionForm
          currentUserId={profileResult.data.id}
          currentUserDept={profileResult.data.department ?? undefined}
          currentUserOrgUnitId={profileResult.data.org_unit_id ?? undefined}
          correctionUnits={correctionUnits}
          facilities={facilitiesResult.data ?? []}
          governorates={EGYPTIAN_GOVERNORATES}
          mission={mission}
          users={liveUsers}
          currentUserLevel={profileResult.data.level}
          savedResults={savedResultsResult.data || []}
          orgUnits={orgsResult.data ?? []}
        />
      </main>
    </DashboardShell>
  )
}
