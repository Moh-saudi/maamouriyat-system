'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'

type BatchRow = {
  id: string
  scheduled_date: string
  expected_end_date: string
  priority: string
  visit_purpose: string
  notes: string | null
  requires_overnight: boolean
  requires_hotel_booking: boolean
  mission_count: number
  submitted_at: string
  created_by_name: string
  template_name: string
  missions: Array<{
    id: string
    serial_number: string
    facility_id: string
    facility_name: string
  }>
}

function priorityLabel(value: string) {
  if (value === 'urgent') return 'عاجلة'
  if (value === 'high') return 'مرتفعة'
  return 'عادية'
}

export function MissionApprovalPanel() {
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/v2/missions/approvals', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const payload = (await response.json()) as {
        batches?: BatchRow[]
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل التكليفات')
      }

      setBatches(payload.batches ?? [])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'تعذر تحميل التكليفات'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function act(batchId: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !reason.trim()) {
      setError('اكتب سبب الرفض أولًا.')
      return
    }

    setActingId(batchId)
    setError(null)

    try {
      const response = await fetch('/api/v2/missions/approvals', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batchId,
          action,
          reason: action === 'reject' ? reason.trim() : undefined,
        }),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحديث اعتماد التكليف')
      }

      setRejectingId(null)
      setReason('')
      await load()
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'تعذر تحديث اعتماد التكليف'
      )
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ تحميل التكليفات بانتظار الاعتماد...
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

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {batches.length.toLocaleString('en-US')} دفعة بانتظار الاعتماد داخل
          نطاقك.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          تحديث
        </button>
      </div>

      {batches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
          <h2 className="mt-3 text-sm font-black text-slate-800">
            لا توجد تكليفات معلقة
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            كل دفعات التكليف الواقعة داخل نطاق اعتمادك تمت مراجعتها.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => (
            <article
              key={batch.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="grid gap-4 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-[1fr_auto] sm:p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-black text-amber-800">
                      بانتظار الاعتماد
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold text-slate-500 ring-1 ring-slate-200">
                      أولوية {priorityLabel(batch.priority)}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold text-slate-500 ring-1 ring-slate-200">
                      {batch.mission_count.toLocaleString('en-US')} مأمورية
                    </span>
                  </div>
                  <h2 className="mt-3 text-sm font-black text-slate-900">
                    {batch.visit_purpose}
                  </h2>
                  <p className="mt-1 text-[10px] text-slate-400">
                    أعدها: {batch.created_by_name} · النموذج: {batch.template_name}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {batch.scheduled_date}
                    {batch.expected_end_date !== batch.scheduled_date
                      ? ' ← ' + batch.expected_end_date
                      : ''}
                  </p>
                </div>

                <div className="flex items-start gap-2 sm:justify-end">
                  <button
                    type="button"
                    disabled={actingId === batch.id}
                    onClick={() => void act(batch.id, 'approve')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {actingId === batch.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ClipboardCheck className="h-3.5 w-3.5" />
                    )}
                    اعتماد الدفعة
                  </button>
                  <button
                    type="button"
                    disabled={actingId === batch.id}
                    onClick={() =>
                      setRejectingId((current) =>
                        current === batch.id ? null : batch.id
                      )
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    رفض
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {batch.missions.map((mission) => (
                    <div
                      key={mission.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5"
                    >
                      <p className="font-mono text-[9px] font-bold text-teal-700">
                        {mission.serial_number}
                      </p>
                      <p className="mt-1 text-[11px] font-extrabold text-slate-800">
                        {mission.facility_name}
                      </p>
                    </div>
                  ))}
                </div>

                {batch.notes && (
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] leading-5 text-slate-500">
                    {batch.notes}
                  </div>
                )}

                {rejectingId === batch.id && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-bold text-rose-800">
                        سبب الرفض أو الإعادة للمراجعة
                      </span>
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-rose-200 bg-white p-2.5 text-xs outline-none focus:border-rose-400"
                        placeholder="اكتب السبب بوضوح..."
                      />
                    </label>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null)
                          setReason('')
                        }}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-500"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        disabled={actingId === batch.id || !reason.trim()}
                        onClick={() => void act(batch.id, 'reject')}
                        className="h-8 rounded-lg bg-rose-600 px-3 text-[10px] font-bold text-white disabled:opacity-50"
                      >
                        تأكيد الرفض
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
