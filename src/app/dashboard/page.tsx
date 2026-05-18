import { redirect } from 'next/navigation'
import { DashboardShell } from '../system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AnalyticsDashboard, type ChartItem, type DashboardMetrics, type DashboardProfile } from './analytics-dashboard'

type MissionRow = {
  assigned_user_id: string | null
  scheduled_date: string | null
  status: string | null
  violation_count: number | null
}

type ViolationRow = {
  priority: string | null
  status: string | null
}

type FacilityRow = {
  facility_type: string | null
  is_active: boolean | null
}

type UserRow = {
  full_name: string | null
  job_title: string | null
  level: number | null
  department: string | null
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return (
      <DashboardShell view="dashboard">
        <AnalyticsDashboard metrics={demoMetrics} profile={demoProfile} />
      </DashboardShell>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('users')
    .select('full_name, job_title, level, department')
    .eq('auth_id', user.id)
    .maybeSingle<UserRow>()

  const [missionsResult, violationsResult, facilitiesResult, usersResult] = await Promise.allSettled([
    supabase.from('missions').select('status, scheduled_date, violation_count, assigned_user_id').limit(1000),
    supabase.from('violations').select('status, priority').limit(1000),
    supabase.from('facilities').select('facility_type, is_active').limit(1000),
    supabase.from('users').select('full_name, job_title, level, department').limit(1000),
  ])

  const missions = readRows<MissionRow>(missionsResult)
  const violations = readRows<ViolationRow>(violationsResult)
  const facilities = readRows<FacilityRow>(facilitiesResult)
  const users = readRows<UserRow>(usersResult)

  const profile: DashboardProfile = {
    department: profileData?.department ?? 'منظومة المأموريات',
    fullName: profileData?.full_name ?? user.email ?? 'مستخدم النظام',
    jobTitle: profileData?.job_title ?? 'حساب نظام',
    level: profileData?.level ?? 7,
  }

  const metrics = buildMetrics({ facilities, missions, users, violations })

  return (
    <DashboardShell view="dashboard">
      <AnalyticsDashboard metrics={metrics} profile={profile} />
    </DashboardShell>
  )
}

function readRows<T>(result: PromiseSettledResult<{ data: unknown; error: unknown }>) {
  if (result.status === 'rejected' || result.value.error || !Array.isArray(result.value.data)) {
    return [] as T[]
  }

  return result.value.data as T[]
}

function buildMetrics({
  facilities,
  missions,
  users,
  violations,
}: {
  facilities: FacilityRow[]
  missions: MissionRow[]
  users: UserRow[]
  violations: ViolationRow[]
}): DashboardMetrics {
  const completed = missions.filter((mission) => isCompleted(mission.status)).length
  const inProgress = missions.filter((mission) => isInProgress(mission.status)).length
  const pending = missions.filter((mission) => isPending(mission.status)).length
  const late = missions.filter((mission) => isLate(mission)).length
  const openViolations = violations.filter((violation) => !isViolationClosed(violation.status)).length
  const correctedViolations = violations.filter((violation) => isViolationClosed(violation.status)).length
  const highPriority = violations.filter((violation) => isHighPriority(violation.priority)).length
  const activeFacilities = facilities.filter((facility) => facility.is_active !== false).length
  const inspectors = users.filter((nextUser) => (nextUser.level ?? 0) >= 5).length

  return {
    activeFacilities,
    facilitiesTotal: facilities.length,
    highPriorityViolations: highPriority,
    inspectorsTotal: inspectors,
    missionsCompleted: completed,
    missionsInProgress: inProgress,
    missionsLate: late,
    missionsPending: pending,
    missionsTotal: missions.length,
    usersTotal: users.length,
    violationsCorrected: correctedViolations,
    violationsOpen: openViolations,
    violationsTotal: violations.length,
    facilityTypes: groupFacilities(facilities),
    missionStatus: [
      { label: 'مكتملة', value: completed, tone: 'green' },
      { label: 'قيد التنفيذ', value: inProgress, tone: 'blue' },
      { label: 'بانتظار الاعتماد', value: pending, tone: 'amber' },
      { label: 'متأخرة', value: late, tone: 'red' },
    ],
    monthlyTrend: buildMonthlyTrend(missions),
    violationStatus: [
      { label: 'مفتوحة', value: openViolations, tone: 'red' },
      { label: 'عالية الخطورة', value: highPriority, tone: 'amber' },
      { label: 'تم التصحيح', value: correctedViolations, tone: 'green' },
    ],
  }
}

function isCompleted(status: string | null) {
  return ['completed', 'closed', 'done', 'approved'].includes((status ?? '').toLowerCase())
}

function isInProgress(status: string | null) {
  return ['assigned', 'in_progress', 'executing', 'under_review'].includes((status ?? '').toLowerCase())
}

function isPending(status: string | null) {
  return ['draft', 'pending', 'planned', 'scheduled'].includes((status ?? '').toLowerCase())
}

function isLate(mission: MissionRow) {
  if (!mission.scheduled_date || isCompleted(mission.status)) {
    return false
  }

  const scheduledDate = new Date(mission.scheduled_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return scheduledDate < today
}

function isViolationClosed(status: string | null) {
  return ['corrected', 'verified', 'closed', 'resolved'].includes((status ?? '').toLowerCase())
}

function isHighPriority(priority: string | null) {
  return ['high', 'critical', 'urgent', 'عالية', 'حرجة'].includes((priority ?? '').toLowerCase())
}

function groupFacilities(facilities: FacilityRow[]): ChartItem[] {
  const grouped = new Map<string, number>()

  for (const facility of facilities) {
    const label = facility.facility_type || 'غير مصنف'
    grouped.set(label, (grouped.get(label) ?? 0) + 1)
  }

  return normalizeChartItems(
    Array.from(grouped.entries()).map(([label, value], index) => ({
      label,
      value,
      tone: ['teal', 'blue', 'green', 'amber'][index % 4] as ChartItem['tone'],
    })),
    [
      { label: 'مستشفيات', value: 0, tone: 'teal' },
      { label: 'عيادات', value: 0, tone: 'blue' },
      { label: 'معامل', value: 0, tone: 'green' },
    ],
  )
}

function buildMonthlyTrend(missions: MissionRow[]): ChartItem[] {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (5 - index))
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString('ar-EG', { month: 'short' }),
      value: 0,
      tone: 'teal' as ChartItem['tone'],
    }
  })

  for (const mission of missions) {
    if (!mission.scheduled_date) {
      continue
    }

    const date = new Date(mission.scheduled_date)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    const month = months.find((item) => item.key === key)
    if (month) {
      month.value += 1
    }
  }

  return months.map(({ key: _key, ...month }) => month)
}

function normalizeChartItems(items: ChartItem[], fallback: ChartItem[]) {
  return items.length ? items.slice(0, 5) : fallback
}

const demoProfile: DashboardProfile = {
  department: 'بيئة العرض التجريبي',
  fullName: 'مدير النظام',
  isDemo: true,
  jobTitle: 'مدير عام المتابعة',
  level: 1,
}

const demoMetrics: DashboardMetrics = {
  activeFacilities: 842,
  facilitiesTotal: 890,
  highPriorityViolations: 7,
  inspectorsTotal: 36,
  missionsCompleted: 124,
  missionsInProgress: 18,
  missionsLate: 5,
  missionsPending: 14,
  missionsTotal: 161,
  usersTotal: 48,
  violationsCorrected: 31,
  violationsOpen: 19,
  violationsTotal: 50,
  facilityTypes: [
    { label: 'مستشفيات', value: 420, tone: 'teal' },
    { label: 'عيادات', value: 260, tone: 'blue' },
    { label: 'معامل', value: 145, tone: 'green' },
    { label: 'مراكز', value: 65, tone: 'amber' },
  ],
  missionStatus: [
    { label: 'مكتملة', value: 124, tone: 'green' },
    { label: 'قيد التنفيذ', value: 18, tone: 'blue' },
    { label: 'بانتظار الاعتماد', value: 14, tone: 'amber' },
    { label: 'متأخرة', value: 5, tone: 'red' },
  ],
  monthlyTrend: [
    { label: 'ديسمبر', value: 18, tone: 'teal' },
    { label: 'يناير', value: 23, tone: 'teal' },
    { label: 'فبراير', value: 27, tone: 'teal' },
    { label: 'مارس', value: 31, tone: 'teal' },
    { label: 'أبريل', value: 29, tone: 'teal' },
    { label: 'مايو', value: 33, tone: 'teal' },
  ],
  violationStatus: [
    { label: 'مفتوحة', value: 19, tone: 'red' },
    { label: 'عالية الخطورة', value: 7, tone: 'amber' },
    { label: 'تم التصحيح', value: 31, tone: 'green' },
  ],
}
