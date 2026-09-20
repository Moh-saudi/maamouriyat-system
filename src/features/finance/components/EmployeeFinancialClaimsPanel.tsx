'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Banknote, CheckCircle2, Loader2, Send, WalletCards } from 'lucide-react'

type EligibleBatch = {
  id: string
  actual_start_date: string
  actual_end_date: string
  actual_duration_days: number
  actual_overnight_nights: number
  mission_count: number
  visit_purpose: string
  governorate: string | null
  health_admins: string[]
  facilities: string[]
}

type ClaimItem = {
  id: string
  governorate: string
  destination_summary: string
  actual_start_date: string
  actual_end_date: string
  actual_duration_days: number
  overnight_nights: number
  transport_mode: string
  accommodation_type: string
}

type Claim = {
  id: string
  claim_number: string
  status: string
  submitted_at: string
  return_reason: string | null
  items: ClaimItem[]
}

type ItemForm = {
  accommodation_type: string
  accommodation_details: string
  accommodation_cost_claimed: string
  transport_mode: string
  departure_location: string
  return_location: string
  transport_details: string
  transport_cost_claimed: string
  employee_notes: string
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'مرسل للمالية', under_review: 'قيد المراجعة', returned: 'مُعاد للاستكمال',
  approved: 'معتمد', paid: 'تم الصرف', cancelled: 'ملغي',
}

function date(value: string) {
  return new Intl.DateTimeFormat('en-GB').format(new Date(value + 'T00:00:00'))
}

function emptyForm(): ItemForm {
  return {
    accommodation_type: 'none', accommodation_details: '', accommodation_cost_claimed: '0',
    transport_mode: '', departure_location: '', return_location: '', transport_details: '',
    transport_cost_claimed: '0', employee_notes: '',
  }
}

export function EmployeeFinancialClaimsPanel() {
  const [eligible, setEligible] = useState<EligibleBatch[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [selected, setSelected] = useState<Record<string, ItemForm>>({})
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/v2/finance/claims', { cache: 'no-store', credentials: 'same-origin' })
      const payload = await response.json() as { eligible?: EligibleBatch[]; claims?: Claim[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'تعذر تحميل الطلبات')
      setEligible(payload.eligible ?? [])
      setClaims(payload.claims ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل الطلبات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const selectedCount = Object.keys(selected).length
  const totals = useMemo(() => Object.keys(selected).reduce((sum, id) => {
    const row = eligible.find((batch) => batch.id === id)
    return { days: sum.days + (row?.actual_duration_days ?? 0), nights: sum.nights + (row?.actual_overnight_nights ?? 0) }
  }, { days: 0, nights: 0 }), [eligible, selected])

  function toggle(batchId: string) {
    setSelected((current) => {
      const next = { ...current }
      if (next[batchId]) delete next[batchId]
      else next[batchId] = emptyForm()
      return next
    })
  }

  function update(batchId: string, key: keyof ItemForm, value: string) {
    setSelected((current) => ({ ...current, [batchId]: { ...current[batchId], [key]: value } }))
  }

  async function submit() {
    const invalid = Object.values(selected).some((item) =>
      !item.transport_mode || !item.departure_location.trim() || !item.return_location.trim()
    )
    if (!selectedCount || invalid) {
      setError('اختر التكليفات وأكمل وسيلة الانتقال ومكان الانطلاق والعودة لكل تكليف.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/v2/finance/claims', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_notes: notes,
          items: Object.entries(selected).map(([assignment_batch_id, form]) => ({ assignment_batch_id, ...form })),
        }),
      })
      const payload = await response.json() as { error?: string; claim?: { claim_number?: string } }
      if (!response.ok) throw new Error(payload.error || 'تعذر إرسال الطلب')
      setSuccess(`تم إرسال الطلب ${payload.claim?.claim_number ?? ''} إلى الشئون المالية.`)
      setSelected({})
      setNotes('')
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تعذر إرسال الطلب')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex min-h-60 items-center justify-center gap-2 rounded-2xl border bg-white text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل طلباتك المالية...</div>

  return <div className="space-y-5">
    {error && <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertTriangle className="h-4 w-4" />{error}</div>}
    {success && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{success}</div>}

    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div><h2 className="text-sm font-black text-slate-900">المأموريات المتاحة للطلب</h2><p className="mt-1 text-[10px] text-slate-500">اختر مأمورية أو عدة مأموريات مكتملة ثم أدخل تفاصيل السفر الفعلية.</p></div>
        <div className="flex gap-2 text-[10px] font-black"><span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{selectedCount} محددة</span><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{totals.days} يوم · {totals.nights} ليلة</span></div>
      </div>

      <div className="divide-y divide-slate-100">
        {eligible.length === 0 && <p className="p-8 text-center text-xs text-slate-500">لا توجد مأموريات مكتملة جديدة متاحة للإرسال حاليًا.</p>}
        {eligible.map((batch) => {
          const form = selected[batch.id]
          return <article key={batch.id} className="p-4">
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={Boolean(form)} onChange={() => toggle(batch.id)} className="mt-1 h-4 w-4 accent-teal-700" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><strong className="text-xs text-slate-900">{batch.governorate || 'محافظة غير محددة'}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold">{date(batch.actual_start_date)} – {date(batch.actual_end_date)}</span><span className="rounded-full bg-teal-50 px-2 py-1 text-[9px] font-bold text-teal-800">{batch.actual_duration_days} يوم · {batch.actual_overnight_nights} ليلة</span><span className="text-[9px] text-slate-400">{batch.mission_count} منشأة</span></div>
                <p className="mt-1 truncate text-[10px] text-slate-500" title={batch.facilities.join('، ')}>{batch.facilities.join('، ')}</p>
              </div>
            </div>

            {form && <div className="mt-4 grid gap-3 rounded-xl border border-teal-100 bg-teal-50/30 p-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="text-[10px] font-bold text-slate-700">وسيلة الانتقال *<select value={form.transport_mode} onChange={(e) => update(batch.id, 'transport_mode', e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2"><option value="">اختر</option><option value="ministry_vehicle">سيارة تابعة للوزارة</option><option value="public_transport">مواصلات عامة</option><option value="private_vehicle">سيارة خاصة</option><option value="rail">قطار</option><option value="air">طيران</option><option value="other">أخرى</option></select></label>
              <label className="text-[10px] font-bold text-slate-700">مكان الانطلاق *<input value={form.departure_location} onChange={(e) => update(batch.id, 'departure_location', e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" /></label>
              <label className="text-[10px] font-bold text-slate-700">مكان العودة *<input value={form.return_location} onChange={(e) => update(batch.id, 'return_location', e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" /></label>
              <label className="text-[10px] font-bold text-slate-700">نوع الإقامة<select value={form.accommodation_type} onChange={(e) => update(batch.id, 'accommodation_type', e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2"><option value="none">لا توجد إقامة</option><option value="government">استراحة حكومية</option><option value="hotel">فندق</option><option value="self_arranged">إقامة شخصية</option><option value="other">أخرى</option></select></label>
              <label className="text-[10px] font-bold text-slate-700">تكلفة المواصلات المطلوبة<input type="number" min="0" step="0.01" value={form.transport_cost_claimed} onChange={(e) => update(batch.id, 'transport_cost_claimed', e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" /></label>
              <label className="text-[10px] font-bold text-slate-700">تكلفة الإقامة المطلوبة<input type="number" min="0" step="0.01" value={form.accommodation_cost_claimed} onChange={(e) => update(batch.id, 'accommodation_cost_claimed', e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" /></label>
              <label className="text-[10px] font-bold text-slate-700 md:col-span-2">تفاصيل المواصلات<input value={form.transport_details} onChange={(e) => update(batch.id, 'transport_details', e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" placeholder="أرقام تذاكر أو خط السير أو أي تفاصيل لازمة" /></label>
              <label className="text-[10px] font-bold text-slate-700">تفاصيل الإقامة<input value={form.accommodation_details} onChange={(e) => update(batch.id, 'accommodation_details', e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3" /></label>
            </div>}
          </article>
        })}
      </div>

      {selectedCount > 0 && <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 bg-slate-50 p-4"><label className="min-w-64 flex-1 text-[10px] font-bold text-slate-700">ملاحظات عامة للمالية<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3" /></label><button onClick={() => void submit()} disabled={submitting} className="inline-flex h-11 items-center gap-2 rounded-xl bg-teal-700 px-5 text-xs font-black text-white disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}إرسال المحدد للمالية</button></div>}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2"><WalletCards className="h-5 w-5 text-teal-700" /><h2 className="text-sm font-black">طلباتي السابقة</h2></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{claims.length === 0 ? <p className="text-xs text-slate-500">لم ترسل طلبات مالية بعد.</p> : claims.map((claim) => <article key={claim.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><strong className="text-xs text-slate-900">{claim.claim_number}</strong><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">{STATUS_LABELS[claim.status] || claim.status}</span></div><p className="mt-2 text-[10px] text-slate-500">{claim.items.length} مأمورية · {claim.items.reduce((sum, item) => sum + item.actual_duration_days, 0)} يوم</p>{claim.return_reason && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-[9px] text-rose-700">{claim.return_reason}</p>}</article>)}</div>
    </section>
  </div>
}
