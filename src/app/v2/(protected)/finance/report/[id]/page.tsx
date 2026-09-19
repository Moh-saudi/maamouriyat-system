import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowRight, FileText } from 'lucide-react'
import { FinancePrintButton } from '@/features/finance/components/FinancePrintButton'
import { checkV2ResourceAccess } from '@/server/authorization'
import { requireV2PagePermission } from '@/server/authorization/page-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function statusLabel(status: string) {
  if (status === 'paid') return 'تم الصرف'
  if (status === 'approved') return 'معتمد ماليًا'
  if (status === 'prepared') return 'تم إعداد التسوية'
  if (status === 'rejected') return 'مرفوض / معاد للمراجعة'
  return 'بانتظار المراجعة'
}

export default async function FinanceSettlementReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { user, access } = await requireV2PagePermission('finance.view')
  const { id } = await params
  const admin = getAdminSupabaseClient()

  const { data: settlement, error } = await admin
    .from('mission_financial_settlements')
    .select(
      'id, mission_id, assignment_batch_id, user_id, scope_org_id, status, currency, mission_days, overnight_nights, fixed_amount, daily_rate, daily_amount, overnight_rate, overnight_amount, bonus_amount, adjustment_amount, total_amount, notes, rejection_reason, payment_reference, prepared_at, approved_at, paid_at, created_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(
      `Failed to load finance settlement report: ${error.message}`
    )
  }

  if (!settlement) notFound()

  const { data: scopeOrg } = await admin
    .from('organizations')
    .select('id, sector_id, governorate, organization_type_code')
    .eq('id', settlement.scope_org_id)
    .maybeSingle()

  if (!scopeOrg) redirect('/v2/access-denied')

  const decision = await checkV2ResourceAccess({
    user,
    snapshot: access,
    permissionKey: 'finance.view',
    resource: {
      organizationId: String(scopeOrg.id),
      sectorId:
        scopeOrg.organization_type_code === 'sector'
          ? String(scopeOrg.id)
          : scopeOrg.sector_id
            ? String(scopeOrg.sector_id)
            : null,
      governorate:
        typeof scopeOrg.governorate === 'string'
          ? scopeOrg.governorate
          : null,
    },
  })

  if (!decision.allowed) redirect('/v2/access-denied')

  const [
    { data: mission },
    { data: beneficiary },
    { data: batch },
  ] = await Promise.all([
    admin
      .from('missions')
      .select(
        'id, serial_number, facility_id, scheduled_date, expected_end_date, completed_at, visit_purpose, status'
      )
      .eq('id', settlement.mission_id)
      .maybeSingle(),
    admin
      .from('users')
      .select('id, full_name, job_title, organization_id')
      .eq('id', settlement.user_id)
      .maybeSingle(),
    settlement.assignment_batch_id
      ? admin
          .from('mission_assignment_batches')
          .select(
            'id, scheduled_date, expected_end_date, actual_start_date, actual_end_date, actual_duration_days, actual_overnight_nights, completion_disposition, timing_adjustment_reason, mission_count, visit_purpose, status'
          )
          .eq('id', settlement.assignment_batch_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (!mission || !beneficiary) notFound()

  const { data: facility } = await admin
    .from('facilities')
    .select('id, name, health_admin, governorate')
    .eq('id', mission.facility_id)
    .maybeSingle()

  const isGrouped = Boolean(batch && settlement.assignment_batch_id)
  const missionReference = isGrouped
    ? 'تكليف مجمع ' +
      String(settlement.assignment_batch_id).slice(0, 8).toUpperCase()
    : String(mission.serial_number)
  const plannedStart = isGrouped
    ? String(batch?.scheduled_date || '')
    : String(mission.scheduled_date || '')
  const plannedEnd = isGrouped
    ? String(batch?.expected_end_date || batch?.scheduled_date || '')
    : String(mission.expected_end_date || mission.scheduled_date || '')
  const actualStart = isGrouped
    ? String(batch?.actual_start_date || '')
    : ''
  const actualEnd = isGrouped
    ? String(batch?.actual_end_date || '')
    : ''
  const missionPurpose = isGrouped
    ? String(batch?.visit_purpose || '')
    : String(mission.visit_purpose || '')

  const lineItems = [
    {
      label: 'قيمة ثابتة للمأمورية',
      quantity: 1,
      rate: Number(settlement.fixed_amount || 0),
      amount: Number(settlement.fixed_amount || 0),
    },
    {
      label: 'بدل الأيام',
      quantity: Number(settlement.mission_days || 0),
      rate: Number(settlement.daily_rate || 0),
      amount: Number(settlement.daily_amount || 0),
    },
    {
      label: 'بدل المبيت',
      quantity: Number(settlement.overnight_nights || 0),
      rate: Number(settlement.overnight_rate || 0),
      amount: Number(settlement.overnight_amount || 0),
    },
    {
      label: 'مكافأة إضافية',
      quantity: 1,
      rate: Number(settlement.bonus_amount || 0),
      amount: Number(settlement.bonus_amount || 0),
    },
    {
      label: 'تسوية / تعديل',
      quantity: 1,
      rate: Number(settlement.adjustment_amount || 0),
      amount: Number(settlement.adjustment_amount || 0),
    },
  ].filter((item) => item.amount !== 0)

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-screen max-w-5xl bg-white px-4 py-6 text-slate-900 sm:px-8 print:max-w-none print:p-0"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/v2/finance"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[11px] font-bold text-slate-600"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          العودة للاستحقاقات
        </Link>
        <FinancePrintButton />
      </div>

      <section className="rounded-2xl border border-slate-300 p-6 print:rounded-none print:border-slate-400">
        <header className="border-b-2 border-slate-900 pb-5 text-center">
          <p className="text-xs font-bold text-slate-500">
            منظومة المأموريات والمرور الميداني
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <FileText className="h-5 w-5" />
            <h1 className="text-xl font-black">بيان استحقاق مالي لمأمورية</h1>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {isGrouped ? 'مرجع التكليف' : 'رقم المأمورية'}: {missionReference}
          </p>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ['المستفيد', beneficiary.full_name],
            ['المسمى الوظيفي', beneficiary.job_title || 'غير مسجل'],
            [
              isGrouped ? 'نوع التكليف' : 'المنشأة',
              isGrouped
                ? 'تكليف مجمع · ' +
                  Number(batch?.mission_count || 0).toLocaleString('en-US') +
                  ' منشأة'
                : facility?.name || 'غير متاح',
            ],
            [
              'النطاق',
              facility?.governorate ||
                facility?.health_admin ||
                'غير مسجل',
            ],
            ['المدة المقدرة من', plannedStart || '—'],
            ['المدة المقدرة إلى', plannedEnd || '—'],
            [
              'المدة الفعلية',
              isGrouped
                ? (actualStart || '—') + ' ← ' + (actualEnd || '—')
                : String(settlement.mission_days || 0) + ' يوم',
            ],
            [
              'الأيام / ليالي المبيت',
              Number(settlement.mission_days || 0).toLocaleString('en-US') +
                ' يوم · ' +
                Number(settlement.overnight_nights || 0).toLocaleString('en-US') +
                ' ليلة',
            ],
            ['حالة التسوية', statusLabel(String(settlement.status))],
            ['العملة', 'الجنيه المصري (EGP)'],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-slate-200 px-3 py-2.5"
            >
              <p className="text-[10px] font-bold text-slate-400">{label}</p>
              <p className="mt-1 text-xs font-extrabold text-slate-800">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-300">
          <table className="w-full border-collapse text-right text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="border-b border-slate-300 px-3 py-2.5">
                  بند الاستحقاق
                </th>
                <th className="border-b border-slate-300 px-3 py-2.5">
                  الكمية
                </th>
                <th className="border-b border-slate-300 px-3 py-2.5">
                  سعر الوحدة
                </th>
                <th className="border-b border-slate-300 px-3 py-2.5">
                  الإجمالي
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length > 0 ? (
                lineItems.map((item) => (
                  <tr key={item.label}>
                    <td className="border-b border-slate-100 px-3 py-2.5 font-bold">
                      {item.label}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5">
                      {item.quantity.toLocaleString('en-US')}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5">
                      {money(item.rate)} ج.م
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 font-black">
                      {money(item.amount)} ج.م
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    لم يتم إدخال بنود مالية لهذه التسوية حتى الآن.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white">
                <td colSpan={3} className="px-3 py-3 font-black">
                  إجمالي الاستحقاق
                </td>
                <td className="px-3 py-3 text-base font-black">
                  {money(Number(settlement.total_amount || 0))} ج.م
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {missionPurpose && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold text-slate-400">
              غرض المأمورية
            </p>
            <p className="mt-1 text-xs leading-6 text-slate-700">
              {missionPurpose}
            </p>
          </div>
        )}

        {isGrouped && settlement.assignment_batch_id && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
            <div>
              <p className="text-[10px] font-black text-violet-800">
                هذا الاستحقاق يخص التكليف المجمع كله
              </p>
              <p className="mt-1 text-[9px] text-violet-700">
                لا يتم تكرار الأيام أو البدلات لكل منشأة داخل التكليف.
              </p>
            </div>
            <Link
              href={
                '/v2/missions/assignments/' +
                settlement.assignment_batch_id +
                '/report'
              }
              className="inline-flex h-8 items-center rounded-lg border border-violet-200 bg-white px-2.5 text-[10px] font-bold text-violet-800 print:hidden"
            >
              تقرير التكليف
            </Link>
          </div>
        )}

        {settlement.notes && (
          <div className="mt-3 rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-[10px] font-bold text-slate-400">
              ملاحظات التسوية
            </p>
            <p className="mt-1 text-xs leading-6 text-slate-700">
              {settlement.notes}
            </p>
          </div>
        )}

        {settlement.rejection_reason && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
            سبب الرفض/الإعادة: {settlement.rejection_reason}
          </div>
        )}

        {settlement.payment_reference && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
            مرجع الصرف: {settlement.payment_reference}
          </div>
        )}

        <footer className="mt-8 grid gap-8 border-t border-slate-200 pt-6 text-center text-xs sm:grid-cols-3">
          <div>
            <p className="font-bold">إعداد التسوية</p>
            <div className="mx-auto mt-8 w-36 border-t border-slate-400 pt-1 text-[10px] text-slate-400">
              التوقيع
            </div>
          </div>
          <div>
            <p className="font-bold">المراجعة والاعتماد المالي</p>
            <div className="mx-auto mt-8 w-36 border-t border-slate-400 pt-1 text-[10px] text-slate-400">
              التوقيع
            </div>
          </div>
          <div>
            <p className="font-bold">الصرف</p>
            <div className="mx-auto mt-8 w-36 border-t border-slate-400 pt-1 text-[10px] text-slate-400">
              التوقيع / الختم
            </div>
          </div>
        </footer>
      </section>
    </main>
  )
}
