'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  WalletCards,
  XCircle,
} from 'lucide-react'

type Settlement = {
  id: string
  mission_id: string
  assignment_batch_id: string | null
  is_grouped: boolean
  batch_mission_count: number
  report_href: string | null
  user_id: string
  status: 'pending_review' | 'prepared' | 'approved' | 'rejected' | 'paid'
  currency: string
  mission_days: number
  overnight_nights: number
  fixed_amount: number
  daily_rate: number
  daily_amount: number
  overnight_rate: number
  overnight_amount: number
  bonus_amount: number
  adjustment_amount: number
  total_amount: number
  notes: string | null
  rejection_reason: string | null
  payment_reference: string | null
  mission_serial_number: string
  beneficiary_name: string
  beneficiary_job_title: string | null
  beneficiary_financial_code: string | null
  claim_number: string | null
  claim_status: string | null
  claim_submitted_at: string | null
  accommodation_type: string | null
  accommodation_details: string | null
  accommodation_cost_claimed: number
  transport_mode: string | null
  departure_location: string | null
  return_location: string | null
  transport_details: string | null
  transport_cost_claimed: number
  facility_name: string
  health_admin: string | null
  governorate: string | null
  scheduled_date: string | null
  expected_end_date: string | null
  actual_start_date: string | null
  actual_end_date: string | null
  actual_duration_days: number | null
  actual_overnight_nights: number | null
  completion_disposition: string | null
  timing_adjustment_reason: string | null
  completed_at: string | null
  checkin_time: string | null
  checkout_time: string | null
  gps_verified: boolean
  duration_minutes: number | null
}

type Permissions = {
  prepare: boolean
  approve: boolean
  reject: boolean
  mark_paid: boolean
}

type FormState = {
  mission_days: string
  overnight_nights: string
  fixed_amount: string
  daily_rate: string
  overnight_rate: string
  bonus_amount: string
  adjustment_amount: string
  notes: string
}

const STATUS_LABELS: Record<Settlement['status'], string> = {
  pending_review: 'بانتظار المراجعة',
  prepared: 'تم إعداد التسوية',
  approved: 'معتمد ماليًا',
  rejected: 'مرفوض / معاد',
  paid: 'تم الصرف',
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function toForm(settlement: Settlement): FormState {
  return {
    mission_days: String(settlement.mission_days),
    overnight_nights: String(settlement.overnight_nights),
    fixed_amount: String(settlement.fixed_amount),
    daily_rate: String(settlement.daily_rate),
    overnight_rate: String(settlement.overnight_rate),
    bonus_amount: String(settlement.bonus_amount),
    adjustment_amount: String(settlement.adjustment_amount),
    notes: settlement.notes ?? '',
  }
}

export function FinanceSettlementsPanel() {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [permissions, setPermissions] = useState<Permissions>({
    prepare: false,
    approve: false,
    reject: false,
    mark_paid: false,
  })
  const [statusFilter, setStatusFilter] = useState<'all' | Settlement['status']>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [paymentReference, setPaymentReference] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/v2/finance/settlements', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const payload = (await response.json()) as {
        settlements?: Settlement[]
        permissions?: Permissions
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل الاستحقاقات المالية')
      }

      const rows = payload.settlements ?? []
      setSettlements(rows)
      setPermissions(
        payload.permissions ?? {
          prepare: false,
          approve: false,
          reject: false,
          mark_paid: false,
        }
      )

      if (selectedId) {
        const refreshed = rows.find((row) => row.id === selectedId)
        if (refreshed) setForm(toForm(refreshed))
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'تعذر تحميل الاستحقاقات المالية'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? settlements
        : settlements.filter((row) => row.status === statusFilter),
    [settlements, statusFilter]
  )

  const selected = settlements.find((row) => row.id === selectedId) ?? null

  function openSettlement(row: Settlement) {
    setSelectedId(row.id)
    setForm(toForm(row))
    setReason('')
    setPaymentReference(row.payment_reference ?? '')
  }

  async function perform(action: 'prepare' | 'approve' | 'reject' | 'mark_paid') {
    if (!selected) return

    setSaving(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        settlement_id: selected.id,
        action,
      }

      if (action === 'prepare' && form) {
        Object.assign(body, form)
      }

      if (action === 'reject') body.reason = reason
      if (action === 'mark_paid') body.payment_reference = paymentReference

      const response = await fetch('/api/v2/finance/settlements', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحديث التسوية المالية')
      }

      await load()
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'تعذر تحديث التسوية المالية'
      )
    } finally {
      setSaving(false)
    }
  }

  const totals = useMemo(() => {
    return settlements.reduce(
      (acc, row) => {
        acc.count += 1
        if (row.status === 'approved') acc.approved += row.total_amount
        if (row.status === 'paid') acc.paid += row.total_amount
        if (row.status === 'pending_review' || row.status === 'prepared') {
          acc.pending += 1
        }
        return acc
      },
      { count: 0, pending: 0, approved: 0, paid: 0 }
    )
  }, [settlements])

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ تحميل الاستحقاقات المالية...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold text-slate-400">إجمالي الاستحقاقات</p>
          <p className="mt-1 text-xl font-black text-slate-900">
            {totals.count.toLocaleString('en-US')}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold text-slate-400">بانتظار الإجراء</p>
          <p className="mt-1 text-xl font-black text-amber-700">
            {totals.pending.toLocaleString('en-US')}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold text-slate-400">معتمد ولم يصرف</p>
          <p className="mt-1 text-xl font-black text-teal-800">
            {money(totals.approved)} ج.م
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold text-slate-400">تم صرفه</p>
          <p className="mt-1 text-xl font-black text-emerald-700">
            {money(totals.paid)} ج.م
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              ['all', 'الكل'],
              ['pending_review', 'بانتظار المراجعة'],
              ['prepared', 'معدة'],
              ['approved', 'معتمدة'],
              ['paid', 'تم الصرف'],
              ['rejected', 'مرفوضة'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setStatusFilter(value as 'all' | Settlement['status'])
                }
                className={
                  'rounded-full px-2.5 py-1.5 text-[9px] font-bold ' +
                  (statusFilter === value
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200')
                }
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-bold text-slate-600"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <WalletCards className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-600">
              لا توجد استحقاقات في هذه الحالة
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => openSettlement(row)}
                className="grid w-full gap-2 px-4 py-3 text-right hover:bg-slate-50 sm:grid-cols-[1.3fr_1fr_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold text-slate-900">
                    {row.beneficiary_name}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-slate-400">
                    {row.claim_number ? row.claim_number + ' · ' : ''}{row.mission_serial_number} · {row.facility_name}
                    {row.is_grouped ? ' · تسوية واحدة للتكليف' : ''}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-500">
                    {STATUS_LABELS[row.status]}
                  </p>
                  <p className="mt-1 text-[9px] text-slate-400">
                    {row.health_admin || row.governorate || 'نطاق غير مسمى'}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-slate-900">
                    {money(row.total_amount)} ج.م
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && form && (
        <section className="rounded-2xl border border-teal-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-teal-100 bg-teal-50/50 p-4">
            <div>
              <p className="text-[10px] font-bold text-teal-700">
                {STATUS_LABELS[selected.status]}
              </p>
              <h2 className="mt-1 text-sm font-black text-slate-900">
                {selected.beneficiary_name}
              </h2>
              <p className="mt-1 text-[10px] text-slate-500">
                {selected.mission_serial_number} · {selected.facility_name}
              </p>
              {selected.claim_number && (
                <p className="mt-1 text-[10px] font-black text-blue-700">
                  طلب {selected.claim_number} · الكود المالي {selected.beneficiary_financial_code || 'غير مسجل'}
                </p>
              )}
              {selected.is_grouped && (
                <span className="mt-1 inline-flex rounded-full bg-violet-50 px-2 py-1 text-[8px] font-black text-violet-700">
                  تكليف مجمع · استحقاق واحد لكل عضو فريق
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selected.report_href && (
                <Link
                  href={selected.report_href}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
                >
                  تقرير المأمورية
                </Link>
              )}
              <Link
                href={'/v2/finance/report/' + selected.id}
                className="inline-flex h-8 items-center rounded-lg border border-teal-200 bg-white px-2.5 text-[10px] font-bold text-teal-800 hover:bg-teal-50"
              >
                بيان الاستحقاق
              </Link>
              <p className="text-lg font-black text-slate-900">
                {money(selected.total_amount)} ج.م
              </p>
            </div>
          </div>

          <div className="p-4">
            {selected.claim_number && (
              <div className="mb-4 grid gap-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-[9px] font-bold text-slate-400">وسيلة الانتقال</p><p className="mt-1 text-[11px] font-extrabold text-slate-700">{selected.transport_mode || '—'}</p></div>
                <div><p className="text-[9px] font-bold text-slate-400">خط السير</p><p className="mt-1 text-[11px] font-extrabold text-slate-700">{selected.departure_location || '—'} ← {selected.return_location || '—'}</p></div>
                <div><p className="text-[9px] font-bold text-slate-400">الإقامة</p><p className="mt-1 text-[11px] font-extrabold text-slate-700">{selected.accommodation_type || '—'}{selected.accommodation_details ? ' · ' + selected.accommodation_details : ''}</p></div>
                <div><p className="text-[9px] font-bold text-slate-400">تكاليف مطلوبة للمراجعة</p><p className="mt-1 text-[11px] font-extrabold text-blue-800">مواصلات {money(selected.transport_cost_claimed)} · إقامة {money(selected.accommodation_cost_claimed)} ج.م</p></div>
                {selected.transport_details && <p className="text-[10px] text-slate-600 sm:col-span-2 lg:col-span-4"><span className="font-black">تفاصيل الانتقال:</span> {selected.transport_details}</p>}
              </div>
            )}
            {selected.is_grouped ? (
              <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-violet-50 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-violet-600">نوع التكليف</p>
                  <p className="mt-1 text-[11px] font-extrabold text-violet-800">
                    مأمورية مجمعة
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-slate-400">عدد المنشآت</p>
                  <p className="mt-1 text-[11px] font-extrabold text-slate-700">
                    {selected.batch_mission_count.toLocaleString('en-US')} منشأة
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-slate-400">المحافظة</p>
                  <p className="mt-1 text-[11px] font-extrabold text-slate-700">
                    {selected.governorate || 'غير محددة'}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-emerald-600">مصدر الأيام</p>
                  <p className="mt-1 text-[11px] font-extrabold text-emerald-800">
                    المدة الفعلية للتكليف
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-slate-400">تنفيذ GPS</p>
                  <p className={
                    'mt-1 text-[11px] font-extrabold ' +
                    (selected.gps_verified ? 'text-emerald-700' : 'text-amber-700')
                  }>
                    {selected.gps_verified ? 'تم التحقق' : 'غير موثق بالـ GPS'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-slate-400">بدء الزيارة</p>
                  <p className="mt-1 text-[11px] font-extrabold text-slate-700">
                    {selected.checkin_time
                      ? new Date(selected.checkin_time).toLocaleString('ar-EG')
                      : 'غير مسجل'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-slate-400">انتهاء الزيارة</p>
                  <p className="mt-1 text-[11px] font-extrabold text-slate-700">
                    {selected.checkout_time
                      ? new Date(selected.checkout_time).toLocaleString('ar-EG')
                      : 'غير مسجل'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-slate-400">مدة التنفيذ</p>
                  <p className="mt-1 text-[11px] font-extrabold text-slate-700">
                    {selected.duration_minutes != null
                      ? selected.duration_minutes.toLocaleString('en-US') + ' دقيقة'
                      : 'غير مسجلة'}
                  </p>
                </div>
              </div>
            )}

            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[9px] font-bold text-slate-400">المدة المقدرة بالتكليف</p>
                  <p className="mt-1 text-[11px] font-extrabold text-slate-700">
                    {selected.scheduled_date || '—'} ← {selected.expected_end_date || selected.scheduled_date || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-emerald-600">المدة الفعلية المعتمدة</p>
                  <p className="mt-1 text-[11px] font-extrabold text-emerald-800">
                    {selected.actual_start_date || '—'} ← {selected.actual_end_date || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400">الاستحقاق الزمني</p>
                  <p className="mt-1 text-[11px] font-extrabold text-slate-700">
                    {(selected.actual_duration_days ?? selected.mission_days).toLocaleString('en-US')} يوم
                    {' · '}
                    {(selected.actual_overnight_nights ?? selected.overnight_nights).toLocaleString('en-US')} ليلة
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400">بعد انتهاء المأمورية</p>
                  <p className="mt-1 text-[11px] font-extrabold text-slate-700">
                    {selected.completion_disposition === 'return_to_base'
                      ? 'العودة لمقر العمل'
                      : selected.completion_disposition === 'next_mission'
                        ? 'الانتقال لمأمورية أخرى'
                        : selected.completion_disposition === 'other'
                          ? 'إجراء آخر'
                          : 'غير محدد'}
                  </p>
                </div>
              </div>
              {selected.timing_adjustment_reason && (
                <p className="mt-2 border-t border-emerald-100 pt-2 text-[10px] text-amber-800">
                  <span className="font-black">سبب تعديل المدة:</span>{' '}
                  {selected.timing_adjustment_reason}
                </p>
              )}
            </div>

            {permissions.prepare &&
              selected.status !== 'approved' &&
              selected.status !== 'paid' && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['mission_days', 'عدد الأيام'],
                    ['overnight_nights', 'ليالي المبيت'],
                    ['fixed_amount', 'قيمة ثابتة'],
                    ['daily_rate', 'بدل اليوم'],
                    ['overnight_rate', 'بدل الليلة'],
                    ['bonus_amount', 'مكافأة'],
                    ['adjustment_amount', 'تسوية +/-'],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <span className="mb-1 block text-[10px] font-bold text-slate-600">
                        {label}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={form[key as keyof FormState]}
                        onChange={(event) =>
                          setForm((current) =>
                            current
                              ? { ...current, [key]: event.target.value }
                              : current
                          )
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-teal-500"
                      />
                    </label>
                  ))}

                  <label className="sm:col-span-2 lg:col-span-4">
                    <span className="mb-1 block text-[10px] font-bold text-slate-600">
                      ملاحظات التسوية
                    </span>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, notes: event.target.value }
                            : current
                        )
                      }
                      className="w-full resize-none rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-teal-500"
                    />
                  </label>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void perform('prepare')}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal-700 px-3 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      حفظ وإعداد التسوية
                    </button>
                  </div>
                </div>
              )}

            {selected.status === 'prepared' &&
              (permissions.approve || permissions.reject) && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    {permissions.approve && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void perform('approve')}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        اعتماد مالي
                      </button>
                    )}
                    {permissions.reject && (
                      <>
                        <input
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="سبب الرفض أو الإعادة"
                          className="h-9 min-w-56 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-rose-400"
                        />
                        <button
                          type="button"
                          disabled={saving || !reason.trim()}
                          onClick={() => void perform('reject')}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-[11px] font-bold text-rose-700 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          رفض / إعادة
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

            {selected.status === 'approved' && permissions.mark_paid && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold text-emerald-800">
                    مرجع الصرف / رقم المستند
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={paymentReference}
                      onChange={(event) =>
                        setPaymentReference(event.target.value)
                      }
                      className="h-9 min-w-60 flex-1 rounded-xl border border-emerald-200 bg-white px-3 text-xs outline-none"
                      placeholder="مثال: أمر صرف 1234/2026"
                    />
                    <button
                      type="button"
                      disabled={saving || !paymentReference.trim()}
                      onClick={() => void perform('mark_paid')}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      <Banknote className="h-3.5 w-3.5" />
                      تسجيل الصرف
                    </button>
                  </div>
                </label>
              </div>
            )}

            {selected.status === 'paid' && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[11px] font-bold text-emerald-800">
                تم صرف الاستحقاق
                {selected.payment_reference
                  ? ' · المرجع: ' + selected.payment_reference
                  : ''}
              </div>
            )}

            {selected.status === 'rejected' && selected.rejection_reason && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-[11px] text-rose-800">
                سبب الرفض: {selected.rejection_reason}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
