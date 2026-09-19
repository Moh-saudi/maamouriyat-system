'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
} from 'lucide-react'

type MissionSummary = {
  total: number
  pending_approval: number
  approved: number
  in_progress: number
  completed: number
  closed: number
  rejected: number
}

type FinanceSummary = {
  count: number
  pending_review: number
  prepared: number
  approved_amount: number
  paid_amount: number
  rejected: number
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function ReportsSummaryPanel() {
  const [mission, setMission] = useState<MissionSummary | null>(null)
  const [finance, setFinance] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/v2/reports/summary', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const payload = (await response.json()) as {
        mission_report?: MissionSummary | null
        finance_report?: FinanceSummary | null
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل التقارير')
      }

      setMission(payload.mission_report ?? null)
      setFinance(payload.finance_report ?? null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'تعذر تحميل التقارير'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ إعداد ملخص التقارير داخل نطاقك...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          تحديث
        </button>
      </div>

      {mission && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                تقرير المأموريات
              </h2>
              <p className="mt-1 text-[10px] text-slate-400">
                ملخص تشغيلي للمأموريات الواقعة داخل نطاق صلاحيتك.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['الإجمالي', mission.total],
              ['بانتظار الاعتماد', mission.pending_approval],
              ['معتمدة', mission.approved],
              ['قيد التنفيذ', mission.in_progress],
              ['مكتملة', mission.completed],
              ['مغلقة', mission.closed],
              ['مرفوضة', mission.rejected],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
              >
                <p className="text-[9px] font-bold text-slate-400">
                  {label}
                </p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {Number(value).toLocaleString('en-US')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {finance && (
        <section className="rounded-2xl border border-emerald-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                التقرير المالي للمأموريات
              </h2>
              <p className="mt-1 text-[10px] text-slate-400">
                ملخص الاستحقاقات والتسويات والصرف داخل نطاقك المالي.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[9px] font-bold text-slate-400">
                عدد الاستحقاقات
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {finance.count.toLocaleString('en-US')}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-[9px] font-bold text-amber-700">
                بانتظار المراجعة
              </p>
              <p className="mt-1 text-lg font-black text-amber-900">
                {(finance.pending_review + finance.prepared).toLocaleString(
                  'en-US'
                )}
              </p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3">
              <p className="text-[9px] font-bold text-rose-700">مرفوضة</p>
              <p className="mt-1 text-lg font-black text-rose-900">
                {finance.rejected.toLocaleString('en-US')}
              </p>
            </div>
            <div className="rounded-xl bg-teal-50 p-3">
              <p className="text-[9px] font-bold text-teal-700">
                معتمد ولم يصرف
              </p>
              <p className="mt-1 text-lg font-black text-teal-900">
                {money(finance.approved_amount)} ج.م
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 sm:col-span-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <p className="text-[9px] font-bold text-emerald-700">
                  إجمالي ما تم تسجيل صرفه
                </p>
              </div>
              <p className="mt-1 text-xl font-black text-emerald-900">
                {money(finance.paid_amount)} ج.م
              </p>
            </div>
          </div>
        </section>
      )}

      {!mission && !finance && !error && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-bold text-slate-600">
            لا توجد تقارير متاحة لهذا الحساب
          </p>
        </div>
      )}
    </div>
  )
}
