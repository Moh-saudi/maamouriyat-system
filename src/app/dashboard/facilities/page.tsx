import { DashboardShell } from '../../system-ui'

const facilities = [
  { name: 'مستشفى النيل العام', type: 'مستشفى عام', governorate: 'القاهرة', status: 'نشطة' },
  { name: 'مستشفى الرحمة الخاصة', type: 'مستشفى خاص', governorate: 'الجيزة', status: 'نشطة' },
  { name: 'معمل المختار للتحاليل', type: 'معمل تحاليل', governorate: 'القاهرة', status: 'تحت المتابعة' },
]

export default function FacilitiesPage() {
  return (
    <DashboardShell view="dashboard">
      <div className="stack">
        <section className="welcome-band">
          <div>
            <p className="eyebrow">دليل المنشآت</p>
            <h2>المنشآت الصحية</h2>
            <p>متابعة المنشآت المرتبطة بالمأموريات وحالة كل منشأة داخل نطاق التفتيش.</p>
          </div>
        </section>

        <section className="cards-list">
          {facilities.map((facility) => (
            <article className="mission-card" key={facility.name}>
              <div className="card-line">
                <strong>{facility.name}</strong>
                <span className="pill blue">{facility.status}</span>
              </div>
              <div className="meta-grid">
                <span>{facility.type}</span>
                <span>{facility.governorate}</span>
              </div>
            </article>
          ))}
        </section>
      </div>
    </DashboardShell>
  )
}
