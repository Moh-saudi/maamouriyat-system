import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardShell } from '@/app/system-ui'
import { getDemoSessionEmail, getDemoSessionRole } from '@/lib/demo-session'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type ViolationRow = {
  id: string
  description: string
  priority: string | null
  status: string | null
  correction_deadline: string | null
  created_at: string
  facilities: { name: string } | null
  missions: { id: string; serial_number: string } | null
}

function priorityText(priority: string | null) {
  if (priority === 'critical') return 'حرجة'
  if (priority === 'high') return 'عالية'
  if (priority === 'medium') return 'متوسطة'
  if (priority === 'low') return 'بسيطة'
  return priority ?? 'غير محددة'
}

function priorityTone(priority: string | null) {
  if (priority === 'critical' || priority === 'high') return 'red'
  if (priority === 'medium') return 'amber'
  return 'blue'
}

function statusText(status: string | null) {
  if (status === 'new') return 'جديدة'
  if (status === 'in_progress') return 'تحت التصحيح'
  if (status === 'corrected') return 'تم التصحيح'
  if (status === 'verified') return 'تم التحقق'
  if (status === 'closed') return 'مغلقة'
  return status ?? 'غير محدد'
}

function statusTone(status: string | null) {
  if (status === 'corrected' || status === 'verified' || status === 'closed') return 'green'
  if (status === 'in_progress') return 'amber'
  return 'red'
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export const dynamic = 'force-dynamic'

export default async function ViolationsPage() {
  const demoEmail = await getDemoSessionEmail()
  const demoRole = await getDemoSessionRole()
  const supabase = await createServerSupabaseClient()

  if (!supabase || demoEmail) {
    const store = await cookies()
    const rawDemoViolations = store.get('maamouriyat_demo_violations')?.value
    let demoViolations: any[] = []
    if (rawDemoViolations) {
      try {
        demoViolations = JSON.parse(decodeURIComponent(rawDemoViolations))
      } catch {}
    }

    return (
      <DashboardShell role={demoRole} view="violations">
        <div className="stack">
          <section className="welcome-band">
            <div>
              <p className="eyebrow">قطاع الطب العلاجي</p>
              <h2>المخالفات</h2>
              <p>عرض المخالفات المسجلة للوضع التجريبي (المحفوظة محلياً).</p>
            </div>
          </section>

          <section className="cards-list">
            {demoViolations.map((violation) => (
              <article className="mission-card" key={violation.id}>
                <div className="card-line">
                  <strong>{violation.description}</strong>
                  <span className={`pill ${priorityTone(violation.priority)}`}>
                    {priorityText(violation.priority)}
                  </span>
                </div>
                <div className="card-line" style={{ marginTop: 2 }}>
                  <p>{violation.facility_name ?? 'منشأة غير محددة'}</p>
                  <span className={`pill ${statusTone(violation.status)}`}>
                    {statusText(violation.status)}
                  </span>
                </div>
                <div className="meta-grid">
                  <span>
                    الجهة: {violation.assigned_to_dept || 'غير محددة'}
                  </span>
                  {violation.created_at && (
                    <span>
                      التاريخ: {new Date(violation.created_at).toLocaleDateString('ar-EG')}
                    </span>
                  )}
                </div>
              </article>
            ))}

            {demoViolations.length === 0 && (
              <div className="empty-state">
                <h2>لا توجد مخالفات تجريبية مسجلة</h2>
                <p>قم بالدخول كـ مفتش، ثم قم بتنفيذ مأمورية وسجل مخالفة لتظهر هنا تلقائياً.</p>
              </div>
            )}
          </section>
        </div>
      </DashboardShell>
    )
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
      <div className="stack">
        <section className="welcome-band">
          <div>
            <p className="eyebrow">قطاع الطب العلاجي</p>
            <h2>المخالفات</h2>
            <p>عرض المخالفات المسجلة مرتبة من الأحدث، مع حالة التصحيح ومستوى الخطورة.</p>
          </div>
        </section>

        {error && <div className="alert">{error.message}</div>}

        <section className="cards-list">
          {violations.map((violation) => (
            <article className="mission-card" key={violation.id}>
              <div className="card-line">
                <strong>{violation.description}</strong>
                <span className={`pill ${priorityTone(violation.priority)}`}>
                  {priorityText(violation.priority)}
                </span>
              </div>
              <div className="card-line" style={{ marginTop: 2 }}>
                <p>{violation.facilities?.name ?? 'منشأة غير محددة'}</p>
                <span className={`pill ${statusTone(violation.status)}`}>
                  {statusText(violation.status)}
                </span>
              </div>
              {violation.missions?.serial_number && (
                <div className="meta-grid">
                  <span>
                    <Link href={`/dashboard/missions/${violation.missions.id}/execute`}>
                      {violation.missions.serial_number}
                    </Link>
                  </span>
                  {violation.correction_deadline && (
                    <span>
                      الموعد: {new Date(violation.correction_deadline).toLocaleDateString('ar-EG')}
                    </span>
                  )}
                </div>
              )}
            </article>
          ))}

          {!error && violations.length === 0 && (
            <div className="empty-state">
              <h2>لا توجد مخالفات مسجلة</h2>
              <p>ستظهر المخالفات هنا تلقائياً عند تسجيلها أثناء تنفيذ المأموريات.</p>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
