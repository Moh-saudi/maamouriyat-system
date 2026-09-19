'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FolderKanban,
  Layers3,
  Loader2,
  MapPin,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  UserRound,
} from 'lucide-react'
import { CompactFilterSelect } from '@/components/ui/CompactFilterSelect'
import { getFacilityTypeLabel } from '@/config/facility-types'
import {
  MISSION_OPERATIONAL_STATE,
  resolveMissionOperationalState,
  type MissionOperationalState,
} from '@/config/mission-lifecycle'

type MissionMode = 'assigned' | 'issued' | 'oversight' | 'pending'

type ModeCount = {
  batches: number
  missions: number
}

type AssignmentGroup = {
  group_key: string
  batch_id: string | null
  legacy_mission_id: string | null
  mission_count: number
  facility_count: number
  status: string
  operational_state: MissionOperationalState
  status_counts: Record<string, number>
  completed_count: number
  remaining_count: number
  completion_rate: number
  overdue_count: number
  scheduled_date: string
  expected_end_date: string | null
  priority: string
  visit_purpose: string | null
  creator: {
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
  team_member_count: number
  source: {
    type: 'target_user' | 'target_place' | 'program' | 'manual'
    label: string
    name: string | null
    target_type: string | null
  }
  governorates: string[]
  health_admins: string[]
  sample_facilities: string[]
  relations: {
    assigned_to_me: boolean
    issued_by_me: boolean
    can_approve: boolean
    executable_mission_count: number
  }
}

type DetailMission = {
  id: string
  serial_number: string
  status: string
  priority: string
  scheduled_date: string
  expected_end_date: string | null
  visit_purpose: string | null
  checkin_time: string | null
  checkout_time: string | null
  gps_verified: boolean
  completed_at: string | null
  actual_start_date: string | null
  actual_end_date: string | null
  actual_duration_days: number | null
  actual_overnight_nights: number | null
  completion_disposition: string | null
  timing_adjustment_reason: string | null
  facility: {
    id: string
    name: string
    facility_type: string
    governorate: string | null
    health_admin: string | null
    village_city: string | null
    organization_name: string
    sector_name: string | null
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
  relations: {
    assigned_to_me: boolean
    issued_by_me: boolean
    can_approve: boolean
    can_execute: boolean
  }
}

type WorkspacePayload = {
  rows?: AssignmentGroup[]
  mode?: MissionMode
  page?: number
  page_size?: number
  total_batches?: number
  total_missions?: number
  pages?: number
  counts?: Record<MissionMode, ModeCount>
  can_approve?: boolean
  error?: string
}

type DetailPayload = {
  rows?: DetailMission[]
  mission_count?: number
  error?: string
}

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'قادمة' },
  { value: 'current', label: 'جارية' },
  { value: 'executed', label: 'منفذة' },
  { value: 'ended', label: 'منتهية' },
  { value: 'overdue', label: 'متأخرة' },
  { value: 'pending', label: 'بانتظار الاعتماد' },
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
  if (status === 'mixed') {
    return {
      label: 'حالات متعددة',
      className: 'bg-violet-50 text-violet-700 ring-violet-100',
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

function sourceIcon(type: AssignmentGroup['source']['type']) {
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

function locationSummary(group: AssignmentGroup) {
  if (group.governorates.length > 1) {
    return group.governorates.length.toLocaleString('en-US') + ' محافظات'
  }

  if (group.health_admins.length > 1) {
    const governorate = group.governorates[0]
    return (
      (governorate ? governorate + ' · ' : '') +
      group.health_admins.length.toLocaleString('en-US') +
      ' إدارات صحية'
    )
  }

  return (
    group.health_admins[0] ??
    group.governorates[0] ??
    'نطاق غير محدد'
  )
}

function geographicGroups(rows: DetailMission[]) {
  const groups = new Map<
    string,
    {
      label: string
      governorate: string
      healthAdmin: string
      rows: DetailMission[]
    }
  >()

  for (const row of rows) {
    const governorate = row.facility?.governorate || 'غير محدد'
    const healthAdmin = row.facility?.health_admin || 'بدون إدارة صحية'
    const key = governorate + '::' + healthAdmin
    const current = groups.get(key) ?? {
      label:
        healthAdmin === 'بدون إدارة صحية'
          ? governorate
          : governorate + ' · ' + healthAdmin,
      governorate,
      healthAdmin,
      rows: [],
    }
    current.rows.push(row)
    groups.set(key, current)
  }

  return [...groups.values()]
}

function MissionDetailRow({
  mission,
  grouped,
  batchId,
}: {
  mission: DetailMission
  grouped: boolean
  batchId: string | null
}) {
  const status = statusMeta(mission.status)
  const lifecycle = resolveMissionOperationalState({
    status: mission.status,
    scheduledDate: mission.scheduled_date,
    expectedEndDate: mission.expected_end_date,
    actualStartDate: mission.actual_start_date,
    actualEndDate: mission.actual_end_date,
  })

  return (
    <div className="grid gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={'h-2.5 w-2.5 rounded-full ' + lifecycle.dotClassName} />
          <span className={'rounded-full px-2 py-0.5 text-[8px] font-black ring-1 ' + lifecycle.badgeClassName}>
            {lifecycle.label}
          </span>
          <span className="font-mono text-[9px] font-black text-teal-700">
            {mission.serial_number}
          </span>
          <span
            className={
              'rounded-full px-2 py-0.5 text-[8px] font-black ring-1 ' +
              status.className
            }
          >
            {status.label}
          </span>
          {mission.gps_verified && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-700">
              GPS موثق
            </span>
          )}
        </div>

        <p className="mt-1.5 truncate text-[11px] font-extrabold text-slate-800">
          {mission.facility?.name ?? 'منشأة غير متاحة'}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[8px] font-bold">
          <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
            المحافظة: {mission.facility?.governorate || 'غير محددة'}
          </span>
          <span className="rounded-full bg-teal-50 px-2 py-1 text-teal-700">
            الإدارة الصحية: {mission.facility?.health_admin || 'غير محددة'}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
            التبعية: {mission.facility?.organization_name || 'غير محددة'}
          </span>
          {mission.facility?.sector_name && (
            <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">
              القطاع: {mission.facility.sector_name}
            </span>
          )}
          {mission.facility?.facility_type && (
            <span className="rounded-full bg-slate-50 px-2 py-1 text-slate-500">
              {getFacilityTypeLabel(mission.facility.facility_type)}
            </span>
          )}
        </div>
        {mission.primary_inspector?.name && (
          <p className="mt-1 text-[8px] text-slate-400">
            رئيس الفريق: {mission.primary_inspector.name}
          </p>
        )}
        {mission.actual_duration_days && (
          <p className="mt-1 text-[8px] font-bold text-slate-500">
            المدة الفعلية: {mission.actual_duration_days.toLocaleString('en-US')} يوم
            {mission.actual_overnight_nights !== null
              ? ' · ' + mission.actual_overnight_nights.toLocaleString('en-US') + ' ليلة'
              : ''}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        <span className="text-[9px] font-bold text-slate-400">
          {formatDate(mission.scheduled_date)}
        </span>
        {(lifecycle.key === 'executed' ||
          lifecycle.key === 'ended' ||
          !grouped) && (
          <Link
            href={
              lifecycle.key === 'executed' || lifecycle.key === 'ended'
                ? '/dashboard/missions/' + mission.id + '/print'
                : batchId
                  ? '/v2/print/missions/assignments/' + batchId
                  : '/dashboard/missions/' + mission.id + '/print'
            }
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[9px] font-bold text-slate-600 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            {lifecycle.key === 'executed' || lifecycle.key === 'ended'
              ? 'طباعة التقرير'
              : 'طباعة التكليف'}
          </Link>
        )}
        {mission.relations.can_execute && (
          <Link
            href={'/dashboard/missions/' + mission.id + '/execute'}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal-700 px-2.5 text-[9px] font-bold text-white hover:bg-teal-800"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            تنفيذ
          </Link>
        )}
      </div>
    </div>
  )
}

export function MissionWorkspacePanel({
  defaultMode = 'assigned',
}: {
  defaultMode?: MissionMode
}) {
  const [mode, setMode] = useState<MissionMode>(defaultMode)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AssignmentGroup[]>([])
  const [counts, setCounts] = useState<Record<MissionMode, ModeCount>>({
    assigned: { batches: 0, missions: 0 },
    issued: { batches: 0, missions: 0 },
    oversight: { batches: 0, missions: 0 },
    pending: { batches: 0, missions: 0 },
  })
  const [totalBatches, setTotalBatches] = useState(0)
  const [totalMissions, setTotalMissions] = useState(0)
  const [pages, setPages] = useState(1)
  const [canApprove, setCanApprove] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [detailLoading, setDetailLoading] = useState<Set<string>>(
    new Set()
  )
  const [details, setDetails] = useState<
    Record<string, DetailMission[]>
  >({})

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setExpanded(new Set())
    setDetails({})
  }, [mode, status, debouncedSearch])

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
            assigned: { batches: 0, missions: 0 },
            issued: { batches: 0, missions: 0 },
            oversight: { batches: 0, missions: 0 },
            pending: { batches: 0, missions: 0 },
          }
        )
        setTotalBatches(payload.total_batches ?? 0)
        setTotalMissions(payload.total_missions ?? 0)
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

  async function toggleGroup(groupKey: string) {
    if (expanded.has(groupKey)) {
      setExpanded((current) => {
        const next = new Set(current)
        next.delete(groupKey)
        return next
      })
      return
    }

    setExpanded((current) => new Set(current).add(groupKey))

    if (details[groupKey]) return

    setDetailLoading((current) => new Set(current).add(groupKey))

    try {
      const params = new URLSearchParams({
        group_key: groupKey,
        mode,
      })
      const response = await fetch(
        '/api/v2/missions/workspace/details?' + params.toString(),
        {
          cache: 'no-store',
          credentials: 'same-origin',
        }
      )
      const payload = (await response.json()) as DetailPayload

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل تفاصيل التكليف')
      }

      setDetails((current) => ({
        ...current,
        [groupKey]: payload.rows ?? [],
      }))
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : 'تعذر تحميل تفاصيل التكليف'
      )
      setExpanded((current) => {
        const next = new Set(current)
        next.delete(groupKey)
        return next
      })
    } finally {
      setDetailLoading((current) => {
        const next = new Set(current)
        next.delete(groupKey)
        return next
      })
    }
  }

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
          const count = counts[tab.id]

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
                  {count.batches.toLocaleString('en-US')} تكليف
                </span>
              </div>
              <p className="mt-3 text-xs font-black text-slate-900">
                {tab.label}
              </p>
              <p className="mt-1 text-[9px] text-slate-400">
                {tab.note} · {count.missions.toLocaleString('en-US')} مأمورية
              </p>
            </button>
          )
        })}
      </section>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className="text-[9px] font-black text-slate-400">دليل الحالة:</span>
        {(['upcoming', 'current', 'executed', 'ended', 'overdue'] as MissionOperationalState[]).map(
          (key) => {
            const item = MISSION_OPERATIONAL_STATE[key]
            return (
              <span
                key={key}
                className={
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold ring-1 ' +
                  item.badgeClassName
                }
              >
                <span className={'h-2 w-2 rounded-full ' + item.dotClassName} />
                {item.label}
              </span>
            )
          }
        )}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 sm:p-4">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="التكليف، المنشأة، المحافظة، المستخدم، المشروع..."
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

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
          <p className="text-[10px] font-bold text-slate-600">
            {totalBatches.toLocaleString('en-US')} تكليفات ·{' '}
            {totalMissions.toLocaleString('en-US')} مأمورية ميدانية
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
            جارٍ تحميل التكليفات...
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">
              لا توجد تكليفات مطابقة
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              جرّب تغيير التبويب أو الحالة أو عبارة البحث.
            </p>
          </div>
        ) : (
          <div className="space-y-3 bg-slate-50/30 p-3 sm:p-4">
            {rows.map((group) => {
              const opened = expanded.has(group.group_key)
              const loadingDetails = detailLoading.has(group.group_key)
              const groupDetails = details[group.group_key] ?? []
              const SourceIcon = sourceIcon(group.source.type)
              const overallStatus = statusMeta(group.status)
              const lifecycle = MISSION_OPERATIONAL_STATE[group.operational_state]
              const geography = geographicGroups(groupDetails)
              const useGeographicSections =
                groupDetails.length > 8 && geography.length > 1

              return (
                <article
                  key={group.group_key}
                  className={
                    'overflow-hidden rounded-2xl border border-r-4 bg-white shadow-sm transition ' +
                    lifecycle.cardAccentClassName +
                    ' ' +
                    (opened
                      ? 'border-teal-200 ring-1 ring-teal-50'
                      : 'border-slate-200')
                  }
                >
                  <button
                    type="button"
                    onClick={() => void toggleGroup(group.group_key)}
                    className="w-full p-4 text-right sm:p-5"
                  >
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_360px_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[9px] font-black text-teal-800">
                            <Layers3 className="h-3 w-3" />
                            {group.governorates.length > 1
                              ? 'سجل قديم مجمع'
                              : group.batch_id
                                ? 'تكليف مجمع'
                                : 'تكليف منفرد'}
                          </span>
                          <span
                            className={
                              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black ring-1 ' +
                              lifecycle.badgeClassName
                            }
                          >
                            <span className={'h-2 w-2 rounded-full ' + lifecycle.dotClassName} />
                            {lifecycle.label}
                          </span>
                          {group.status !== group.operational_state && group.status !== 'approved' && (
                            <span
                              className={
                                'rounded-full px-2 py-0.5 text-[8px] font-bold ring-1 ' +
                                overallStatus.className
                              }
                            >
                              {overallStatus.label}
                            </span>
                          )}
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">
                            أولوية {priorityLabel(group.priority)}
                          </span>
                          {group.governorates.length > 1 && (
                            <span className="rounded-full bg-rose-50 px-2 py-1 text-[9px] font-black text-rose-700 ring-1 ring-rose-100">
                              سجل قديم متعدد المحافظات
                            </span>
                          )}
                          {group.overdue_count > 0 && (
                            <span className="rounded-full bg-rose-50 px-2 py-1 text-[9px] font-black text-rose-700">
                              {group.overdue_count.toLocaleString('en-US')} متأخرة
                            </span>
                          )}
                        </div>

                        <h2 className="mt-2 text-sm font-black text-slate-900">
                          {group.governorates.length > 1
                            ? group.facility_count.toLocaleString('en-US') +
                              ' منشأة موزعة على ' +
                              group.governorates.length.toLocaleString('en-US') +
                              ' محافظات — يلزم الفصل'
                            : group.mission_count > 1
                              ? group.facility_count.toLocaleString('en-US') +
                                ' منشأة ضمن تكليف واحد'
                              : group.sample_facilities[0] ??
                                'تكليف مأمورية'}
                        </h2>

                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {locationSummary(group)}
                          </span>
                          <span>
                            {formatDate(group.scheduled_date)}
                            {group.expected_end_date &&
                            group.expected_end_date !== group.scheduled_date
                              ? ' ← ' +
                                formatDate(group.expected_end_date)
                              : ''}
                          </span>
                          <span>
                            {group.team_member_count.toLocaleString('en-US')} عضو فريق
                          </span>
                        </div>

                        {group.visit_purpose && (
                          <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-slate-500">
                            {group.visit_purpose}
                          </p>
                        )}

                        {group.sample_facilities.length > 1 && (
                          <p className="mt-2 truncate text-[9px] text-slate-400">
                            {group.sample_facilities.join(' · ')}
                            {group.facility_count >
                            group.sample_facilities.length
                              ? ' · + ' +
                                (
                                  group.facility_count -
                                  group.sample_facilities.length
                                ).toLocaleString('en-US') +
                                ' أخرى'
                              : ''}
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                          <SourceIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold text-slate-400">
                              مصدر التكليف
                            </p>
                            <p className="mt-0.5 truncate text-[10px] font-extrabold text-slate-700">
                              {group.source.label}
                              {group.source.name
                                ? ' · ' + group.source.name
                                : ''}
                            </p>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[8px] font-bold text-slate-400">
                            <span>
                              التنفيذ {group.completed_count.toLocaleString('en-US')} /{' '}
                              {group.mission_count.toLocaleString('en-US')}
                            </span>
                            <span>
                              {group.completion_rate.toLocaleString('en-US')}%
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-teal-600"
                              style={{
                                width:
                                  Math.min(
                                    100,
                                    group.completion_rate
                                  ).toLocaleString('en-US') + '%',
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {Object.entries(group.status_counts).map(
                            ([statusKey, count]) => {
                              const info = statusMeta(statusKey)
                              return (
                                <span
                                  key={statusKey}
                                  className={
                                    'rounded-full px-2 py-0.5 text-[8px] font-bold ring-1 ' +
                                    info.className
                                  }
                                >
                                  {info.label}{' '}
                                  {count.toLocaleString('en-US')}
                                </span>
                              )
                            }
                          )}
                        </div>
                      </div>

                      <div className="flex min-w-44 flex-col justify-between gap-3 xl:items-end">
                        <div className="text-[9px] text-slate-400 xl:text-left">
                          <p>
                            المصدر:{' '}
                            <span className="font-bold text-slate-600">
                              {group.creator?.name || 'غير مسجل'}
                            </span>
                          </p>
                          <p className="mt-1">
                            الفريق:{' '}
                            <span className="font-bold text-slate-600">
                              {group.team
                                .slice(0, 2)
                                .map((member) => member.name)
                                .join('، ') || 'غير مسجل'}
                              {group.team_member_count > 2
                                ? ' +' +
                                  (
                                    group.team_member_count - 2
                                  ).toLocaleString('en-US')
                                : ''}
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 text-[9px] font-black text-teal-700">
                          {group.mission_count.toLocaleString('en-US')} مأمورية
                          {loadingDetails ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ChevronDown
                              className={
                                'h-4 w-4 transition-transform ' +
                                (opened ? 'rotate-180' : '')
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {group.batch_id && (
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-2.5">
                      {group.relations.executable_mission_count > 0 && (
                        <Link
                          href={
                            '/v2/missions/assignments/' +
                            group.batch_id +
                            '/execute'
                          }
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-700 px-3 text-[9px] font-black text-white hover:bg-teal-800"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          تنفيذ التكليف
                        </Link>
                      )}
                      {group.governorates.length > 1 ? (
                        <>
                          <span className="ml-auto text-[9px] font-bold text-rose-600">
                            السجل قديم؛ الطباعة مفصولة حسب المحافظة
                          </span>
                          {group.governorates.map((governorate) => (
                            <Link
                              key={governorate}
                              href={
                                '/v2/print/missions/assignments/' +
                                group.batch_id +
                                '?governorate=' +
                                encodeURIComponent(governorate)
                              }
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[9px] font-bold text-rose-700 hover:bg-rose-100"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              طباعة {governorate}
                            </Link>
                          ))}
                        </>
                      ) : (
                        <Link
                          href={
                            '/v2/print/missions/assignments/' +
                            group.batch_id
                          }
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-[9px] font-bold text-teal-800 hover:bg-teal-100"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          طباعة التكليف المجمع
                        </Link>
                      )}
                    </div>
                  )}

                  {opened && (
                    <div className="border-t border-teal-100 bg-slate-50/60 p-3 sm:p-4">
                      {loadingDetails ? (
                        <div className="flex min-h-28 items-center justify-center gap-2 text-xs text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          جارٍ تحميل منشآت التكليف...
                        </div>
                      ) : groupDetails.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-400">
                          لا توجد مأموريات متاحة داخل هذا التكليف في نطاقك.
                        </div>
                      ) : useGeographicSections ? (
                        <div className="space-y-2">
                          {geography.map((geo) => (
                            <details
                              key={geo.label}
                              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                            >
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5 text-teal-700" />
                                  <span className="text-[10px] font-black text-slate-700">
                                    {geo.label}
                                  </span>
                                </div>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold text-slate-500">
                                  {geo.rows.length.toLocaleString('en-US')} مأمورية
                                </span>
                              </summary>
                              <div className="border-t border-slate-100">
                                {geo.rows.map((mission) => (
                                  <MissionDetailRow
                                    key={mission.id}
                                    mission={mission}
                                    grouped={group.mission_count > 1}
                                    batchId={group.batch_id}
                                  />
                                ))}
                              </div>
                            </details>
                          ))}
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                          {groupDetails.map((mission) => (
                            <MissionDetailRow
                              key={mission.id}
                              mission={mission}
                              grouped={group.mission_count > 1}
                              batchId={group.batch_id}
                            />
                          ))}
                        </div>
                      )}

                      {group.relations.can_approve && (
                        <div className="mt-3 flex justify-end">
                          <Link
                            href="/v2/missions/approvals"
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[9px] font-bold text-amber-800"
                          >
                            اعتماد التكليف
                          </Link>
                        </div>
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
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
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
                setPage((current) =>
                  Math.min(pages, current + 1)
                )
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
