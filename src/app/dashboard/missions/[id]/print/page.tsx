import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getDemoSessionEmail } from '@/lib/demo-session'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PrintButton } from './print-button'
import styles from './print.module.css'

type PageProps = {
  params: Promise<{ id: string }>
}

type Relation<T> = T | T[] | null

type MissionPrintRow = {
  id: string
  serial_number: string
  status: string | null
  priority: string | null
  scheduled_date: string
  destination_type: string | null
  visit_purpose: string | null
  notes: string | null
  created_at: string | null
  users: Relation<{ full_name: string; job_title: string | null; department: string | null }>
  creators: Relation<{ full_name: string; job_title: string | null; department: string | null }>
  facilities: Relation<{ name: string; facility_type: string | null; address: string | null }>
  governorates: Relation<{ name: string }>
  organizational_units: Relation<{ name: string }>
}

type DemoStoredMission = {
  destinationName: string
  destinationType: 'facility' | 'governorate'
  employeeNames: string
  endDate: string
  facilityType?: string | null
  id: string
  notes: string
  orgUnitName: string
  priority: string
  scheduledDate: string
  serialNumber: string
  status: string
  visitPurpose: string
}

function one<T>(value: Relation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatDate(value: string | null) {
  if (!value) return 'غير محدد'
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function priorityText(value: string | null) {
  if (value === 'urgent') return 'عاجلة'
  if (value === 'high') return 'مرتفعة'
  if (value === 'normal') return 'عادية'
  return value ?? 'غير محددة'
}

function statusText(value: string | null) {
  if (value === 'assigned') return 'مكلفة'
  if (value === 'in_progress') return 'قيد التنفيذ'
  if (value === 'completed') return 'مكتملة'
  if (value === 'draft') return 'مسودة'
  return value ?? 'غير محددة'
}

async function getDemoMission(id: string): Promise<DemoStoredMission | null> {
  const value = (await cookies()).get('maamouriyat_demo_missions')?.value
  if (!value) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(value))
    if (!Array.isArray(parsed)) return null
    return parsed.find((mission) => mission?.id === id) ?? null
  } catch {
    return null
  }
}

export default async function MissionPrintPage({ params }: PageProps) {
  const { id } = await params
  const demoEmail = await getDemoSessionEmail()
  const supabase = await createServerSupabaseClient()

  const signatureCookie = (await cookies()).get(`maamouriyat_demo_signature_${id}`)?.value
  const signatureImage = signatureCookie ? decodeURIComponent(signatureCookie) : null

  if (demoEmail) {
    const mission = await getDemoMission(id)
    if (!mission) {
      redirect('/dashboard/missions')
    }

    return (
      <main className={styles.screen}>
        <div className={styles.toolbar}>
          <Link href="/dashboard/missions">العودة للمأموريات</Link>
          <PrintButton />
        </div>

        <article className={styles.sheet}>
          <header className={styles.officialHeader}>
            <div>
              <strong>جمهورية مصر العربية</strong>
              <span>وزارة الصحة والسكان</span>
              <span>ديوان عام الوزارة</span>
            </div>
            <img alt="شعار وزارة الصحة والسكان المصرية" src="/mohp-logo.png" />
            <div>
              <strong>نظام إدارة المأموريات</strong>
              <span>قطاع الطب العلاجي</span>
              <span>نموذج تكليف رسمي</span>
            </div>
          </header>

          <section className={styles.titleBlock}>
            <p>تكليف مأمورية ميدانية</p>
            <h1>{mission.serialNumber}</h1>
          </section>

          <section className={styles.metaStrip}>
            <div>
              <span>تاريخ المأمورية</span>
              <strong>{formatDate(mission.scheduledDate)}</strong>
            </div>
            <div>
              <span>تاريخ الانتهاء المتوقع</span>
              <strong>{formatDate(mission.endDate)}</strong>
            </div>
            <div>
              <span>الحالة</span>
              <strong>مكلفة</strong>
            </div>
          </section>

          <section className={styles.section}>
            <h2>بيانات التكليف</h2>
            <dl className={styles.grid}>
              <div>
                <dt>فريق المأمورية</dt>
                <dd>{mission.employeeNames || 'غير محدد'}</dd>
              </div>
              <div>
                <dt>الإدارة المختصة</dt>
                <dd>{mission.orgUnitName || 'غير محددة'}</dd>
              </div>
              <div>
                <dt>نوع الوجهة</dt>
                <dd>{mission.destinationType === 'governorate' ? 'محافظة' : 'منشأة داخل المحافظة'}</dd>
              </div>
              <div>
                <dt>الوجهة</dt>
                <dd>{mission.destinationName}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.statement}>
            <h2>الغرض من المأمورية</h2>
            <p>{mission.visitPurpose || 'لا يوجد غرض مسجل.'}</p>
          </section>

          <section className={styles.statement}>
            <h2>تعليمات وملاحظات التكليف</h2>
            <p>{mission.notes || 'يلتزم فريق المأمورية بتنفيذ التكليف وتسجيل النتائج على النظام.'}</p>
          </section>

          <section className={styles.signatures}>
            <div>
              <span>فريق المأمورية</span>
              <strong style={{ fontSize: '13px', marginTop: '6px' }}>{mission.employeeNames}</strong>
              <span style={{ fontSize: '10px', color: '#2e7d32', fontWeight: 'bold', border: '1px dashed #2e7d32', padding: '2px 4px', borderRadius: '4px', background: '#f1f8e9', margin: '4px auto 0', width: 'fit-content' }}>🛡️ تم التوقيع رقمياً</span>
            </div>
            <div>
              <span>المدير المباشر</span>
              {signatureImage ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginTop: '4px' }}>
                  <img src={signatureImage} alt="توقيع المدير المعتمد" style={{ height: '36px', maxWidth: '120px', objectFit: 'contain' }} />
                  <span style={{ fontSize: '9px', color: '#ffb300', fontWeight: 'bold' }}>⭐ معتمد إلكترونياً</span>
                </div>
              ) : (
                <strong>الاسم / التوقيع</strong>
              )}
            </div>
            <div>
              <span>اعتماد جهة الإصدار</span>
              <strong>ختم النسر / التوقيع</strong>
            </div>
          </section>
        </article>
      </main>
    )
  }

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
    .from('missions')
    .select(`
      id,
      serial_number,
      status,
      priority,
      scheduled_date,
      destination_type,
      visit_purpose,
      notes,
      created_at,
      users:assigned_user_id(full_name, job_title, department),
      creators:created_by(full_name, job_title, department),
      facilities:target_facility_id(name, facility_type, address),
      governorates:target_governorate_id(name),
      organizational_units:org_unit_id(name)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    notFound()
  }

  const mission = data as unknown as MissionPrintRow
  const assignedUser = one(mission.users)
  const creator = one(mission.creators)
  const facility = one(mission.facilities)
  const governorate = one(mission.governorates)
  const orgUnit = one(mission.organizational_units)
  const destination =
    mission.destination_type === 'governorate'
      ? governorate?.name ?? 'محافظة غير محددة'
      : facility?.name ?? 'منشأة غير محددة'

  return (
    <main className={styles.screen}>
      <div className={styles.toolbar}>
        <Link href="/dashboard/missions">العودة للمأموريات</Link>
        <PrintButton />
      </div>

      <article className={styles.sheet}>
        <header className={styles.officialHeader}>
          <div>
            <strong>جمهورية مصر العربية</strong>
            <span>وزارة الصحة والسكان</span>
            <span>ديوان عام الوزارة</span>
          </div>
          <img alt="شعار وزارة الصحة والسكان المصرية" src="/mohp-logo.png" />
          <div>
            <strong>نظام إدارة المأموريات</strong>
            <span>قطاع الطب العلاجي</span>
            <span>نموذج تكليف رسمي</span>
          </div>
        </header>

        <section className={styles.titleBlock}>
          <p>تكليف مأمورية ميدانية</p>
          <h1>{mission.serial_number}</h1>
        </section>

        <section className={styles.metaStrip}>
          <div>
            <span>تاريخ المأمورية</span>
            <strong>{formatDate(mission.scheduled_date)}</strong>
          </div>
          <div>
            <span>الأولوية</span>
            <strong>{priorityText(mission.priority)}</strong>
          </div>
          <div>
            <span>الحالة</span>
            <strong>{statusText(mission.status)}</strong>
          </div>
        </section>

        <section className={styles.section}>
          <h2>بيانات التكليف</h2>
          <dl className={styles.grid}>
            <div>
              <dt>الموظف المكلف</dt>
              <dd>{assignedUser?.full_name ?? 'غير محدد'}</dd>
            </div>
            <div>
              <dt>الوظيفة / الإدارة</dt>
              <dd>{assignedUser?.job_title ?? assignedUser?.department ?? 'غير محدد'}</dd>
            </div>
            <div>
              <dt>الإدارة المختصة</dt>
              <dd>{orgUnit?.name ?? 'غير محددة'}</dd>
            </div>
            <div>
              <dt>مصدر التكليف</dt>
              <dd>{creator?.full_name ?? 'غير محدد'}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.section}>
          <h2>وجهة المأمورية</h2>
          <dl className={styles.grid}>
            <div>
              <dt>نوع الوجهة</dt>
              <dd>{mission.destination_type === 'governorate' ? 'محافظة' : 'منشأة محددة'}</dd>
            </div>
            <div>
              <dt>الوجهة</dt>
              <dd>{destination}</dd>
            </div>
            <div>
              <dt>نوع المنشأة</dt>
              <dd>{facility?.facility_type ?? 'غير محدد'}</dd>
            </div>
            <div>
              <dt>العنوان</dt>
              <dd>{facility?.address ?? governorate?.name ?? 'غير محدد'}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.statement}>
          <h2>الغرض من المأمورية</h2>
          <p>{mission.visit_purpose || 'لا يوجد غرض مسجل.'}</p>
        </section>

        <section className={styles.statement}>
          <h2>تعليمات وملاحظات التكليف</h2>
          <p>{mission.notes || 'يلتزم المكلف بتنفيذ المأمورية في التاريخ المحدد وتسجيل النتائج على النظام فور الانتهاء.'}</p>
        </section>

        <section className={styles.signatures}>
          <div>
            <span>الموظف المكلف</span>
            <strong style={{ fontSize: '13px', marginTop: '6px' }}>{assignedUser?.full_name ?? 'غير محدد'}</strong>
            <span style={{ fontSize: '10px', color: '#2e7d32', fontWeight: 'bold', border: '1px dashed #2e7d32', padding: '2px 4px', borderRadius: '4px', background: '#f1f8e9', margin: '4px auto 0', width: 'fit-content' }}>🛡️ تم التوقيع رقمياً</span>
          </div>
          <div>
            <span>مدير الإدارة المختصة</span>
            {signatureImage ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginTop: '4px' }}>
                <img src={signatureImage} alt="توقيع المدير المعتمد" style={{ height: '36px', maxWidth: '120px', objectFit: 'contain' }} />
                <span style={{ fontSize: '9px', color: '#ffb300', fontWeight: 'bold' }}>⭐ معتمد إلكترونياً</span>
              </div>
            ) : (
              <strong>الاسم / التوقيع</strong>
            )}
          </div>
          <div>
            <span>اعتماد جهة الإصدار</span>
            <strong>الختم / التوقيع</strong>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>تم إنشاء النموذج من نظام إدارة المأموريات بتاريخ {formatDate(mission.created_at)}</span>
          <span>هذا المستند للاستخدام الرسمي داخل منظومة وزارة الصحة والسكان.</span>
        </footer>
      </article>
    </main>
  )
}
