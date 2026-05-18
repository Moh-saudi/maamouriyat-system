import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type UserRow = {
  id: string
  full_name: string
  job_title: string | null
  level: number
  department: string | null
  is_active: boolean | null
}

function levelLabel(level: number) {
  if (level <= 2) return 'قيادي'
  if (level <= 4) return 'مدير'
  if (level <= 6) return 'مشرف'
  return 'مفتش'
}

function levelTone(level: number) {
  if (level <= 2) return 'red'
  if (level <= 4) return 'amber'
  if (level <= 6) return 'blue'
  return 'green'
}

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
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

  const { data: profile } = await supabase
    .from('users')
    .select('level')
    .eq('auth_id', user.id)
    .maybeSingle<{ level: number }>()

  if (!profile || profile.level > 4) {
    redirect('/dashboard')
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, job_title, level, department, is_active')
    .order('level')
    .order('full_name')
    .limit(300)

  const users = (data ?? []) as UserRow[]
  const activeCount = users.filter((u) => u.is_active !== false).length

  return (
    <DashboardShell view="users">
      <div className="stack">
        <section className="welcome-band">
          <div>
            <p className="eyebrow">إدارة الوصول</p>
            <h2>المستخدمون</h2>
            <p>
              {users.length} حساب — {activeCount} نشط
            </p>
          </div>
        </section>

        {error && <div className="alert">{error.message}</div>}

        <section className="cards-list">
          {users.map((u) => (
            <article className="mission-card" key={u.id}>
              <div className="card-line">
                <strong>{u.full_name}</strong>
                <span className={`pill ${levelTone(u.level)}`}>
                  {levelLabel(u.level)} — م{u.level}
                </span>
              </div>
              <div className="meta-grid">
                <span>{u.job_title ?? '—'}</span>
                <span>{u.department ?? '—'}</span>
                <span className={u.is_active !== false ? '' : 'red'}>
                  {u.is_active !== false ? 'نشط' : 'غير نشط'}
                </span>
              </div>
            </article>
          ))}

          {!error && users.length === 0 && (
            <div className="empty-state">
              <h2>لا يوجد مستخدمون</h2>
              <p>يُضاف المستخدمون تلقائياً عند تسجيل الدخول لأول مرة.</p>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
