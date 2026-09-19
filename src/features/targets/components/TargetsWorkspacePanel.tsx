'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Target,
  UserRound,
} from 'lucide-react'
import { CompactFilterSelect } from '@/components/ui/CompactFilterSelect'

type TargetRow = {
  id: string
  title: string
  period_type: string
  period_label: string
  start_date: string
  end_date: string
  target_missions: number
  scope_level: 'ministry' | 'sector' | 'governorate' | 'health_admin' | 'user'
  scope_name: string
  target_type?: 'aggregate' | 'specific_facilities'
  target_facilities?: Array<{
    id: string
    name: string
    is_visited?: boolean
  }>
  assigned_user_id?: string
  assigned_user_name?: string
  status: 'active' | 'completed' | 'cancelled'
  executed_missions?: number
  completion_rate?: number
  notes?: string
}

type Payload = {
  targets?: TargetRow[]
  error?: string
}

function scopeLabel(target: TargetRow) {
  if (target.scope_level === 'user') return 'مستهدف مستخدم'
  if (target.scope_level === 'governorate') return 'مستهدف محافظة'
  if (target.scope_level === 'health_admin') return 'مستهدف إدارة صحية'
  if (target.scope_level === 'sector') return 'مستهدف قطاع'
  if (target.scope_level === 'ministry') return 'مستهدف قومي'
  return 'مستهدف مكاني'
}

function scopeIcon(target: TargetRow) {
  return target.scope_level === 'user' ? UserRound : MapPin
}

export function TargetsWorkspacePanel({
  canManage,
}: {
  canManage: boolean
}) {
  const [targets, setTargets] = useState<TargetRow[]>([])
  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/mission-targets?workspace=true', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const payload = (await response.json()) as Payload
      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل المستهدفات')
      }
      setTargets(payload.targets ?? [])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'تعذر تحميل المستهدفات'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('ar')

    return targets.filter((target) => {
      if (scopeFilter) {
        if (scopeFilter === 'user' && target.scope_level !== 'user') {
          return false
        }
        if (
          scopeFilter === 'place' &&
          target.scope_level === 'user'
        ) {
          return false
        }
      }

      if (
        typeFilter &&
        (target.target_type ?? 'aggregate') !== typeFilter
      ) {
        return false
      }

      if (!q) return true

      return [
        target.title,
        target.scope_name,
        target.assigned_user_name ?? '',
        target.period_label,
      ]
        .join(' ')
        .toLocaleLowerCase('ar')
        .includes(q)
    })
  }, [scopeFilter, search, targets, typeFilter])

  const summary = useMemo(() => {
    const target = targets.reduce(
      (sum, item) => sum + Number(item.target_missions || 0),
      0
    )
    const executed = targets.reduce(
      (sum, item) => sum + Number(item.executed_missions || 0),
      0
    )

    return {
      plans: targets.length,
      users: targets.filter((item) => item.scope_level === 'user').length,
      places: targets.filter((item) => item.scope_level !== 'user').length,
      target,
      executed,
    }
  }, [targets])

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: 'الخطط',
            value: summary.plans,
            icon: Target,
          },
          {
            label: 'لمستخدمين',
            value: summary.users,
            icon: UserRound,
          },
          {
            label: 'لأماكن ونطاقات',
            value: summary.places,
            icon: MapPin,
          },
          {
            label: 'إجمالي المستهدف',
            value: summary.target,
            icon: ClipboardList,
          },
          {
            label: 'المنفذ',
            value: summary.executed,
            icon: CheckCircle2,
          },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <Icon className="h-4 w-4 text-teal-700" />
              <p className="mt-3 text-[9px] font-bold text-slate-400">
                {item.label}
              </p>
              <p className="mt-1 text-xl font-black text-slate-900">
                {item.value.toLocaleString('en-US')}
              </p>
            </div>
          )
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 sm:p-4">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث بالعنوان أو المستخدم أو المكان..."
              className="h-10 w-full rounded-xl border border-slate-200 pr-9 pl-3 text-xs outline-none focus:border-teal-500"
            />
          </div>

          <CompactFilterSelect
            value={scopeFilter}
            onChange={setScopeFilter}
            placeholder="كل نطاقات المستهدف"
            className="w-52"
            options={[
              { value: 'user', label: 'مستهدفات مستخدمين' },
              { value: 'place', label: 'مستهدفات مكانية' },
            ]}
          />

          <CompactFilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="كل أنواع الخطط"
            className="w-52"
            options={[
              { value: 'aggregate', label: 'مستهدف تراكمي بالعدد' },
              {
                value: 'specific_facilities',
                label: 'منشآت محددة بالاسم',
              },
            ]}
          />

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[10px] font-bold text-slate-600"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث
          </button>

          {canManage && (
            <Link
              href="/dashboard/targets"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-teal-700 px-3 text-[10px] font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              إنشاء / إدارة المستهدفات
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            جارٍ تحميل المستهدفات...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Target className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">
              لا توجد مستهدفات مطابقة
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((target) => {
              const ScopeIcon = scopeIcon(target)
              const executed = Number(target.executed_missions || 0)
              const remaining = Math.max(
                0,
                Number(target.target_missions || 0) - executed
              )
              const rate = Math.min(
                100,
                Number(
                  target.completion_rate ??
                    Math.round(
                      (executed /
                        Math.max(1, Number(target.target_missions || 0))) *
                        100
                    )
                )
              )
              const facilities = target.target_facilities ?? []
              const visitedFacilities = facilities.filter(
                (facility) => facility.is_visited
              ).length

              return (
                <article key={target.id} className="p-4 sm:p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black ' +
                            (target.scope_level === 'user'
                              ? 'bg-violet-50 text-violet-700'
                              : 'bg-blue-50 text-blue-700')
                          }
                        >
                          <ScopeIcon className="h-3 w-3" />
                          {scopeLabel(target)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">
                          {(target.target_type ?? 'aggregate') ===
                          'specific_facilities'
                            ? 'منشآت محددة'
                            : 'تراكمي بالعدد'}
                        </span>
                      </div>

                      <h2 className="mt-2 text-sm font-black text-slate-900">
                        {target.title}
                      </h2>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {target.scope_level === 'user'
                          ? target.assigned_user_name || target.scope_name
                          : target.scope_name}
                        {' · '}
                        {target.period_label}
                      </p>

                      {target.notes && (
                        <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-slate-400">
                          {target.notes}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-blue-50 p-2.5">
                          <p className="text-[8px] font-bold text-blue-700">
                            المستهدف
                          </p>
                          <p className="mt-1 text-base font-black text-blue-900">
                            {target.target_missions.toLocaleString('en-US')}
                          </p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 p-2.5">
                          <p className="text-[8px] font-bold text-emerald-700">
                            المنفذ
                          </p>
                          <p className="mt-1 text-base font-black text-emerald-900">
                            {executed.toLocaleString('en-US')}
                          </p>
                        </div>
                        <div className="rounded-xl bg-amber-50 p-2.5">
                          <p className="text-[8px] font-bold text-amber-700">
                            المتبقي
                          </p>
                          <p className="mt-1 text-base font-black text-amber-900">
                            {remaining.toLocaleString('en-US')}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[8px] font-bold text-slate-400">
                          <span>نسبة الإنجاز</span>
                          <span>{rate.toLocaleString('en-US')}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-teal-600"
                            style={{ width: rate + '%' }}
                          />
                        </div>
                      </div>

                      {facilities.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-500">
                          <Building2 className="h-3 w-3" />
                          منشآت محددة: {facilities.length.toLocaleString('en-US')}
                          {' · '}تم المرور على{' '}
                          {visitedFacilities.toLocaleString('en-US')}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {canManage && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-[10px] leading-5 text-slate-500">
          شاشة المتابعة أصبحت V2، بينما محرر إنشاء وتعديل المستهدفات ما زال
          مؤقتًا في شاشة الإدارة الحالية. عند نقله إلى V2 سنحافظ على نفس
          الفصل: المستهدف إما لمستخدم محدد أو لنطاق مكاني محدد.
        </div>
      )}
    </div>
  )
}
