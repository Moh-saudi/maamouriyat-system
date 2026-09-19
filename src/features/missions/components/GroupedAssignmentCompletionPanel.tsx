'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

type CompletionDisposition =
  | 'return_to_base'
  | 'next_mission'
  | 'other'

type Props = {
  batchId: string
  allCompleted: boolean
  canFinalize: boolean
  plannedStartDate: string
  plannedEndDate: string
  suggestedStartDate: string
  suggestedEndDate: string
  actualStartDate: string | null
  actualEndDate: string | null
  actualOvernightNights: number | null
  completionDisposition: CompletionDisposition | null
  timingAdjustmentReason: string | null
  finalized: boolean
  actualDurationDays: number | null
  reportSubmittedAt: string | null
}

function inclusiveDays(start: string, end: string) {
  if (!start || !end) return 0
  const startTime = new Date(start + 'T00:00:00').getTime()
  const endTime = new Date(end + 'T00:00:00').getTime()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0
  return Math.floor((endTime - startTime) / 86400000) + 1
}

export function GroupedAssignmentCompletionPanel({
  batchId,
  allCompleted,
  canFinalize,
  plannedStartDate,
  plannedEndDate,
  suggestedStartDate,
  suggestedEndDate,
  actualStartDate,
  actualEndDate,
  actualOvernightNights,
  completionDisposition,
  timingAdjustmentReason,
  finalized,
  actualDurationDays,
  reportSubmittedAt,
}: Props) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(
    actualStartDate || suggestedStartDate || plannedStartDate
  )
  const [endDate, setEndDate] = useState(
    actualEndDate || suggestedEndDate || plannedEndDate
  )
  const [nights, setNights] = useState(
    actualOvernightNights ?? 0
  )
  const [disposition, setDisposition] =
    useState<CompletionDisposition | ''>(
      completionDisposition || ''
    )
  const [reason, setReason] = useState(
    timingAdjustmentReason || ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const durationDays = useMemo(
    () => inclusiveDays(startDate, endDate),
    [endDate, startDate]
  )
  const timingChanged =
    startDate !== plannedStartDate ||
    endDate !== plannedEndDate

  useEffect(() => {
    const maxNights = Math.max(0, durationDays - 1)
    setNights((current) =>
      Math.min(Math.max(0, current), maxNights)
    )
  }, [durationDays])

  if (!allCompleted) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-slate-400" />
          <div>
            <h2 className="text-xs font-black text-slate-700">
              لا يمكن إنهاء التكليف بعد
            </h2>
            <p className="mt-1 text-[9px] leading-5 text-slate-500">
              أكمل المرور على جميع المنشآت أولًا. المدة الفعلية والتقرير
              والاستحقاق المالي تُثبت بعد اكتمال التكليف كله.
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (finalized) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xs font-black text-emerald-900">
                تم إنهاء التكليف وتثبيت المدة الفعلية
              </h2>
              <p className="mt-1 text-[9px] leading-5 text-emerald-700">
                {actualStartDate} — {actualEndDate}
                {actualDurationDays
                  ? ' · ' +
                    actualDurationDays.toLocaleString('en-US') +
                    ' يوم'
                  : ''}
                {' · '}
                {(actualOvernightNights ?? 0).toLocaleString('en-US')} ليلة
              </p>
              <p className="mt-1 text-[9px] text-emerald-700">
                {reportSubmittedAt
                  ? 'تم إرسال التقرير الموقع إلى الشئون المالية.'
                  : 'التقرير أصبح جاهزًا للمراجعة والطباعة والتوقيع. لن يظهر التكليف للمالية قبل تأكيد إرسال التقرير الموقع.'}
              </p>
            </div>
          </div>

          <Link
            href={
              '/v2/missions/assignments/' +
              batchId +
              '/report'
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-[10px] font-black text-white hover:bg-emerald-800"
          >
            <FileText className="h-3.5 w-3.5" />
            إعداد ومراجعة التقرير
          </Link>
        </div>
      </section>
    )
  }

  if (!canFinalize) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <h2 className="text-xs font-black text-amber-900">
              اكتمل المرور وينتظر إنهاء رئيس الفريق
            </h2>
            <p className="mt-1 text-[9px] leading-5 text-amber-700">
              جميع المنشآت منفذة. رئيس فريق المأمورية هو الذي يثبت المدة
              الفعلية وليالي المبيت ويغلق التكليف تمهيدًا للتقرير والمالية.
            </p>
          </div>
        </div>
      </section>
    )
  }

  async function finalize() {
    setError('')
    setSuccess('')

    if (!startDate || !endDate || durationDays < 1) {
      setError('حدد بداية ونهاية فعلية صحيحتين.')
      return
    }

    if (!disposition) {
      setError('حدد ما حدث بعد انتهاء التكليف.')
      return
    }

    if (timingChanged && !reason.trim()) {
      setError(
        'المدة الفعلية تختلف عن المدة المقدرة؛ اكتب سبب التعديل.'
      )
      return
    }

    if (nights < 0 || nights > Math.max(0, durationDays - 1)) {
      setError('عدد ليالي المبيت لا يتناسب مع المدة الفعلية.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        '/api/v2/missions/assignments/' +
          batchId +
          '/complete',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            actual_start_date: startDate,
            actual_end_date: endDate,
            actual_overnight_nights: nights,
            completion_disposition: disposition,
            timing_adjustment_reason: timingChanged
              ? reason.trim()
              : null,
          }),
        }
      )

      const payload = (await response.json()) as {
        error?: string
        settlement_count?: number
      }

      if (!response.ok) {
        throw new Error(
          payload.error || 'تعذر إنهاء التكليف.'
        )
      }

      setSuccess(
        'تم إنهاء التكليف وتثبيت المدة الفعلية. التقرير جاهز الآن للمراجعة والطباعة والتوقيع.'
      )
      router.refresh()
    } catch (finalizeError) {
      setError(
        finalizeError instanceof Error
          ? finalizeError.message
          : 'تعذر إنهاء التكليف.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">
            إنهاء التكليف وتثبيت المدة الفعلية
          </h2>
          <p className="mt-1 text-[9px] leading-5 text-slate-500">
            اكتمل المرور على كل المنشآت. ثبّت مدة التكليف الفعلية مرة واحدة؛
            هذه البيانات هي التي تعتمد عليها المالية.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700">
          جاهز للإنهاء
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <label className="grid gap-1 text-[9px] font-bold text-slate-500">
          البداية الفعلية
          <input
            type="date"
            value={startDate}
            onChange={(event) =>
              setStartDate(event.target.value)
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-teal-500"
          />
        </label>

        <label className="grid gap-1 text-[9px] font-bold text-slate-500">
          النهاية الفعلية
          <input
            type="date"
            value={endDate}
            onChange={(event) =>
              setEndDate(event.target.value)
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-teal-500"
          />
        </label>

        <label className="grid gap-1 text-[9px] font-bold text-slate-500">
          ليالي المبيت الفعلية
          <input
            type="number"
            min={0}
            max={Math.max(0, durationDays - 1)}
            value={nights}
            onChange={(event) =>
              setNights(
                Math.max(0, Number(event.target.value) || 0)
              )
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-teal-500"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px]">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">
          المقدرة: {plannedStartDate} — {plannedEndDate}
        </span>
        <span
          className={
            'rounded-full px-2.5 py-1 font-black ' +
            (timingChanged
              ? 'bg-amber-50 text-amber-700'
              : 'bg-emerald-50 text-emerald-700')
          }
        >
          الفعلية: {durationDays.toLocaleString('en-US')} يوم
          {timingChanged ? ' · معدلة' : ' · مطابقة'}
        </span>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[9px] font-black text-slate-600">
          ماذا حدث بعد انتهاء التكليف؟
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ['return_to_base', 'العودة إلى مقر العمل'],
            ['next_mission', 'الانتقال إلى مأمورية أخرى'],
            ['other', 'إجراء آخر'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setDisposition(
                  value as CompletionDisposition
                )
              }
              className={
                'h-10 rounded-xl border px-3 text-[9px] font-black transition ' +
                (disposition === value
                  ? 'border-teal-300 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50')
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {timingChanged && (
        <label className="mt-4 grid gap-1 text-[9px] font-bold text-slate-500">
          سبب اختلاف المدة الفعلية عن المدة المقدرة *
          <textarea
            value={reason}
            onChange={(event) =>
              setReason(event.target.value)
            }
            rows={3}
            placeholder="مثال: تم استكمال جميع أعمال المرور قبل الموعد المقدر."
            className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-xs leading-5 text-slate-700 outline-none focus:border-amber-400"
          />
        </label>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700">
          {success}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void finalize()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-[10px] font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          إنهاء التكليف واعتماد المدة الفعلية
        </button>
      </div>
    </section>
  )
}
