import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { levelToRole } from '@/lib/roles'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MissionsPortal } from './missions-portal'
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
  notes: string | null
  execution_notes?: string | null
  users: { full_name: string } | null
  facilities: { name: string } | null
  governorates: { name: string } | null
  organizational_units: { name: string } | null
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MissionsPage() {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    redirect('/login')
  }

  const { data: authUser } = await supabase.auth.getUser()
  if (!authUser.user) {
    redirect('/login')
  }

  // جلب المستوى التنظيمي الجديد
  const { data: profile } = await supabase
    .from('users')
    .select('org_level, level, job_title')
    .eq('auth_id', authUser.user.id)
    .single()

  const effectiveLevel = profile?.level ?? profile?.org_level ?? 7
  const { orgLevelToRole, canCreateMissions } = await import('@/lib/roles')
  const currentRole = orgLevelToRole(effectiveLevel, profile?.job_title)
  const canCreateMission = currentRole !== 'inspector' && canCreateMissions(effectiveLevel)

  let liveMissions: any[] = []
  let loadError = ''

  try {
    const { data, error } = await supabase
      .from('missions')
      .select(`
        id,
        serial_number,
        assigned_user_id,
        primary_inspector_id,
        status,
        priority,
        scheduled_date,
        destination_type,
        visit_purpose,
        notes,
        checkin_lat,
        checkin_lng,
        gps_verified,
        users:assigned_user_id(full_name),
        facilities:target_facility_id(name, facility_type, governorate, health_admin, village_city)
      `)
      .order('scheduled_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      loadError = error.message
    } else {
      liveMissions = data ?? []
    }
  } catch (e: any) {
    loadError = e.message || 'فشل تحميل المأموريات من خادم البيانات.'
  }

  const initialMissions = liveMissions.map((lm: any) => {
    return {
      id: lm.id,
      serialNumber: lm.serial_number,
      destinationType: (lm.destination_type || 'facility') as 'facility' | 'governorate',
      destinationName: lm.facilities?.name || 'مأمورية ميدانية عامة',
      facilityType: lm.facilities?.facility_type || 'منشأة صحية',
      orgUnitName: lm.facilities?.governorate ? `${lm.facilities.governorate} - ${lm.facilities.health_admin || ''}` : 'ديوان عام الوزارة',
      employeeNames: lm.users?.full_name || 'قائم بالمرور',
      scheduledDate: lm.scheduled_date || new Date().toISOString().slice(0, 10),
      endDate: lm.scheduled_date || new Date().toISOString().slice(0, 10),
      status: lm.status || 'scheduled',
      priority: lm.priority || 'medium',
      visitPurpose: lm.visit_purpose || lm.notes || 'تفتيش ومتابعة ميدانية',
      notes: lm.notes || lm.visit_purpose || '',
      gpsVerified: lm.gps_verified || false,
      checkinLat: lm.checkin_lat || null,
      checkinLng: lm.checkin_lng || null
    }
  })

  return (
    <DashboardShell role={currentRole} view="missions">
      <main className={styles.page}>
        <header className={`${styles.header} missions-page-header`} style={{ borderBottom: '1px solid #cfdcde', paddingBottom: '16px', marginBottom: '10px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '13px', color: '#78909c', fontWeight: 'bold' }}>وزارة الصحة والسكان - جمهورية مصر العربية</p>
            <h1 style={{ margin: '4px 0 0', fontSize: '26px', color: '#102027', fontWeight: '800' }}>
              {currentRole === 'inspector' ? 'مأمورياتي وتكليفاتي الميدانية' : 'تكليفات ومتابعة المأموريات الميدانية'}
            </h1>
          </div>
          {canCreateMission && (
            <Link className={styles.primaryLink} href="/dashboard/missions/new" style={{
              background: 'var(--brand)',
              boxShadow: '0 2px 8px rgba(0, 109, 119, 0.25)',
              fontWeight: 'bold',
              fontSize: '13.5px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 18px',
              transition: 'all 0.2s'
            }}>
              ➕ تكليف مأمورية جديدة
            </Link>
          )}
        </header>

        {loadError && (
          <div className={`${styles.error} missions-page-error`} style={{ marginBottom: '14px' }}>
            ⚠️ خطأ في قراءة خادم قاعدة البيانات: {loadError}.
          </div>
        )}

        <MissionsPortal initialMissions={initialMissions} roleName={currentRole} />
      </main>
    </DashboardShell>
  )
}
