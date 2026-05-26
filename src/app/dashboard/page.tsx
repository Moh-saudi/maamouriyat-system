import { redirect } from 'next/navigation'
import { DashboardShell } from '../system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDemoSessionRole, type DemoRole } from '@/lib/demo-session'
import { AnalyticsDashboard, type ChartItem, type DashboardMetrics, type DashboardProfile, type RankingItem } from './analytics-dashboard'

type MissionRow = {
  assigned_user_id: string | null
  actual_facility_id: string | null
  actual_governorate_id: string | null
  completed_at: string | null
  scheduled_date: string | null
  status: string | null
  target_facility_id: string | null
  target_governorate_id: string | null
  violation_count: number | null
}

type ViolationRow = {
  facility_id: string | null
  priority: string | null
  status: string | null
}

type FacilityRow = {
  id: string
  facility_type: string | null
  governorate_id: string | null
  is_active: boolean | null
}

type UserRow = {
  id: string
  full_name: string | null
  job_title: string | null
  level: number | null
  department: string | null
}

type GovernorateRow = {
  id: string
  name: string | null
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const demoRole = await getDemoSessionRole()
  const supabase = await createServerSupabaseClient()

  if (!supabase || demoRole) {
    const demoDashboard = getDemoDashboard(demoRole ?? 'superadmin')
    return (
      <DashboardShell role={demoRole ?? 'superadmin'} view="dashboard">
        <AnalyticsDashboard metrics={demoDashboard.metrics} profile={demoDashboard.profile} />
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

  const [missionsResult, violationsResult, facilitiesResult, usersResult, governoratesResult] = await Promise.allSettled([
    supabase
      .from('missions')
      .select(
        'status, scheduled_date, completed_at, violation_count, assigned_user_id, target_facility_id, target_governorate_id, actual_facility_id, actual_governorate_id',
      )
      .limit(1000),
    supabase.from('violations').select('status, priority, facility_id').limit(1000),
    supabase.from('facilities').select('id, facility_type, is_active, governorate_id').limit(1000),
    supabase.from('users').select('id, full_name, job_title, level, department').limit(1000),
    supabase.from('governorates').select('id, name').limit(1000),
  ])

  const missions = readRows<MissionRow>(missionsResult)
  const violations = readRows<ViolationRow>(violationsResult)
  const facilities = readRows<FacilityRow>(facilitiesResult)
  const users = readRows<UserRow>(usersResult)
  const governorates = readRows<GovernorateRow>(governoratesResult)

  const profile: DashboardProfile = {
    department: profileData?.department ?? 'منظومة المأموريات',
    fullName: profileData?.full_name ?? user.email ?? 'مستخدم النظام',
    jobTitle: profileData?.job_title ?? 'حساب نظام',
    level: profileData?.level ?? 7,
  }

  const metrics = buildMetrics({ facilities, governorates, missions, users, violations })

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
  governorates,
  missions,
  users,
  violations,
}: {
  facilities: FacilityRow[]
  governorates: GovernorateRow[]
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
  const mediumPriority = violations.filter((violation) => isMediumPriority(violation.priority)).length
  const lowPriority = violations.filter((violation) => isLowPriority(violation.priority)).length
  const activeFacilities = facilities.filter((facility) => facility.is_active !== false).length
  const inspectors = users.filter((nextUser) => (nextUser.level ?? 0) >= 5).length
  const violatingFacilities = new Set(violations.map((violation) => violation.facility_id).filter(Boolean)).size
  const governorateMap = new Map(governorates.map((governorate) => [governorate.id, governorate.name ?? 'غير محدد']))
  const facilityMap = new Map(facilities.map((facility) => [facility.id, facility]))
  const userMap = new Map(users.map((nextUser) => [nextUser.id, nextUser]))

  return {
    activeFacilities,
    facilitiesTotal: facilities.length,
    highPriorityViolations: highPriority,
    inspectorsTotal: inspectors,
    lowPriorityViolations: lowPriority,
    mediumPriorityViolations: mediumPriority,
    missionsCompleted: completed,
    missionsInProgress: inProgress,
    missionsLate: late,
    missionsPending: pending,
    missionsTotal: missions.length,
    usersTotal: users.length,
    violatingFacilities,
    violationsCorrected: correctedViolations,
    violationsOpen: openViolations,
    violationsTotal: violations.length,
    facilityTypes: groupFacilities(facilities),
    governorateVisits: groupGovernorateVisits(missions, facilityMap, governorateMap),
    missionStatus: [
      { label: 'مكتملة', value: completed, tone: 'green' },
      { label: 'قيد التنفيذ', value: inProgress, tone: 'blue' },
      { label: 'بانتظار الاعتماد', value: pending, tone: 'amber' },
      { label: 'متأخرة', value: late, tone: 'red' },
    ],
    monthlyTrend: buildMonthlyTrend(missions),
    priorityBreakdown: [
      { label: 'حرجة', value: highPriority, tone: 'red' },
      { label: 'متوسطة', value: mediumPriority, tone: 'amber' },
      { label: 'بسيطة', value: lowPriority, tone: 'blue' },
      { label: 'تم التصحيح', value: correctedViolations, tone: 'green' },
    ],
    topInspectors: buildTopInspectors(missions, userMap),
    visitDaysByGovernorate: groupVisitDaysByGovernorate(missions, facilityMap, governorateMap),
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

function isMediumPriority(priority: string | null) {
  return ['normal', 'medium', 'متوسطة'].includes((priority ?? '').toLowerCase())
}

function isLowPriority(priority: string | null) {
  return ['low', 'minor', 'بسيطة', 'منخفضة'].includes((priority ?? '').toLowerCase())
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

function groupGovernorateVisits(
  missions: MissionRow[],
  facilities: Map<string, FacilityRow>,
  governorates: Map<string, string>,
): ChartItem[] {
  const grouped = new Map<string, number>()

  for (const mission of missions) {
    const label = resolveGovernorateName(mission, facilities, governorates)
    grouped.set(label, (grouped.get(label) ?? 0) + 1)
  }

  return topChartItems(grouped, 'teal')
}

function groupVisitDaysByGovernorate(
  missions: MissionRow[],
  facilities: Map<string, FacilityRow>,
  governorates: Map<string, string>,
): ChartItem[] {
  const grouped = new Map<string, Set<string>>()

  for (const mission of missions) {
    const date = mission.completed_at ?? mission.scheduled_date
    if (!date) {
      continue
    }

    const label = resolveGovernorateName(mission, facilities, governorates)
    const bucket = grouped.get(label) ?? new Set<string>()
    bucket.add(date.slice(0, 10))
    grouped.set(label, bucket)
  }

  const counts = new Map(Array.from(grouped.entries()).map(([label, days]) => [label, days.size]))
  return topChartItems(counts, 'blue')
}

function buildTopInspectors(missions: MissionRow[], users: Map<string, UserRow>): RankingItem[] {
  const grouped = new Map<string, number>()

  for (const mission of missions) {
    if (!mission.assigned_user_id) {
      continue
    }

    grouped.set(mission.assigned_user_id, (grouped.get(mission.assigned_user_id) ?? 0) + 1)
  }

  const ranked = Array.from(grouped.entries())
    .map(([userId, value]) => {
      const user = users.get(userId)
      return {
        detail: user?.job_title ?? 'قائم بالمرور',
        label: user?.full_name ?? 'مستخدم غير محدد',
        value,
      }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return ranked.length
    ? ranked
    : [
        { detail: 'تفتيش ومتابعة', label: 'أحمد محمود', value: 18 },
        { detail: 'تفتيش منشآت', label: 'سارة خالد', value: 15 },
        { detail: 'مشرف ميداني', label: 'محمد علي', value: 12 },
      ]
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

function resolveGovernorateName(
  mission: MissionRow,
  facilities: Map<string, FacilityRow>,
  governorates: Map<string, string>,
) {
  const governorateId =
    mission.actual_governorate_id ??
    mission.target_governorate_id ??
    facilities.get(mission.actual_facility_id ?? '')?.governorate_id ??
    facilities.get(mission.target_facility_id ?? '')?.governorate_id

  return (governorateId && governorates.get(governorateId)) || 'غير محدد'
}

function topChartItems(grouped: Map<string, number>, tone: ChartItem['tone']) {
  const items = Array.from(grouped.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], index) => ({
      label,
      value,
      tone: (index % 3 === 0 ? tone : index % 3 === 1 ? 'teal' : 'amber') as ChartItem['tone'],
    }))

  return normalizeChartItems(items, [
    { label: 'القاهرة', value: 0, tone },
    { label: 'الجيزة', value: 0, tone: 'teal' },
    { label: 'الإسكندرية', value: 0, tone: 'amber' },
  ])
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
  lowPriorityViolations: 21,
  mediumPriorityViolations: 22,
  missionsCompleted: 124,
  missionsInProgress: 18,
  missionsLate: 5,
  missionsPending: 14,
  missionsTotal: 161,
  usersTotal: 48,
  violatingFacilities: 42,
  violationsCorrected: 31,
  violationsOpen: 19,
  violationsTotal: 50,
  facilityTypes: [
    { label: 'مستشفيات', value: 420, tone: 'teal' },
    { label: 'عيادات', value: 260, tone: 'blue' },
    { label: 'معامل', value: 145, tone: 'green' },
    { label: 'مراكز', value: 65, tone: 'amber' },
  ],
  governorateVisits: [
    { label: 'القاهرة', value: 38, tone: 'teal' },
    { label: 'الجيزة', value: 29, tone: 'blue' },
    { label: 'الإسكندرية', value: 24, tone: 'green' },
    { label: 'الدقهلية', value: 18, tone: 'amber' },
    { label: 'الشرقية', value: 16, tone: 'violet' },
    { label: 'أسيوط', value: 13, tone: 'red' },
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
  priorityBreakdown: [
    { label: 'حرجة', value: 7, tone: 'red' },
    { label: 'متوسطة', value: 22, tone: 'amber' },
    { label: 'بسيطة', value: 21, tone: 'blue' },
    { label: 'تم التصحيح', value: 31, tone: 'green' },
  ],
  topInspectors: [
    { detail: 'تفتيش ومتابعة', label: 'أحمد محمود', value: 18 },
    { detail: 'تفتيش منشآت', label: 'سارة خالد', value: 15 },
    { detail: 'مشرف ميداني', label: 'محمد علي', value: 12 },
    { detail: 'تفتيش جودة', label: 'منى حسن', value: 9 },
    { detail: 'متابعة تصحيح', label: 'خالد إبراهيم', value: 7 },
  ],
  visitDaysByGovernorate: [
    { label: 'القاهرة', value: 14, tone: 'blue' },
    { label: 'الجيزة', value: 11, tone: 'teal' },
    { label: 'الإسكندرية', value: 9, tone: 'amber' },
    { label: 'الدقهلية', value: 7, tone: 'green' },
    { label: 'الشرقية', value: 6, tone: 'violet' },
    { label: 'أسيوط', value: 5, tone: 'red' },
  ],
  violationStatus: [
    { label: 'مفتوحة', value: 19, tone: 'red' },
    { label: 'عالية الخطورة', value: 7, tone: 'amber' },
    { label: 'تم التصحيح', value: 31, tone: 'green' },
  ],
}

function getDemoDashboard(role: DemoRole): { metrics: DashboardMetrics; profile: DashboardProfile } {
  const dashboards: Record<DemoRole, { metrics: DashboardMetrics; profile: DashboardProfile }> = {
    superadmin: {
      profile: demoProfile,
      metrics: demoMetrics,
    },
    techadmin: {
      profile: {
        department: 'الإدارة العامة لنظم المعلومات والتحول الرقمي',
        fullName: 'المهندس أحمد الدمرداش',
        isDemo: true,
        jobTitle: 'مدير عام النظم والتحول الرقمي',
        level: 0,
      },
      metrics: {
        ...demoMetrics,
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
        violatingFacilities: 42,
        violationsCorrected: 31,
        violationsOpen: 19,
        violationsTotal: 50,
      },
    },
    central: {
      profile: {
        department: 'الإدارة المركزية للطب العلاجي',
        fullName: 'رئيس إدارة مركزية',
        isDemo: true,
        jobTitle: 'رئيس الإدارة المركزية للطب العلاجي',
        level: 2,
      },
      metrics: {
        ...demoMetrics,
        highPriorityViolations: 4,
        inspectorsTotal: 18,
        missionsCompleted: 82,
        missionsInProgress: 21,
        missionsLate: 3,
        missionsPending: 9,
        missionsTotal: 115,
        violatingFacilities: 24,
        violationsOpen: 12,
        missionStatus: [
          { label: 'مكتملة', value: 82, tone: 'green' },
          { label: 'قيد التنفيذ', value: 21, tone: 'blue' },
          { label: 'بانتظار الاعتماد', value: 9, tone: 'amber' },
          { label: 'متأخرة', value: 3, tone: 'red' },
        ],
        topInspectors: demoMetrics.topInspectors.slice(0, 4),
      },
    },
    generalmanager: {
      profile: {
        department: 'التفتيش والمتابعة',
        fullName: 'مدير عام الإدارة',
        isDemo: true,
        jobTitle: 'مدير عام المستشفيات',
        level: 3,
      },
      metrics: {
        ...demoMetrics,
        highPriorityViolations: 2,
        inspectorsTotal: 7,
        missionsCompleted: 29,
        missionsInProgress: 11,
        missionsLate: 2,
        missionsPending: 6,
        missionsTotal: 48,
        violatingFacilities: 10,
        violationsOpen: 6,
        governorateVisits: [
          { label: 'القاهرة', value: 14, tone: 'teal' },
          { label: 'الجيزة', value: 11, tone: 'blue' },
          { label: 'القليوبية', value: 7, tone: 'amber' },
        ],
        topInspectors: demoMetrics.topInspectors.slice(1, 5),
      },
    },
    creator: {
      profile: {
        department: 'قسم التشغيل والتكليف',
        fullName: 'موظف مختص',
        isDemo: true,
        jobTitle: 'مختص تكليف المأموريات والموظفين',
        level: 4,
      },
      metrics: {
        ...demoMetrics,
        activeFacilities: 120,
        facilitiesTotal: 150,
        highPriorityViolations: 3,
        inspectorsTotal: 4,
        missionsCompleted: 45,
        missionsInProgress: 5,
        missionsLate: 1,
        missionsPending: 10,
        missionsTotal: 61,
        violatingFacilities: 12,
        violationsCorrected: 20,
        violationsOpen: 8,
        violationsTotal: 28,
        missionStatus: [
          { label: 'مكتملة', value: 45, tone: 'green' },
          { label: 'قيد التنفيذ', value: 5, tone: 'blue' },
          { label: 'بانتظار الاعتماد', value: 10, tone: 'amber' },
          { label: 'متأخرة', value: 1, tone: 'red' },
        ],
        topInspectors: [{ detail: 'تكليف وتسكين', label: 'موظف مختص', value: 61 }],
      },
    },
    financial: {
      profile: {
        department: 'الإدارة الشؤون المالية والإدارية',
        fullName: 'مراجع مالي',
        isDemo: true,
        jobTitle: 'مراجع التقارير المالية والبدلات',
        level: 5,
      },
      metrics: {
        ...demoMetrics,
        activeFacilities: 350,
        facilitiesTotal: 380,
        highPriorityViolations: 0,
        inspectorsTotal: 0,
        missionsCompleted: 110,
        missionsInProgress: 8,
        missionsLate: 0,
        missionsPending: 2,
        missionsTotal: 120,
        violatingFacilities: 0,
        violationsCorrected: 0,
        violationsOpen: 0,
        violationsTotal: 0,
        missionStatus: [
          { label: 'مكتملة وصالحة للصرف', value: 110, tone: 'green' },
          { label: 'قيد التنفيذ والمراجعة', value: 8, tone: 'blue' },
          { label: 'مبيت مستحق البدلات', value: 34, tone: 'amber' },
          { label: 'حجز فندقي مؤكد', value: 12, tone: 'teal' },
        ],
        topInspectors: [{ detail: 'مراجعة الميزانية', label: 'مراجع مالي', value: 110 }],
      },
    },
    inspector: {
      profile: {
        department: 'إدارة التفتيش الميداني',
        fullName: 'القائم بالمرور',
        isDemo: true,
        jobTitle: 'مفتش صحي ميداني',
        level: 7,
      },
      metrics: {
        ...demoMetrics,
        activeFacilities: 18,
        facilitiesTotal: 22,
        highPriorityViolations: 1,
        inspectorsTotal: 1,
        missionsCompleted: 6,
        missionsInProgress: 3,
        missionsLate: 1,
        missionsPending: 2,
        missionsTotal: 12,
        violatingFacilities: 4,
        violationsCorrected: 5,
        violationsOpen: 3,
        violationsTotal: 8,
        governorateVisits: [
          { label: 'القاهرة', value: 5, tone: 'teal' },
          { label: 'الجيزة', value: 4, tone: 'blue' },
        ],
        missionStatus: [
          { label: 'مكتملة', value: 6, tone: 'green' },
          { label: 'قيد التنفيذ', value: 3, tone: 'blue' },
          { label: 'بانتظار الاعتماد', value: 2, tone: 'amber' },
          { label: 'متأخرة', value: 1, tone: 'red' },
        ],
        topInspectors: [{ detail: 'مأمورياتك الحالية', label: 'القائم بالمرور', value: 12 }],
      },
    },
  }

  return dashboards[role]
}
