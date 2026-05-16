import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
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

  const [profileResult, missionResult, facilitiesResult, governoratesResult] = await Promise.all([
    supabase.from('users').select('id, full_name, level').eq('auth_id', user.id).single(),
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
    supabase.from('facilities').select('id, name, address, governorate_id').eq('is_active', true).order('name'),
    supabase.from('governorates').select('id, name').eq('is_active', true).order('name'),
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
        facilities={facilitiesResult.data ?? []}
        governorates={governoratesResult.data ?? []}
        mission={mission}
      />
      </main>
    </DashboardShell>
  )
}
