export type MissionOperationalState =
  | 'upcoming'
  | 'current'
  | 'executed'
  | 'ended'
  | 'overdue'
  | 'pending'
  | 'rejected'
  | 'cancelled'
  | 'draft'

export type MissionOperationalStateMeta = {
  key: MissionOperationalState
  label: string
  badgeClassName: string
  dotClassName: string
  cardAccentClassName: string
}

type MissionLifecycleInput = {
  status?: string | null
  scheduledDate?: string | null
  expectedEndDate?: string | null
  actualStartDate?: string | null
  actualEndDate?: string | null
  today?: string
}

function normalizeStatus(value: string | null | undefined) {
  const status = (value || '').trim().toLowerCase()

  if (['منفذة', 'مكتملة'].includes(value || '')) return 'completed'
  if ((value || '') === 'مغلقة') return 'closed'
  if ((value || '') === 'ملغاة') return 'cancelled'
  if ((value || '') === 'مرفوضة') return 'rejected'

  return status
}

export function getEgyptDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10)
  }

  return `${year}-${month}-${day}`
}

export function resolveMissionOperationalState(
  input: MissionLifecycleInput
): MissionOperationalStateMeta {
  const status = normalizeStatus(input.status)
  const today = input.today || getEgyptDateKey()
  const plannedStart = input.scheduledDate || null
  const plannedEnd = input.expectedEndDate || plannedStart
  const actualStart = input.actualStartDate || null
  const actualEnd = input.actualEndDate || null

  if (status === 'cancelled') return MISSION_OPERATIONAL_STATE.cancelled
  if (status === 'rejected') return MISSION_OPERATIONAL_STATE.rejected
  if (status === 'pending_approval') return MISSION_OPERATIONAL_STATE.pending
  if (status === 'draft') return MISSION_OPERATIONAL_STATE.draft
  if (status === 'closed') return MISSION_OPERATIONAL_STATE.ended

  if (
    status === 'completed' ||
    status === 'done' ||
    actualEnd
  ) {
    return MISSION_OPERATIONAL_STATE.executed
  }

  if (
    status === 'in_progress' ||
    status === 'executing' ||
    actualStart
  ) {
    return MISSION_OPERATIONAL_STATE.current
  }

  if (plannedEnd && plannedEnd < today) {
    return MISSION_OPERATIONAL_STATE.overdue
  }

  if (
    status === 'approved' ||
    status === 'assigned' ||
    plannedStart
  ) {
    return MISSION_OPERATIONAL_STATE.upcoming
  }

  return MISSION_OPERATIONAL_STATE.current
}

export const MISSION_OPERATIONAL_STATE: Record<
  MissionOperationalState,
  MissionOperationalStateMeta
> = {
  upcoming: {
    key: 'upcoming',
    label: 'قادمة',
    badgeClassName: 'bg-sky-50 text-sky-800 ring-sky-100',
    dotClassName: 'bg-sky-500',
    cardAccentClassName: 'border-r-sky-500',
  },
  current: {
    key: 'current',
    label: 'جارية',
    badgeClassName: 'bg-teal-50 text-teal-800 ring-teal-100',
    dotClassName: 'bg-teal-500',
    cardAccentClassName: 'border-r-teal-500',
  },
  executed: {
    key: 'executed',
    label: 'منفذة',
    badgeClassName: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    dotClassName: 'bg-emerald-500',
    cardAccentClassName: 'border-r-emerald-500',
  },
  ended: {
    key: 'ended',
    label: 'منتهية',
    badgeClassName: 'bg-indigo-50 text-indigo-800 ring-indigo-100',
    dotClassName: 'bg-indigo-500',
    cardAccentClassName: 'border-r-indigo-500',
  },
  overdue: {
    key: 'overdue',
    label: 'متأخرة',
    badgeClassName: 'bg-rose-50 text-rose-800 ring-rose-100',
    dotClassName: 'bg-rose-500',
    cardAccentClassName: 'border-r-rose-500',
  },
  pending: {
    key: 'pending',
    label: 'بانتظار الاعتماد',
    badgeClassName: 'bg-amber-50 text-amber-800 ring-amber-100',
    dotClassName: 'bg-amber-500',
    cardAccentClassName: 'border-r-amber-500',
  },
  rejected: {
    key: 'rejected',
    label: 'مرفوضة',
    badgeClassName: 'bg-rose-50 text-rose-800 ring-rose-100',
    dotClassName: 'bg-rose-500',
    cardAccentClassName: 'border-r-rose-500',
  },
  cancelled: {
    key: 'cancelled',
    label: 'ملغاة',
    badgeClassName: 'bg-slate-100 text-slate-500 ring-slate-200',
    dotClassName: 'bg-slate-400',
    cardAccentClassName: 'border-r-slate-400',
  },
  draft: {
    key: 'draft',
    label: 'مسودة',
    badgeClassName: 'bg-slate-100 text-slate-600 ring-slate-200',
    dotClassName: 'bg-slate-400',
    cardAccentClassName: 'border-r-slate-400',
  },
}
