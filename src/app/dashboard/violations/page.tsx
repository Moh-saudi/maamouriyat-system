import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ViolationsPortal } from './violations-portal'

type ViolationRow = {
  id: string
  description: string
  priority: string | null
  status: string | null
  assigned_to_dept?: string | null
  violation_photo_url?: string | null
  correction_deadline: string | null
  created_at: string
  facilities: { name: string } | null
  missions: { id: string; serial_number: string } | null
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export const dynamic = 'force-dynamic'

export default async function ViolationsPage() {
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

  const { data, error } = await supabase
    .from('violations')
    .select(`
      id,
      description,
      priority,
      status,
      assigned_to_org_id,
      correction_photo_url,
      correction_deadline,
      created_at,
      facilities:facility_id(name),
      missions:mission_id(id,serial_number),
      organizations:assigned_to_org_id(name)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  const violations: ViolationRow[] = ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    description: row.description || 'مخالفة مرصودة بالمرور',
    priority: row.priority,
    status: row.status,
    assigned_to_dept: row.organizations?.name || null,
    violation_photo_url: row.correction_photo_url || null,
    correction_deadline: row.correction_deadline,
    created_at: row.created_at,
    facilities: normalizeRelation(row.facilities),
    missions: normalizeRelation(row.missions),
  }))

  const { data: profile } = await supabase
    .from('users')
    .select('level, org_level')
    .eq('auth_id', user.id)
    .maybeSingle()

  const { orgLevelToRole } = await import('@/lib/roles')
  const role = orgLevelToRole(profile?.level ?? profile?.org_level ?? 7)

  return (
    <DashboardShell role={role} view="violations">
      <main style={{ display: 'grid', gap: '20px' }}>
        <header style={{ borderBottom: '1px solid #cfdcde', paddingBottom: '16px', marginBottom: '10px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#78909c', fontWeight: 'bold' }}>وزارة الصحة والسكان - جمهورية مصر العربية</p>
          <h1 style={{ margin: '4px 0 0', fontSize: '26px', color: '#102027', fontWeight: '800' }}>سجل المخالفات وتوجيهات التصحيح الميداني</h1>
        </header>

        {error && (
          <div style={{ background: '#ffebee', color: '#c62828', padding: '14px', borderRadius: '12px', marginBottom: '14px', border: '1px solid #ffcdd2' }}>
            ⚠️ خطأ في الاتصال بقاعدة البيانات: {error.message}. تم تحميل سجل المخالفات الاحتياطي.
          </div>
        )}

        <ViolationsPortal initialViolations={violations} />
      </main>
    </DashboardShell>
  )
}
