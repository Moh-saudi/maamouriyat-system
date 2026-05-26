import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { defaultCorrectionUnits, type CorrectionUnitOption } from '@/lib/correction-units'
import { getDemoSessionEmail, getDemoSessionRole } from '@/lib/demo-session'
import { roleDefinitions } from '@/lib/roles'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MissionExecutionForm } from './mission-execution-form'
import styles from './execute.module.css'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ExecuteMissionPage({ params }: PageProps) {
  const { id } = await params
  const demoEmail = await getDemoSessionEmail()
  const demoRole = await getDemoSessionRole()
  const supabase = await createServerSupabaseClient()

  // --- DEMO MODE EXECUTION HANDLER ---
  if (demoEmail) {
    const demoRoleDef = demoRole ? roleDefinitions[demoRole] : null
    const demoDept = demoRoleDef?.department ?? 'إدارة مكافحة العدوى'
    const store = await cookies()
    const rawDemoMissions = store.get('maamouriyat_demo_missions')?.value
    let demoMissions: any[] = []
    
    if (rawDemoMissions) {
      try {
        demoMissions = JSON.parse(decodeURIComponent(rawDemoMissions))
      } catch {}
    }

    const demoMission = demoMissions.find((m) => m.id === id)
    if (!demoMission) {
      redirect('/dashboard/missions')
    }

    // Attempt to load live list dynamically from Supabase if connected, or use static fallbacks
    let liveFacilities: any[] = []
    let liveGovernorates: any[] = []
    let liveCorrectionUnits: any[] = []

    if (supabase) {
      const [facRes, govRes, unitRes] = await Promise.all([
        supabase.from('facilities').select('id, name, address, governorate_id, latitude, longitude').eq('is_active', true).order('name'),
        supabase.from('governorates').select('id, name').eq('is_active', true).order('name'),
        supabase.from('correction_units').select('id, name').eq('is_active', true).order('sort_order').order('name'),
      ])
      liveFacilities = facRes.data ?? []
      liveGovernorates = govRes.data ?? []
      liveCorrectionUnits = unitRes.data ?? []
    }

    const mockFacilities = liveFacilities.length ? liveFacilities : [
      { id: 'demo-facility-1', name: 'مستشفى النيل العام', address: 'القاهرة، المنيل', governorate_id: 'demo-gov-1', latitude: 30.0135, longitude: 31.2144 },
      { id: 'demo-facility-2', name: 'مركز صحة الأسرة النموذجي', address: 'الجيزة، الدقي', governorate_id: 'demo-gov-2', latitude: 30.0483, longitude: 30.9856 },
    ]
    const mockGovernorates = liveGovernorates.length ? liveGovernorates : [
      { id: 'demo-gov-1', name: 'القاهرة' },
      { id: 'demo-gov-2', name: 'الجيزة' },
      { id: 'demo-gov-3', name: 'الإسكندرية' },
    ]
    const mockCorrectionUnits = liveCorrectionUnits.length ? liveCorrectionUnits : defaultCorrectionUnits.map((name) => ({ name }))

    const mission = {
      id: demoMission.id,
      serial_number: demoMission.serialNumber,
      status: demoMission.status,
      scheduled_date: demoMission.scheduledDate,
      destination_type: demoMission.destinationType,
      visit_purpose: demoMission.visitPurpose,
      target_facility_id: demoMission.destinationType === 'facility' ? 'demo-facility-1' : null,
      target_governorate_id: demoMission.destinationType === 'governorate' ? 'demo-gov-1' : null,
      actual_facility_id: null,
      actual_governorate_id: null,
      destination_changed: false,
      change_reason: '',
      execution_notes: '',
      facilities: demoMission.destinationType === 'facility' ? { name: demoMission.destinationName } : null,
      governorates: demoMission.destinationType === 'governorate' ? { name: demoMission.destinationName } : null,
    }

    return (
      <DashboardShell role={demoRole} view="missions">
        <main className={styles.page}>
          <header className={styles.header}>
            <div>
              <p>{mission.serial_number} (وضع تجريبي)</p>
              <h1>تنفيذ المأمورية</h1>
            </div>
            <span>{mission.scheduled_date}</span>
          </header>

          <MissionExecutionForm
            currentUserId="demo-inspector"
            currentUserDept={demoDept}
            correctionUnits={mockCorrectionUnits}
            facilities={mockFacilities}
            governorates={mockGovernorates}
            mission={mission}
            demoMode={true}
          />
        </main>
      </DashboardShell>
    )
  }

  // --- LIVE SUPABASE PRODUCTION MODE ---
  if (!supabase) {
    redirect('/login')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [profileResult, missionResult, facilitiesResult, governoratesResult, correctionUnitsResult] = await Promise.all([
    supabase.from('users').select('id, full_name, level, department').eq('auth_id', user.id).single(),
    supabase
      .from('missions')
      .select(`
        id,
        serial_number,
        status,
        scheduled_date,
        destination_type,
        visit_purpose,
        target_facility_id,
        target_governorate_id,
        actual_facility_id,
        actual_governorate_id,
        destination_changed,
        change_reason,
        execution_notes,
        facilities:target_facility_id(name),
        governorates:target_governorate_id(name)
      `)
      .eq('id', id)
      .single(),
    supabase.from('facilities').select('id, name, address, governorate_id, latitude, longitude').eq('is_active', true).order('name'),
    supabase.from('governorates').select('id, name').eq('is_active', true).order('name'),
    supabase.from('correction_units').select('id, name').eq('is_active', true).order('sort_order').order('name'),
  ])

  if (profileResult.error || missionResult.error || !profileResult.data || !missionResult.data) {
    redirect('/dashboard/missions')
  }

  const rawMission = missionResult.data as typeof missionResult.data & {
    facilities?: { name: string } | { name: string }[] | null
    governorates?: { name: string } | { name: string }[] | null
  }
  const mission = {
    ...rawMission,
    facilities: Array.isArray(rawMission.facilities) ? rawMission.facilities[0] ?? null : rawMission.facilities ?? null,
    governorates: Array.isArray(rawMission.governorates) ? rawMission.governorates[0] ?? null : rawMission.governorates ?? null,
  }
  const correctionUnits: CorrectionUnitOption[] =
    correctionUnitsResult.error || !correctionUnitsResult.data?.length
      ? defaultCorrectionUnits.map((name) => ({ name }))
      : correctionUnitsResult.data

  return (
    <DashboardShell view="missions">
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
          correctionUnits={correctionUnits}
          facilities={facilitiesResult.data ?? []}
          governorates={governoratesResult.data ?? []}
          mission={mission}
        />
      </main>
    </DashboardShell>
  )
}
