'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  CheckCircle2,
  FileCheck2,
  Loader2,
  Printer,
  Send,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

type Props = {
  batchId: string
  canSubmit: boolean
  submittedAt: string | null
}

export function GroupedReportSubmissionPanel({
  batchId,
  canSubmit,
  submittedAt,
}: Props) {
  const router = useRouter()
  const [confirmedSigned, setConfirmedSigned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submitToFinance() {
    if (!confirmedSigned) {
      setError('يجب تأكيد مراجعة وتوقيع التقرير أولًا.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        '/api/v2/missions/assignments/' +
          batchId +
          '/submit-report',
        {
          method: 'POST',
          credentials: 'same-origin',
        }
      )

      const payload = (await response.json()) as {
        error?: string
        settlement_count?: number
      }

      if (!response.ok) {
        throw new Error(
          payload.error || 'تعذر إرسال التقرير إلى المالية.'
        )
      }

      setSuccess(
        'تم إرسال التقرير الموقع إلى الشئون المالية وإنشاء الاستحقاقات لأعضاء الفريق.'
      )
      router.refresh()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'تعذر إرسال التقرير إلى المالية.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (submittedAt) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xs font-black text-emerald-900">
                تم إرسال التقرير الموقع إلى الشئون المالية
              </h2>
              <p className="mt-1 text-[9px] text-emerald-700">
                {new Date(submittedAt).toLocaleString('ar-EG')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={
                '/v2/print/missions/assignments/' +
                batchId +
                '/report'
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 text-[10px] font-bold text-emerald-800"
            >
              <Printer className="h-3.5 w-3.5" />
              طباعة التقرير
            </Link>
            <Link
              href="/v2/finance"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-[10px] font-black text-white"
            >
              عرض الاستحقاقات المالية
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-teal-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-teal-700" />
            <h2 className="text-sm font-black text-slate-900">
              مراجعة وتوقيع التقرير
            </h2>
          </div>
          <p className="mt-1 text-[9px] leading-5 text-slate-500">
            اطبع التقرير بعد مراجعة النتائج، ثم يوقعه القائم بالمأمورية.
            لا يظهر التكليف للشئون المالية قبل تأكيد هذه الخطوة.
          </p>
        </div>

        <Link
          href={
            '/v2/print/missions/assignments/' +
            batchId +
            '/report'
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 text-[10px] font-black text-teal-800"
        >
          <Printer className="h-3.5 w-3.5" />
          طباعة التقرير الرسمي
        </Link>
      </div>

      {canSubmit ? (
        <>
          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <input
              type="checkbox"
              checked={confirmedSigned}
              onChange={(event) =>
                setConfirmedSigned(event.target.checked)
              }
              className="mt-0.5 h-4 w-4 accent-teal-700"
            />
            <span className="text-[10px] leading-5 text-slate-600">
              أؤكد أن تقرير المأمورية تمت مراجعته وطباعته وتوقيعه من القائم
              بالمأمورية، وأطلب إرساله إلى الشئون المالية لصرف المستحقات.
            </span>
          </label>

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
              disabled={loading || !confirmedSigned}
              onClick={() => void submitToFinance()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-[10px] font-black text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              إرسال التقرير الموقع إلى المالية
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[10px] leading-5 text-amber-800">
          يمكن الاطلاع على التقرير وطباعته، لكن تأكيد التوقيع وإرساله للمالية
          يتم بواسطة رئيس فريق المأمورية.
        </div>
      )}
    </section>
  )
}
