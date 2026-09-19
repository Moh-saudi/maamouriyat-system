'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FolderKanban,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  UserRound,
  Users,
} from 'lucide-react'
import { CompactFilterSelect } from '@/components/ui/CompactFilterSelect'
import { getFacilityTypeLabel } from '@/config/facility-types'

type MissionMode = 'assigned' | 'issued' | 'oversight' | 'pending'

type MissionWorkspaceRow = {
  id: string
  serial_number: string
  status: string
  priority: string
  scheduled_date: string
  expected_end_date: string | null
  visit_purpose: string | null
  requires_overnight: boolean
  requires_hotel_booking: boolean
  checkin_time: string | null
  checkout_time: string | null
  gps_verified: boolean
  completed_at: string | null
  facility: {
    id: string
    name: string
    facility_type: string
    governorate: string | null
    health_admin: string | null
    village_city: string | null
  } | null
  creator: {
    id: string
    name: string
    job_title: string | null
  } | null
  primary_inspector: {
    id: string
    name: string
    job_title: string | null
  } | null
  team: Array<{
    id: string
    name: string
    job_title: string | null
    is_primary: boolean
  }>
  source: {
    type: 'target_user' | 'target_place' | 'program' | 'manual'
    label: string
    name: string | null
    target_type: string | null
  }
  relations: {
    assigned_to_me: boolean
    issued_by_me: boolean
    can_approve: boolean
    can_execute: boolean
  }
}

type WorkspacePayload = {
  rows?: MissionWorkspaceRow[]
  mode?: MissionMode
  page?: number
  page_size?: number
  total?: number
  pages?: number
  counts?: Record<MissionMode, number>
  can_approve?: boolean
  error?: string
}

const STATUS_OPTIONS = [
  { value: 'pending_approval', label: 'بانتظار الاعتماد' },
  { value: 'approved', label: 'معتمدة' },
  { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'completed', label: 'مكتملة' },
  { value: 'closed', label: 'مغلقة' },
  { value: 'rejected', label: 'مرفوضة' },
  { value: 'cancelled', label: 'ملغاة' },
] as const

function statusMeta(status: string) {
  if (status === 'pending_approval') {
    return {
      label: 'بانتظار الاعتماد',
      className: 'bg-amber-50 text-amber-800 ring-amber-100',
    }
  }
  if (status === 'approved') {
    return {
      label: 'معتمدة',
      className: 'bg-blue-50 text-blue-800 ring-blue-100',
    }
  }
  if (status === 'in_progress') {
    return {
      label: 'قيد التنفيذ',
      className: 'bg-teal-50 text-teal-800 ring-teal-100',
    }
  }
  if (status === 'completed') {
    return {
      label: 'مكتملة',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    }
  }
  if (status === 'closed') {
    return {
      label: 'مغلقة',
      className: 'bg-slate-100 text-slate-700 ring-slate-200',
    }
  }
  if (status === 'rejected') {
    return {
      label: 'مرفوضة',
      className: 'bg-rose-50 text-rose-800 ring-rose-100',
    }
  }
  if (status === 'cancelled') {
    return {
      label: 'ملغاة',
      className: 'bg-slate-100 text-slate-500 ring-slate-200',
    }
  }
  return {
    label: status,
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  }
}

function priorityLabel(priority: string) {
  if (priority === 'urgent') return 'عاجلة'
  if (priority === 'high') return 'مرتفعة'
  return 'عادية'
}

function sourceIcon(type: MissionWorkspaceRow['source']['type']) {
  if (type === 'target_user') return UserRound
  if (type === 'target_place') return Target
  if (type === 'program') return FolderKanban
  return MapPin
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value + (value.length === 10 ? 'T00:00:00' : ''))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function MissionWorkspacePanel() {
  const [mode, setMode] = useState<MissionMode>('assigned')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<MissionWorkspaceRow[]>([])
  const [counts, setCounts] = useState<Record<MissionMode, number>>({
    assigned: 0,
    issued: 0,
    oversight: 0,
    pending: 0,
  })
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [canApprove, setCanApprove] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          mode,
          page: String(page),
        })

        if (status) params.set('status', status)
        if (debouncedSearch) params.set('q', debouncedSearch)

        const response = await fetch(
          '/api/v2/missions/workspace?' + params.toString(),
          {
            cache: 'no-store',
            credentials: 'same-origin',
          }
        )

        const payload = (await response.json()) as WorkspacePayload
        if (!response.ok) {
          throw new Error(payload.error || 'تعذر تحميل المأموريات')
        }

        if (cancelled) return

        setRows(payload.rows ?? [])
        setCounts(
          payload.counts ?? {
            assigned: 0,
            issued: 0,
            oversight: 0,
            pending: 0,
          }
        )
        setTotal(payload.total ?? 0)
        setPages(payload.pages ?? 1)
        setCanApprove(payload.can_approve === true)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'تعذر تحميل المأموريات'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [debouncedSearch, mode, page, status])

  const tabs = useMemo(
    () =>
      [
        {
          id: 'assigned' as MissionMode,
          label: 'مكلف بها',
          note: 'أنا ضمن فريق التنفيذ',
          icon: BriefcaseBusiness,
        },
        {
          id: 'issued' as MissionMode,
          label: 'صادرة مني',
          note: 'أنا أعددت أو أصدرت التكليف',
          icon: ClipboardCheck,
        },
        {
          id: 'oversight' as MissionMode,
          label: 'داخل نطاق إشرافي',
          note: 'كل ما تسمح به صلاحياتي',
          icon: ShieldCheck,
        },
        ...(canApprove
          ? [
              {
                id: 'pending' as MissionMode,
                label: 'بانتظار اعتمادي',
                note: 'تكليفات تحتاج قراري',
                icon: Clock3,
              },
            ]
          : []),
      ],
    [canApprove]
  )

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = mode === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id)
                setPage(1)
              }}
              className={
                'rounded-2xl border p-4 text-right transition ' +
                (active
                  ? 'border-teal-300 bg-teal-50 ring-1 ring-teal-100'
                  : 'border-slate-200 bg-white hover:bg-slate-50')
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={
                    'flex h-9 w-9 items-center justify-center rounded-xl ' +
                    (active
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 text-slate-500')
                  }
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={
                    'rounded-full px-2.5 py-1 text-[10px] font-black ' +
                    (active
                      ? 'bg-white text-teal-800'
                      : 'bg-slate-100 text-slate-600')
                  }
                >
                  {counts[tab.id].toLocaleString('en-US')}
                </span>
              </div>
              <p className="mt-3 text-xs font-black text-slate-900">
                {tab.label}
              </p>
              <p className="mt-1 text-[9px] text-slate-400">{tab.note}</p>
            </button>
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
              placeholder="رقم المأمورية، المنشأة، المحافظة، المستخدم..."
              className="h-10 w-full rounded-xl border border-slate-200 pr-9 pl-3 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <CompactFilterSelect
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            placeholder="كل الحالات"
            className="w-52"
            options={STATUS_OPTIONS}
          />

          <button
            type="button"
            onClick={() => {
              setSearch('')
              setStatus('')
              setPage(1)
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-500 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            مسح الفلاتر
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
          <p className="text-[10px] font-bold text-slate-500">
            النتائج: {total.toLocaleString('en-US')}
          </p>
          {loading && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-teal-700">
              <Loader2 className="h-3 w-3 animate-spin" />
              تحديث...
            </span>
          )}
        </div>

        {loading && rows.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            جارٍ تحميل المأموريات...
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">
              لا توجد مأموريات مطابقة
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              جرّب تغيير التبويب أو الحالة أو عبارة البحث.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((mission) => {
              const statusInfo = statusMeta(mission.status)
              const SourceIcon = sourceIcon(mission.source.type)

              return (
                <article
                  key={mission.id}
                  className="px-4 py-4 transition hover:bg-slate-50/60 sm:px-5"
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,.8fr)_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-black text-teal-700">
                          {mission.serial_number}
                        </span>
                        <span
                          className={
                            'rounded-full px-2.5 py-1 text-[9px] font-black ring-1 ' +
                            statusInfo.className
                          }
                        >
                          {statusInfo.label}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">
                          أولوية {priorityLabel(mission.priority)}
                        </span>
                        {mission.relations.assigned_to_me && (
                          <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-700">
                            ضمن فريقي
                          </span>
                        )}
                        {mission.relations.issued_by_me && (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">
                            صادرة مني
                          </span>
                        )}
                      </div>

                      <h2 className="mt-2 truncate text-sm font-black text-slate-900">
                        {mission.facility?.name ?? 'منشأة غير متاحة'}
                      </h2>

                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {mission.facility?.governorate || '—'} ·{' '}
                          {mission.facility?.health_admin || '—'}
                        </span>
                        {mission.facility?.facility_type && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {getFacilityTypeLabel(
                              mission.facility.facility_type
                            )}
                          </span>
                        )}
                      </div>

                      {mission.visit_purpose && (
                        <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-slate-500">
                          {mission.visit_purpose}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                        <SourceIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-slate-400">
                            مصدر التكليف
                          </p>
                          <p className="mt-0.5 truncate text-[10px] font-extrabold text-slate-700">
                            {mission.source.label}
                            {mission.source.name
                              ? ' · ' + mission.source.name
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[9px]">
                        <div className="rounded-xl border border-slate-100 px-3 py-2">
                          <p className="font-bold text-slate-400">الموعد</p>
                          <p className="mt-1 font-extrabold text-slate-700">
                            {formatDate(mission.scheduled_date)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 px-3 py-2">
                          <p className="font-bold text-slate-400">الفريق</p>
                          <p className="mt-1 font-extrabold text-slate-700">
                            {mission.team.length.toLocaleString('en-US')} عضو
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-40 flex-col items-stretch justify-between gap-2">
                      <div className="text-[9px] text-slate-400 xl:text-left">
                        <p>
                          المصدر:{' '}
                          <span className="font-bold text-slate-600">
                            {mission.creator?.name || 'غير مسجل'}
                          </span>
                        </p>
                        <p className="mt-1">
                          رئيس الفريق:{' '}
                          <span className="font-bold text-slate-600">
                            {mission.primary_inspector?.name || 'غير مسجل'}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5 xl:justify-end">
                        {mission.relations.can_execute && (
                          <Link
                            href={'/dashboard/missions/' + mission.id + '/execute'}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal-700 px-2.5 text-[9px] font-bold text-white hover:bg-teal-800"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            تنفيذ المأمورية
                          </Link>
                        )}
                        {mission.relations.can_approve && (
                          <Link
                            href="/v2/missions/approvals"
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[9px] font-bold text-amber-800"
                          >
                            اعتماد التكليف
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  {mission.team.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {mission.team.slice(0, 6).map((member) => (
                        <span
                          key={member.id}
                          className={
                            'rounded-full px-2 py-1 text-[8px] font-bold ' +
                            (member.is_primary
                              ? 'bg-teal-50 text-teal-700'
                              : 'bg-slate-100 text-slate-500')
                          }
                        >
                          {member.name}
                          {member.is_primary ? ' · رئيس الفريق' : ''}
                        </span>
                      ))}
                      {mission.team.length > 6 && (
                        <span className="text-[8px] font-bold text-slate-400">
                          +{(mission.team.length - 6).toLocaleString('en-US')}
                        </span>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[9px] font-bold text-slate-600 disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              السابق
            </button>
            <span className="text-[9px] font-bold text-slate-400">
              صفحة {page.toLocaleString('en-US')} من{' '}
              {pages.toLocaleString('en-US')}
            </span>
            <button
              type="button"
              disabled={page >= pages || loading}
              onClick={() =>
                setPage((current) => Math.min(pages, current + 1))
              }
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[9px] font-bold text-slate-600 disabled:opacity-40"
            >
              التالي
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
