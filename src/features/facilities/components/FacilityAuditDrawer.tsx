'use client'

import { useEffect, useState } from 'react'
import { Clock3, Loader2, X } from 'lucide-react'

type AuditChange = {
  label: string
  before: string
  after: string
}

type AuditEntry = {
  id: string
  action: string
  actorName: string
  createdAt: string
  reason: string | null
  changes: AuditChange[]
}

interface FacilityAuditDrawerProps {
  open: boolean
  facilityId: string | null
  facilityName: string
  onClose: () => void
  refreshToken?: number
}

export function FacilityAuditDrawer({
  open,
  facilityId,
  facilityName,
  onClose,
  refreshToken = 0,
}: FacilityAuditDrawerProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !facilityId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(
      `/api/admin/facilities/audit?facility_id=${encodeURIComponent(facilityId)}`,
      {
        cache: 'no-store',
        credentials: 'same-origin',
      }
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          entries?: AuditEntry[]
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error || 'تعذر تحميل سجل التعديلات')
        }

        if (!cancelled) {
          setEntries(payload.entries ?? [])
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

      <aside className="absolute bottom-0 right-0 top-0 z-10 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-teal-700">
              سجل التعديلات
            </p>
            <h2
              id="facility-audit-title"
              className="mt-1 truncate text-base font-extrabold text-slate-900"
            >
              {facilityName}
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              جميع عمليات التصحيح والإيقاف وإعادة التفعيل المسجلة.
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

        <div className="flex-1 overflow-y-auto p-5">
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
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-900">
                        {entry.action}
                      </h3>
                      <p className="mt-1 text-[10px] text-slate-500">
                        بواسطة {entry.actorName}
                      </p>
                    </div>
                    <time className="text-[10px] font-semibold text-slate-400">
                      {new Date(entry.createdAt).toLocaleString('en-GB', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </time>
                  </div>

                  {entry.reason && (
                    <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
                      سبب التعديل: {entry.reason}
                    </div>
                  )}

                  {entry.changes.length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                      {entry.changes.map((change) => (
                        <div
                          key={change.label}
                          className="grid grid-cols-[120px_1fr] gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0"
                        >
                          <span className="text-[10px] font-bold text-slate-500">
                            {change.label}
                          </span>
                          <div className="text-[10px] leading-5">
                            {change.before !== change.after ? (
                              <>
                                <span className="text-slate-400 line-through">
                                  {change.before}
                                </span>
                                <span className="mx-1.5 text-slate-300">←</span>
                                <strong className="font-bold text-slate-700">
                                  {change.after}
                                </strong>
                              </>
                            ) : (
                              <span className="text-slate-600">
                                {change.after}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
