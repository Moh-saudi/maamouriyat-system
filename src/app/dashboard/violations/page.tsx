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
      assigned_to_dept,
      violation_photo_url,
      correction_deadline,
      created_at,
      facilities:facility_id(name),
      missions:mission_id(id,serial_number)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  const violations = ((data ?? []) as unknown as ViolationRow[]).map((row) => ({
    ...row,
    facilities: normalizeRelation(row.facilities),
    missions: normalizeRelation(row.missions),
  }))

  return (
    <DashboardShell view="violations">
      <main style={{ display: 'grid', gap: '20px' }}>
        <header style={{ borderBottom: '1px solid #cfdcde', paddingBottom: '16px', marginBottom: '10px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#78909c', fontWeight: 'bold' }}>قطاع الطب العلاجي - وزارة الصحة المصرية</p>
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
