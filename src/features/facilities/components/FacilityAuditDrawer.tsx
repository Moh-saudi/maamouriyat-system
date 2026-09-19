'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock3,
  History,
  Loader2,
  X,
} from 'lucide-react'

type AuditChange = {
  label: string
  before: string
  after: string
}

type AuditEntry = {
  id: string
  actionCode: string
  action: string
  actorName: string
  createdAt: string
  reason: string | null
  changes: AuditChange[]
}

type FacilitySummary = {
  id: string
  name: string
  facilityType: string
  governorate: string
  healthAdmin: string
  villageCity: string | null
  isActive: boolean
  updatedAt: string | null
}

type AuditFilter = 'all' | 'data' | 'status' | 'create'

interface FacilityAuditDrawerProps {
  open: boolean
  facilityId: string | null
  facilityName: string
  onClose: () => void
  refreshToken?: number
}

function formatDateTime(value: string | null): string {
  if (!value) return 'غير مسجل'

  return new Date(value).toLocaleString('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function matchesFilter(entry: AuditEntry, filter: AuditFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'create') return entry.actionCode === 'create'
  if (filter === 'data') {
    return entry.actionCode === 'update' || entry.actionCode === 'merge'
  }

  return (
    entry.actionCode === 'deactivate' ||
    entry.actionCode === 'reactivate'
  )
}

export function FacilityAuditDrawer({
  open,
  facilityId,
  facilityName,
  onClose,
  refreshToken = 0,
}: FacilityAuditDrawerProps) {
  const [facility, setFacility] = useState<FacilitySummary | null>(null)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<AuditFilter>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !facilityId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(
      `/api/admin/facilities/audit?facility_id=${encodeURIComponent(
        facilityId
      )}`,
      {
        cache: 'no-store',
        credentials: 'same-origin',
      }
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          facility?: FacilitySummary
          entries?: AuditEntry[]
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error || 'تعذر تحميل سجل التعديلات')
        }

        if (!cancelled) {
          const nextEntries = payload.entries ?? []
          setFacility(payload.facility ?? null)
          setEntries(nextEntries)
          setExpandedId(nextEntries[0]?.id ?? null)
          setFilter('all')
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'تعذر تحميل سجل التعديلات'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, facilityId, refreshToken])

  const filteredEntries = useMemo(
    () => entries.filter((entry) => matchesFilter(entry, filter)),
    [entries, filter]
  )

  const statusChangeCount = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.actionCode === 'deactivate' ||
          entry.actionCode === 'reactivate'
      ).length,
    [entries]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] bg-slate-950/35"
      role="dialog"
      aria-modal="true"
      aria-labelledby="facility-audit-title"
    >
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <aside className="absolute bottom-0 right-0 top-0 z-10 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-teal-700">
                سجل المنشأة
              </p>
              <h2
                id="facility-audit-title"
                className="mt-1 truncate text-base font-extrabold text-slate-900"
              >
                {facility?.name || facilityName}
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                ملخص سريع ثم خط زمني قابل للتوسّع عند الحاجة.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              aria-label="إغلاق السجل"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!loading && !error && facility && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <p className="text-[10px] text-slate-400">الحالة الحالية</p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      facility.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <span
                    className={`text-xs font-extrabold ${
                      facility.isActive
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {facility.isActive ? 'نشطة' : 'موقوفة'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <p className="text-[10px] text-slate-400">إجمالي العمليات</p>
                <p className="mt-1 text-base font-black text-slate-900">
                  {entries.length.toLocaleString('en-US')}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  منها {statusChangeCount.toLocaleString('en-US')} تغيير حالة
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <p className="text-[10px] text-slate-400">آخر تحديث</p>
                <p className="mt-1 text-[11px] font-bold text-slate-700">
                  {formatDateTime(
                    entries[0]?.createdAt || facility.updatedAt
                  )}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400">
                  {facility.governorate} • {facility.healthAdmin}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              ['all', 'الكل'],
              ['data', 'تعديلات البيانات'],
              ['status', 'تغييرات الحالة'],
              ['create', 'الإنشاء'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const nextFilter = value as AuditFilter
                  setFilter(nextFilter)
                  const firstMatch = entries.find((entry) =>
                    matchesFilter(entry, nextFilter)
                  )
                  setExpandedId(firstMatch?.id ?? null)
                }}
                className={`h-8 rounded-lg border px-3 text-[10px] font-bold transition ${
                  filter === value
                    ? 'border-teal-600 bg-teal-50 text-teal-800'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ تحميل سجل التعديلات...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <Clock3 className="mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">
                لا توجد تعديلات مسجلة بعد
              </p>
              <p className="mt-1 text-xs text-slate-400">
                المنشآت المستوردة قبل تفعيل سجل المراجعة لن يكون لها تاريخ سابق.
              </p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center text-center">
              <History className="mb-3 h-7 w-7 text-slate-300" />
              <p className="text-xs font-bold text-slate-600">
                لا توجد عمليات ضمن هذا التصنيف
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map((entry, index) => {
                const expanded = expandedId === entry.id
                const reasonPreview =
                  entry.reason || 'لم يتم تسجيل سبب لهذا الإجراء.'

                return (
                  <article
                    key={entry.id}
                    className={`overflow-hidden rounded-xl border transition ${
                      expanded
                        ? 'border-teal-200 bg-white shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(expanded ? null : entry.id)
                      }
                      className="w-full px-4 py-3 text-right"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                          <Activity className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-xs font-extrabold text-slate-900">
                                {entry.action}
                              </span>
                              {index === 0 && filter === 'all' && (
                                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-700">
                                  الأحدث
                                </span>
                              )}
                            </div>

                            <time className="shrink-0 text-[9px] font-semibold text-slate-400">
                              {formatDateTime(entry.createdAt)}
                            </time>
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                            <span>بواسطة {entry.actorName}</span>
                            <span>
                              {entry.changes.length.toLocaleString('en-US')}{' '}
                              تغيير
                            </span>
                          </div>

                          <p className="mt-1.5 truncate text-[10px] text-slate-400">
                            السبب: {reasonPreview}
                          </p>
                        </div>

                        <div className="mt-1 shrink-0 text-slate-400">
                          {expanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50/45 px-4 py-3">
                        <div
                          className={`rounded-lg border px-3 py-2 ${
                            entry.reason
                              ? 'border-amber-100 bg-amber-50 text-amber-900'
                              : 'border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          <p className="text-[9px] font-bold">
                            سبب الإجراء
                          </p>
                          <p className="mt-1 text-[10px] leading-5">
                            {reasonPreview}
                          </p>
                        </div>

                        {entry.changes.length > 0 ? (
                          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                            {entry.changes.map((change) => (
                              <div
                                key={change.label}
                                className="grid grid-cols-[105px_1fr] gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0"
                              >
                                <span className="text-[10px] font-bold text-slate-500">
                                  {change.label}
                                </span>
                                <div className="min-w-0 text-[10px] leading-5">
                                  {change.before !== change.after ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-slate-400 line-through">
                                        {change.before}
                                      </span>
                                      <span className="text-slate-300">←</span>
                                      <strong className="font-bold text-slate-800">
                                        {change.after}
                                      </strong>
                                    </div>
                                  ) : (
                                    <span className="text-slate-600">
                                      {change.after}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-[10px] text-slate-400">
                            لا توجد حقول تفصيلية قابلة للعرض لهذه العملية.
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
