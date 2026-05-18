import { redirect } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type FacilityRow = {
  id: string
  name: string
  facility_type: string
  address: string
  is_active: boolean | null
  governorates: { name: string } | null
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export const dynamic = 'force-dynamic'

export default async function FacilitiesPage() {
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
    .from('facilities')
    .select(`
      id,
      name,
      facility_type,
      address,
      is_active,
      governorates:governorate_id(name)
    `)
    .order('name')
    .limit(500)

  const facilities = ((data ?? []) as unknown as FacilityRow[]).map((row) => ({
    ...row,
    governorates: normalizeRelation(row.governorates),
  }))

  const active = facilities.filter((f) => f.is_active !== false).length
  const inactive = facilities.length - active

  return (
    <DashboardShell view="facilities">
      <div className="stack">
        <section className="welcome-band">
          <div>
            <p className="eyebrow">دليل المنشآت</p>
            <h2>المنشآت الصحية</h2>
            <p>
              {facilities.length} منشأة — {active} نشطة
              {inactive > 0 ? ` · ${inactive} غير نشطة` : ''}
            </p>
          </div>
        </section>

        {error && <div className="alert">{error.message}</div>}

        <section className="cards-list">
          {facilities.map((facility) => (
            <article className="mission-card" key={facility.id}>
              <div className="card-line">
                <strong>{facility.name}</strong>
                <span className={`pill ${facility.is_active !== false ? 'green' : 'red'}`}>
                  {facility.is_active !== false ? 'نشطة' : 'غير نشطة'}
                </span>
              </div>
              <div className="meta-grid">
                <span>{facility.facility_type}</span>
                <span>{facility.governorates?.name ?? '—'}</span>
                <span className="truncate">
                  {facility.address}
                </span>
              </div>
            </article>
          ))}

          {!error && facilities.length === 0 && (
            <div className="empty-state">
              <h2>لا توجد منشآت مسجلة</h2>
              <p>يمكن إضافة المنشآت عبر لوحة إدارة قاعدة البيانات.</p>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
