import { DashboardShell } from '../../system-ui'

const users = [
  { name: 'مدير النظام', email: 'admin@mohp.gov.eg', level: 'المستوى 1' },
  { name: 'مدير التفتيش', email: 'director@mohp.gov.eg', level: 'المستوى 3' },
  { name: 'مشرف المأموريات', email: 'supervisor@mohp.gov.eg', level: 'المستوى 5' },
  { name: 'مفتش صحي', email: 'inspector@mohp.gov.eg', level: 'المستوى 7' },
]

export default function UsersPage() {
  return (
    <DashboardShell view="dashboard">
      <div className="stack">
        <section className="welcome-band">
          <div>
            <p className="eyebrow">إدارة الوصول</p>
            <h2>المستخدمون</h2>
            <p>عرض الحسابات الأساسية المستخدمة في اختبار صلاحيات النظام.</p>
          </div>
        </section>

        <section className="cards-list">
          {users.map((user) => (
            <article className="mission-card" key={user.email}>
              <div className="card-line">
                <strong>{user.name}</strong>
                <span className="pill green">{user.level}</span>
              </div>
              <p>{user.email}</p>
            </article>
          ))}
        </section>
      </div>
    </DashboardShell>
  )
}
