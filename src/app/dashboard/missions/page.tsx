import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import styles from './missions.module.css'

type MissionRow = {
  id: string
  serial_number: string
  status: string | null
  priority: string | null
  scheduled_date: string
  destination_type: string | null
  visit_purpose: string | null
  destination_changed: boolean | null
  users: { full_name: string } | null
  facilities: { name: string } | null
  governorates: { name: string } | null
  organizational_units: { name: string } | null
}

export default async function MissionsPage() {
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

  const { data: missions, error } = await supabase
    .from('missions')
    .select(`
      id,
      serial_number,
      status,
      priority,
      scheduled_date,
      destination_type,
      visit_purpose,
      destination_changed,
      users:assigned_user_id(full_name),
      facilities:target_facility_id(name),
      governorates:target_governorate_id(name),
      organizational_units:org_unit_id(name)
    `)
    .order('scheduled_date', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <DashboardShell view="missions">
      <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>قطاع الطب العلاجي</p>
          <h1>المأموريات</h1>
        </div>
        <Link className={styles.primaryLink} href="/dashboard/missions/new">
          إنشاء مأمورية
        </Link>
      </header>

      {error && <div className={styles.error}>{error.message}</div>}

      <section className={styles.list}>
        {((missions ?? []) as unknown as MissionRow[]).map((rawMission) => {
          const mission = normalizeMission(rawMission)
          return (
          <article className={styles.card} key={mission.id}>
            <div className={styles.cardHead}>
              <div>
                <strong>{mission.serial_number}</strong>
                <p>{mission.visit_purpose || 'بدون غرض مسجل'}</p>
              </div>
              <span className={styles.status}>{statusText(mission.status)}</span>
            </div>

            <dl className={styles.meta}>
              <div>
                <dt>الموظف</dt>
                <dd>{mission.users?.full_name ?? 'غير محدد'}</dd>
              </div>
              <div>
                <dt>الإدارة</dt>
                <dd>{mission.organizational_units?.name ?? 'غير محددة'}</dd>
              </div>
              <div>
                <dt>الوجهة</dt>
                <dd>{mission.destination_type === 'governorate' ? mission.governorates?.name : mission.facilities?.name}</dd>
              </div>
              <div>
                <dt>التاريخ</dt>
                <dd>{mission.scheduled_date}</dd>
              </div>
            </dl>

            <div className={styles.cardActions}>
              {mission.destination_changed && <span className={styles.changed}>تم تغيير الوجهة</span>}
              <Link href={`/dashboard/missions/${mission.id}/execute`}>تنفيذ / تحديث</Link>
            </div>
          </article>
          )
        })}

        {!error && !missions?.length && (
          <div className={styles.empty}>
            <h2>لا توجد مأموريات بعد</h2>
            <p>ابدأ بإنشاء مأمورية جديدة وتسكين موظف ووجهة لها.</p>
          </div>
        )}
      </section>
      </main>
    </DashboardShell>
  )
}

function normalizeMission(mission: MissionRow) {
  return {
    ...mission,
    users: Array.isArray(mission.users) ? mission.users[0] ?? null : mission.users,
    facilities: Array.isArray(mission.facilities) ? mission.facilities[0] ?? null : mission.facilities,
    governorates: Array.isArray(mission.governorates) ? mission.governorates[0] ?? null : mission.governorates,
    organizational_units: Array.isArray(mission.organizational_units)
      ? mission.organizational_units[0] ?? null
      : mission.organizational_units,
  }
}

function statusText(status: string | null) {
  if (status === 'assigned') return 'مكلفة'
  if (status === 'in_progress') return 'قيد التنفيذ'
  if (status === 'completed') return 'مكتملة'
  if (status === 'draft') return 'مسودة'
  return status ?? 'غير محدد'
}
