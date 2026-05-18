import { DashboardShell } from '../../system-ui'

const settings = [
  { label: 'صلاحيات المستويات', value: 'مفعلة حسب الهيكل الإداري' },
  { label: 'تنبيهات المأموريات', value: 'قيد التجهيز' },
  { label: 'ربط Supabase', value: 'يعتمد على متغيرات البيئة في Vercel' },
]

export default function SettingsPage() {
  return (
    <DashboardShell view="settings">
      <div className="stack">
        <section className="welcome-band">
          <div>
            <p className="eyebrow">إدارة النظام</p>
            <h2>الإعدادات</h2>
            <p>إعدادات تشغيلية مختصرة للنظام وروابط التكامل الأساسية.</p>
          </div>
        </section>

        <section className="cards-list">
          {settings.map((item) => (
            <article className="mission-card" key={item.label}>
              <div className="card-line">
                <strong>{item.label}</strong>
              </div>
              <p>{item.value}</p>
            </article>
          ))}
        </section>
      </div>
    </DashboardShell>
  )
}
