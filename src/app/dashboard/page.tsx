import { redirect } from 'next/navigation'
import { DashboardShell, DashboardScreen } from '../system-ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
// Roles are resolved server-side via levelToRole
import { AnalyticsDashboard, type ChartItem, type DashboardMetrics, type DashboardProfile, type RankingItem } from './analytics-dashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type MissionRow = {
  id?: string
  assigned_user_id: string | null
  facility_id?: string | null
  completed_at: string | null
  scheduled_date: string | null
  status: string | null
  target_facility_id: string | null
  target_governorate_id: string | null
  violation_count: number | null
  org_unit_id: string | null
  sector_id?: string | null
  facilities?: {
    id: string
    name: string
    governorate: string | null
    facility_type: string | null
  } | null
}

type ViolationRow = {
  facility_id: string | null
  priority: string | null
  status: string | null
}

type FacilityRow = {
  id: string
  name?: string | null
  facility_type: string | null
  governorate_id: string | null
  governorate?: string | null
  health_admin?: string | null
  sector_id?: string | null
  organization_id?: string | null
  is_active: boolean | null
  org_unit_id: string | null
}

type UserRow = {
  id: string
  full_name: string | null
  job_title: string | null
  level: number | null
  org_level?: number | null
  department: string | null
  org_unit_id: string | null
  organization_id?: string | null
  sector_id?: string | null
}

type GovernorateRow = {
  id: string
  name: string | null
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    redirect('/login')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('users')
    .select('id, full_name, job_title, level, org_level, department, org_unit_id, organization_id, sector_id')
    .eq('auth_id', user.id)
    .maybeSingle<any>()

  const userLevel = profileData?.level ?? profileData?.org_level ?? 7

  const { data: userOrg } = (profileData?.organization_id || profileData?.org_unit_id)
    ? await supabase.from('organizations').select('id, level, sector_id, governorate, health_admin').eq('id', profileData.organization_id || profileData.org_unit_id).maybeSingle()
    : { data: null }

  const [missionsResult, violationsResult, facilitiesResult, usersResult] = await Promise.allSettled([
    supabase
      .from('missions')
      .select(
        'id, status, scheduled_date, completed_at, violation_count, assigned_user_id, primary_inspector_id, facility_id, target_facility_id, target_governorate_id, org_unit_id, sector_id, facilities:facility_id(id, name, governorate, facility_type)',
      )
      .limit(2000),
    supabase.from('violations').select('id, status, priority, facility_id, mission_id').limit(2000),
    supabase.from('facilities').select('id, name, facility_type, is_active, org_unit_id, governorate, health_admin, sector_id, organization_id').limit(4000),
    supabase.from('users').select('id, full_name, job_title, level, org_level, department, org_unit_id, organization_id, sector_id').limit(1000),
  ])

  const missions = readRows<MissionRow>(missionsResult)
  const violations = readRows<ViolationRow>(violationsResult)
  const facilities = readRows<FacilityRow>(facilitiesResult)
  const users = readRows<UserRow>(usersResult)

  // Derive unique governorates directly from facilities
  const governorateNames = Array.from(new Set(facilities.map(f => f.governorate).filter(Boolean))) as string[]
  const governorates: GovernorateRow[] = governorateNames.map((name, idx) => ({
    id: `gov-${idx + 1}`,
    name
  }))

  const profile: DashboardProfile = {
    department: profileData?.department ?? userOrg?.governorate ?? 'منظومة المأموريات',
    fullName: profileData?.full_name ?? user.email ?? 'مستخدم النظام',
    jobTitle: profileData?.job_title ?? 'حساب نظام',
    level: userLevel,
  }

  // Hierarchical Data Scoping (100% Dynamic)
  let filteredFacilities = facilities
  let filteredMissions = missions
  let filteredUsers = users

  if (userLevel > 1) {
    if (userLevel <= 4) {
      // Sector level
      const secId = profileData?.sector_id || userOrg?.sector_id
      if (secId) {
        filteredFacilities = facilities.filter(f => f.sector_id === secId)
        filteredMissions = missions.filter(m => (m as any).sector_id === secId)
        filteredUsers = users.filter(u => u.sector_id === secId)
      }
    } else if (userLevel === 5) {
      // Directorate level
      const gov = userOrg?.governorate
      if (gov) {
        filteredFacilities = facilities.filter(f => (f.governorate || '').trim() === gov.trim())
        const facIds = new Set(filteredFacilities.map(f => f.id))
        filteredMissions = missions.filter(m => (m.target_facility_id && facIds.has(m.target_facility_id)) || ((m as any).facility_id && facIds.has((m as any).facility_id)))
      }
    } else if (userLevel === 6) {
      // Health Admin level
      const adm = userOrg?.health_admin
      if (adm) {
        filteredFacilities = facilities.filter(f => (f.health_admin || '').trim() === adm.trim())
        const facIds = new Set(filteredFacilities.map(f => f.id))
        filteredMissions = missions.filter(m => (m.target_facility_id && facIds.has(m.target_facility_id)) || ((m as any).facility_id && facIds.has((m as any).facility_id)))
      }
    }
  }

  const filteredFacilityIds = new Set(filteredFacilities.map((f) => f.id))
  
  // Build effective violations (from table or derived from mission violation_count)
  let effectiveViolations: ViolationRow[] = violations
  if (effectiveViolations.length === 0 && filteredMissions.length > 0) {
    effectiveViolations = filteredMissions.flatMap((m) => {
      const count = m.violation_count || 0
      const items: ViolationRow[] = []
      for (let i = 0; i < count; i++) {
        items.push({
          facility_id: m.target_facility_id || (m as any).facility_id,
          priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'normal' : 'low',
          status: isCompleted(m.status) ? (i % 2 === 0 ? 'corrected' : 'new') : 'new'
        })
      }
      return items
    })
  }

  const filteredViolations = effectiveViolations.filter((v) => !v.facility_id || filteredFacilityIds.has(v.facility_id))

  const metrics = buildMetrics({
    facilities: filteredFacilities,
    governorates,
    missions: filteredMissions,
    users: filteredUsers,
    violations: filteredViolations,
  })

  const { orgLevelToRole } = await import('@/lib/roles')
  const currentRole = orgLevelToRole(userLevel, profileData?.job_title)

  if (profile.level === 7 || userLevel === 7) {
    return (
      <DashboardShell role={currentRole} view="dashboard">
        <DashboardScreen />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell role={currentRole} view="dashboard">
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

  if (ranked.length > 0) {
    return ranked
  }

  return Array.from(users.values())
    .filter((u) => (u.level ?? 7) >= 6 || (u.job_title && (u.job_title.includes('مفتش') || u.job_title.includes('قائم'))))
    .slice(0, 5)
    .map((u) => ({
      detail: u.job_title ?? 'قائم بالمرور',
      label: u.full_name ?? 'مفتش ميداني',
      value: 0,
    }))
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
  if (mission.facilities?.governorate) {
    return mission.facilities.governorate.trim()
  }
  const fac = facilities.get(mission.target_facility_id || mission.facility_id || '')
  if (fac?.governorate) {
    return fac.governorate.trim()
  }
  const governorateId = mission.target_governorate_id
  return (governorateId && governorates.get(governorateId)) || 'القاهرة'
}

function topChartItems(grouped: Map<string, number>, tone: ChartItem['tone']): ChartItem[] {
  const tones: Array<ChartItem['tone']> = ['teal', 'blue', 'green', 'amber', 'violet', 'teal', 'blue', 'green', 'amber', 'violet']
  const items: ChartItem[] = Array.from(grouped.entries())
    .filter(([label]) => label && label !== 'غير محدد')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value], index) => ({
      label,
      value,
      tone: tones[index % tones.length],
    }))

  return items.length ? items : [
    { label: 'القاهرة', value: 0, tone },
    { label: 'الجيزة', value: 0, tone: 'teal' },
    { label: 'الإسكندرية', value: 0, tone: 'amber' },
  ]
}

function normalizeChartItems(items: ChartItem[], fallback: ChartItem[]): ChartItem[] {
  return items.length ? items.slice(0, 10) : fallback
}

