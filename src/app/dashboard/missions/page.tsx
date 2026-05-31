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

export default async function MissionsPage() {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    redirect('/login')
  }

  const { data: authUser } = await supabase.auth.getUser()
  if (!authUser.user) {
    redirect('/login')
  }

  // Fetch profile to get level
  const { data: profile } = await supabase
    .from('users')
    .select('level')
    .eq('auth_id', authUser.user.id)
    .single()

  let liveRoleName: string | null = null
  if (profile) {
    if (profile.level === 7) {
      liveRoleName = 'inspector'
    } else if (profile.level === 5) {
      liveRoleName = 'financial'
    } else if (profile.level === 4) {
      liveRoleName = 'creator'
    } else if (profile.level === 3) {
      liveRoleName = 'generalmanager'
    } else if (profile.level === 2 || profile.level === 1) {
      liveRoleName = 'central'
    } else if (profile.level === 0) {
      liveRoleName = 'techadmin'
    }
  }
  const currentRole = levelToRole(profile?.level ?? 7)
  const canCreateMission = currentRole !== 'financial' && currentRole !== 'inspector'

  let liveMissions: any[] = []
  let loadError = ''

  try {
    const { data, error } = await supabase
      .from('missions')
      .select(`
        id,
        serial_number,
        assigned_user_id,
        status,
        priority,
        scheduled_date,
        destination_type,
        visit_purpose,
        destination_changed,
        notes,
        execution_notes,
        checkin_lat,
        checkin_lng,
        gps_verified,
        users:assigned_user_id(full_name),
        facilities:target_facility_id(name, address),
        governorates:target_governorate_id(name),
        organizational_units:org_unit_id(name)
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

  // In production mode: Map Supabase rows to standard format
  const finalMissionsList = liveMissions.map((lm: any) => {
    const usersObj = Array.isArray(lm.users) ? lm.users[0] : lm.users
    const facilityObj = Array.isArray(lm.facilities) ? lm.facilities[0] : lm.facilities
    const govObj = Array.isArray(lm.governorates) ? lm.governorates[0] : lm.governorates
    const orgUnitObj = Array.isArray(lm.organizational_units) ? lm.organizational_units[0] : lm.organizational_units

    return {
      id: lm.id,
      serialNumber: lm.serial_number,
      visitPurpose: lm.visit_purpose || 'تفتيش دوري',
      status: lm.status || 'assigned',
      priority: lm.priority || 'normal',
      scheduledDate: lm.scheduled_date,
      endDate: lm.scheduled_date, // fallback
      employeeNames: usersObj?.full_name || 'غير حدد',
      orgUnitName: orgUnitObj?.name || 'إدارة التفتيش',
      destinationName: lm.destination_type === 'governorate' 
        ? (govObj?.name || 'محافظة غير محددة') 
        : `${facilityObj?.name || 'منشأة غير محددة'} - ${facilityObj?.address || ''}`,
      destinationType: (lm.destination_type as 'facility' | 'governorate') || 'facility',
      facilityType: null,
      notes: lm.notes || lm.execution_notes,
      assignedUserId: lm.assigned_user_id,
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
            <p style={{ margin: 0, fontSize: '13px', color: '#78909c', fontWeight: 'bold' }}>قطاع الطب العلاجي - وزارة الصحة المصرية</p>
            <h1 style={{ margin: '4px 0 0', fontSize: '26px', color: '#102027', fontWeight: '800' }}>تكليفات ومتابعة المأموريات الميدانية</h1>
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

        <MissionsPortal initialMissions={finalMissionsList} roleName={liveRoleName} />
      </main>
    </DashboardShell>
  )
}
