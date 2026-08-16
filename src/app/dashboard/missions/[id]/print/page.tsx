import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
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

export default async function MissionPrintPage({ params }: PageProps) {
  const { id } = await params
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

  const signatureCookie = (await cookies()).get(`maamouriyat_signature_${id}`)?.value
  const signatureImage = signatureCookie ? decodeURIComponent(signatureCookie) : null

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
      sector_id,
      users:assigned_user_id(full_name, job_title, department),
      creators:created_by(full_name, job_title, department),
      facilities:target_facility_id(name, facility_type, address, governorate, health_admin),
      sectors:sector_id(name)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return (
      <main className={styles.screen}>
        <div style={{ maxWidth: '600px', margin: '60px auto', background: 'white', border: '1px solid #cfdcde', borderRadius: '12px', padding: '32px', textAlign: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ color: '#c62828', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>المأمورية غير موجودة أو غير مصرح بالاطلاع عليها</h2>
          <p style={{ color: '#546e7a', fontSize: '13.5px', lineHeight: '1.6', marginBottom: '24px' }}>
            نظراً لتطبيق نظام الحوكمة والعزل الإداري الصارم بين القطاعات، لا يمكن طباعة أو استعراض مأموريات تابعة لقطاع تنظيمي آخر.
          </p>
          <Link
            href="/dashboard/missions"
            style={{
              background: '#006d77',
              color: 'white',
              padding: '10px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            ← العودة لجدول مأموريات قطاعك
          </Link>
        </div>
      </main>
    )
  }

  const mission = data as unknown as MissionPrintRow
  const assignedUser = one(mission.users)
  const creator = one(mission.creators)
  const facility = one(mission.facilities) as any
  const rawSectors = (data as any)?.sectors
  const sectorName = Array.isArray(rawSectors) ? rawSectors[0]?.name : rawSectors?.name
  const assignedDept = assignedUser?.department || sectorName || 'ديوان عام وزارة الصحة والسكان'
  const issuingOrg = creator?.department || sectorName || 'ديوان عام الوزارة'

  const destination =
    mission.destination_type === 'governorate'
      ? facility?.governorate ?? 'جمهورية مصر العربية'
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
            <span>{sectorName || 'ديوان عام الوزارة'}</span>
            {issuingOrg && issuingOrg !== sectorName && <strong>{issuingOrg}</strong>}
          </div>
          <img alt="شعار وزارة الصحة والسكان المصرية" src="/mohp-logo.png" />
          <div>
            <strong>نظام حوكمة المأمورية الميدانية</strong>
            <span>وثيقة تكليف وتقرير مروري معتمد</span>
            <span>رقم التكليف: {mission.serial_number}</span>
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
              <dd>{assignedDept}</dd>
            </div>
            <div>
              <dt>مصدر التكليف</dt>
              <dd>{issuingOrg}</dd>
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
              <dd>{facility?.address ?? facility?.governorate ?? 'غير محدد'}</dd>
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
          <span>تم إنشاء النموذج من نظام حوكمة المأمورية الميدانية بتاريخ {formatDate(mission.created_at)}</span>
          <span>هذا المستند للاستخدام الرسمي داخل منظومة وزارة الصحة والسكان.</span>
        </footer>
      </article>
    </main>
  )
}
