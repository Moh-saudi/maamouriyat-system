import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { defaultCorrectionUnits, type CorrectionUnitOption } from '@/lib/correction-units'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MissionExecutionForm } from './mission-execution-form'
import styles from './execute.module.css'

type PageProps = {
  params: Promise<{ id: string }>
}

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

  const [profileResult, missionResult, facilitiesResult, governoratesResult, correctionUnitsResult, usersResult, savedResultsResult, orgUnitsResult] = await Promise.all([
    supabase.from('users').select('id, full_name, level, department, org_unit_id').eq('auth_id', user.id).single(),
    supabase
      .from('missions')
      .select(`
        id,
        serial_number,
        status,
        scheduled_date,
        destination_type,
        visit_purpose,
        notes,
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
    supabase.from('users').select('id, full_name, level, department, job_title, email').eq('is_active', true).order('full_name'),
    supabase.from('mission_results').select('checklist_item_id, answer, notes').eq('mission_id', id),
    supabase.from('organizational_units').select('id, name, parent_id, level').order('sort_order', { ascending: true })
  ])

  if (profileResult.error || missionResult.error || !profileResult.data || !missionResult.data) {
    redirect('/dashboard/missions')
  }

  const rawMission = missionResult.data as any
  const mission = {
    ...rawMission,
    facilities: Array.isArray(rawMission.facilities) ? rawMission.facilities[0] ?? null : rawMission.facilities ?? null,
    governorates: Array.isArray(rawMission.governorates) ? rawMission.governorates[0] ?? null : rawMission.governorates ?? null,
  }
  const correctionUnits: CorrectionUnitOption[] =
    correctionUnitsResult.error || !correctionUnitsResult.data?.length
      ? defaultCorrectionUnits.map((name) => ({ name }))
      : correctionUnitsResult.data

  const liveUsers = (usersResult?.data ?? []) as any[]

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
          currentUserOrgUnitId={profileResult.data.org_unit_id ?? undefined}
          correctionUnits={correctionUnits}
          facilities={facilitiesResult.data ?? []}
          governorates={governoratesResult.data ?? []}
          mission={mission}
          users={liveUsers}
          currentUserLevel={profileResult.data.level}
          savedResults={savedResultsResult.data || []}
          orgUnits={orgUnitsResult.data ?? []}
        />
      </main>
    </DashboardShell>
  )
}
