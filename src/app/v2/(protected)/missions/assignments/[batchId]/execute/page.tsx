import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Clock3,
  FileText,
  ListChecks,
  MapPin,
  ShieldAlert,
} from 'lucide-react'
import {
  evaluateV2ResourceScope,
  hasV2Permission,
} from '@/server/authorization'
import { loadV2OrganizationFacts } from '@/server/authorization/organization-scope-repository'
import { requireV2PagePermission } from '@/server/authorization/page-guard'
import {
  loadWorkspaceFacilities,
  loadWorkspaceMissionsForGroup,
  loadWorkspaceOrganizations,
  loadWorkspaceTeamRows,
  loadWorkspaceUsers,
  normalizeMissionWorkspaceStatus,
  type MissionWorkspaceFacilityRow,
  type MissionWorkspaceMissionRow,
  type MissionWorkspaceTeamRow,
} from '@/server/services/missions/workspace-data'
import {
  resolveMissionOperationalState,
  type MissionOperationalStateMeta,
} from '@/config/mission-lifecycle'
import { getFacilityTypeLabel } from '@/config/facility-types'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import { GroupedAssignmentCompletionPanel } from '@/features/missions/components/GroupedAssignmentCompletionPanel'

type PageProps = {
  params: Promise<{ batchId: string }>
}

type GroupedExecutionRow = {
  mission: MissionWorkspaceMissionRow
  facility: MissionWorkspaceFacilityRow
  organization: string
  sector: string | null
  primary: string
  lifecycle: MissionOperationalStateMeta
  assignedToMe: boolean
  canExecute: boolean
  completed: boolean
  outcome: 'performed' | 'not_performed' | null
}

type BatchRow = {
  id: string
  created_by: string | null
  created_by_org: string | null
  scheduled_date: string
  expected_end_date: string | null
  priority: string | null
  visit_purpose: string | null
  notes: string | null
  mission_count: number | null
  status: string | null
  actual_start_date: string | null
  actual_end_date: string | null
  actual_duration_days: number | null
  actual_overnight_nights: number | null
  completion_disposition:
    | 'return_to_base'
    | 'next_mission'
    | 'other'
    | null
  timing_adjustment_reason: string | null
  completed_by: string | null
  completed_at: string | null
  report_submitted_to_finance_at: string | null
  created_at: string | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value + (value.length === 10 ? 'T00:00:00' : ''))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function dateKeyFromTimestamp(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.length >= 10 ? value.slice(0, 10) : null
  }
  return date.toISOString().slice(0, 10)
}

function buildTeamMap(rows: MissionWorkspaceTeamRow[]) {
  const result = new Map<string, MissionWorkspaceTeamRow[]>()

  for (const row of rows) {
    const current = result.get(row.mission_id) ?? []
    current.push(row)
    result.set(row.mission_id, current)
  }

  return result
}

function completedStatus(status: string | null) {
  const normalized = normalizeMissionWorkspaceStatus(status)
  return normalized === 'completed' || normalized === 'closed'
}

export default async function GroupedMissionExecutionPage({
  params,
}: PageProps) {
  const { batchId } = await params
  const { user, access } = await requireV2PagePermission('missions.execute')
  const admin = getAdminSupabaseClient()

  const { data: batchData, error: batchError } = await admin
    .from('mission_assignment_batches')
    .select(
      'id, created_by, created_by_org, scheduled_date, expected_end_date, priority, visit_purpose, notes, mission_count, status, actual_start_date, actual_end_date, actual_duration_days, actual_overnight_nights, completion_disposition, timing_adjustment_reason, completed_by, completed_at, report_submitted_to_finance_at, created_at'
    )
    .eq('id', batchId)
    .maybeSingle()

  if (batchError || !batchData) notFound()
  const batch = batchData as BatchRow

  const missions = await loadWorkspaceMissionsForGroup({ batchId })
  if (missions.length === 0) notFound()

  const teamRows = await loadWorkspaceTeamRows(
    missions.map((mission) => mission.id)
  )
  const teamByMission = buildTeamMap(teamRows)

  const belongsToBatchTeam = missions.some(
    (mission) =>
      mission.assigned_user_id === user.profileId ||
      mission.primary_inspector_id === user.profileId ||
      (teamByMission.get(mission.id) ?? []).some(
        (member) => member.user_id === user.profileId
      )
  )

  if (!belongsToBatchTeam) {
    redirect('/v2/access-denied')
  }
  const facilities = await loadWorkspaceFacilities(
    missions.map((mission) => mission.facility_id)
  )

  const factIds = new Set<string>()
  if (user.organizationId) factIds.add(user.organizationId)

  for (const role of access.roles) {
    if (role.assignmentOrganizationId) {
      factIds.add(role.assignmentOrganizationId)
    }
  }

  for (const facility of facilities.values()) {
    factIds.add(facility.organization_id)
  }

  const organizationFacts =
    factIds.size > 0
      ? await loadV2OrganizationFacts([...factIds])
      : new Map()

  const canExecutePermission = hasV2Permission(access, 'missions.execute')

  function resourceAllowed(
    mission: MissionWorkspaceMissionRow,
    permissionKey: string
  ) {
    const facility = facilities.get(mission.facility_id)
    if (!facility) return false

    const team = teamByMission.get(mission.id) ?? []
    const assignedUserIds = [
      mission.assigned_user_id,
      mission.primary_inspector_id,
      ...team.map((member) => member.user_id),
    ].filter((value): value is string => Boolean(value))

    return evaluateV2ResourceScope({
      user,
      snapshot: access,
      permissionKey,
      organizationFacts,
      resource: {
        ownerUserId: mission.created_by,
        assignedUserIds: [...new Set(assignedUserIds)],
        organizationId: facility.organization_id,
        sectorId: facility.sector_id,
        governorate: facility.governorate,
      },
    }).allowed
  }

  const visibleMissions = missions.filter((mission) => {
    const team = teamByMission.get(mission.id) ?? []
    const assignedToMe =
      mission.assigned_user_id === user.profileId ||
      mission.primary_inspector_id === user.profileId ||
      team.some((member) => member.user_id === user.profileId)

    return assignedToMe && resourceAllowed(mission, 'missions.execute')
  })

  if (visibleMissions.length === 0) {
    redirect('/v2/access-denied')
  }

  const userIds = new Set<string>()
  for (const mission of visibleMissions) {
    userIds.add(mission.primary_inspector_id)
    if (mission.assigned_user_id) userIds.add(mission.assigned_user_id)
    for (const member of teamByMission.get(mission.id) ?? []) {
      userIds.add(member.user_id)
    }
  }

  const organizationIds = new Set<string>()
  for (const mission of visibleMissions) {
    const facility = facilities.get(mission.facility_id)
    if (!facility) continue
    organizationIds.add(facility.organization_id)
    if (facility.sector_id) organizationIds.add(facility.sector_id)
  }

  const [users, organizations] = await Promise.all([
    loadWorkspaceUsers([...userIds]),
    loadWorkspaceOrganizations([...organizationIds]),
  ])

  const rows = visibleMissions
    .map((mission) => {
      const facility = facilities.get(mission.facility_id)
      if (!facility) return null

      const team = teamByMission.get(mission.id) ?? []
      const assignedToMe =
        mission.assigned_user_id === user.profileId ||
        mission.primary_inspector_id === user.profileId ||
        team.some((member) => member.user_id === user.profileId)

      const canExecute =
        assignedToMe &&
        canExecutePermission &&
        resourceAllowed(mission, 'missions.execute') &&
        !completedStatus(mission.status)

      const lifecycle = resolveMissionOperationalState({
        status: mission.status,
        scheduledDate: mission.scheduled_date,
        expectedEndDate: mission.expected_end_date,
        actualStartDate: mission.actual_start_date,
        actualEndDate: mission.actual_end_date,
      })

      return {
        mission,
        facility,
        organization:
          organizations.get(facility.organization_id)?.name ?? 'غير محددة',
        sector: facility.sector_id
          ? organizations.get(facility.sector_id)?.name ?? null
          : null,
        primary:
          users.get(mission.primary_inspector_id)?.full_name ?? 'غير محدد',
        lifecycle,
        assignedToMe,
        canExecute,
        completed: completedStatus(mission.status),
        outcome: mission.execution_outcome,
      }
    })
    .filter(
      (row): row is GroupedExecutionRow => Boolean(row)
    )
    .sort((a, b) => {
      const adminCompare = (a.facility.health_admin ?? '').localeCompare(
        b.facility.health_admin ?? '',
        'ar'
      )
      if (adminCompare !== 0) return adminCompare
      return a.facility.name.localeCompare(b.facility.name, 'ar')
    })

  const completedCount = rows.filter((row) => row.completed).length
  const currentCount = rows.filter(
    (row) => row.lifecycle.key === 'current'
  ).length
  const upcomingCount = rows.filter(
    (row) =>
      row.lifecycle.key === 'upcoming' ||
      row.lifecycle.key === 'overdue'
  ).length
  const remainingCount = Math.max(0, rows.length - completedCount)
  const progress = rows.length
    ? Math.round((completedCount / rows.length) * 100)
    : 0
  const allCompleted = rows.length > 0 && completedCount === rows.length
  const executableCount = rows.filter((row) => row.canExecute).length
  const governorates = [
    ...new Set(
      rows
        .map((row) => row.facility.governorate?.trim() || '')
        .filter(Boolean)
    ),
  ]

  const canFinalize =
    canExecutePermission &&
    (
      visibleMissions.some(
        (mission) =>
          mission.primary_inspector_id === user.profileId
      ) ||
      teamRows.some(
        (member) =>
          member.user_id === user.profileId &&
          member.is_primary === true
      )
    )

  const startCandidates = visibleMissions
    .map(
      (mission) =>
        mission.actual_start_date ||
        dateKeyFromTimestamp(mission.checkin_time)
    )
    .filter((value): value is string => Boolean(value))
    .sort()

  const endCandidates = visibleMissions
    .map(
      (mission) =>
        mission.actual_end_date ||
        dateKeyFromTimestamp(
          mission.checkout_time || mission.completed_at
        )
    )
    .filter((value): value is string => Boolean(value))
    .sort()

  const suggestedStartDate =
    batch.actual_start_date ||
    startCandidates[0] ||
    batch.scheduled_date
  const suggestedEndDate =
    batch.actual_end_date ||
    endCandidates[endCandidates.length - 1] ||
    batch.expected_end_date ||
    batch.scheduled_date

  const finalized =
    Boolean(batch.actual_start_date && batch.actual_end_date) &&
    (batch.status === 'completed' || batch.status === 'closed')

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-40 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/v2/missions"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50"
            >
              <ArrowRight className="h-4 w-4" />
              العودة للمأموريات
            </Link>

            <Link
              href={
                '/v2/missions/assignments/' +
                batchId +
                '/forms'
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-[10px] font-black text-violet-800 hover:bg-violet-100"
            >
              <ListChecks className="h-4 w-4" />
              استمارات التكليف
            </Link>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">
              تم تسجيل النتيجة {completedCount.toLocaleString('en-US')} /{' '}
              {rows.length.toLocaleString('en-US')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={'/v2/print/missions/assignments/' + batchId}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600"
            >
              <FileText className="h-3.5 w-3.5" />
              نموذج التكليف
            </Link>

            {allCompleted && canFinalize ? (
              <a
                href="#assignment-completion"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-[10px] font-black text-white hover:bg-emerald-800"
              >
                <CheckCircle2 className="h-4 w-4" />
                إنهاء التكليف
              </a>
            ) : (
              <span
                className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-[10px] font-black text-slate-400"
                title={
                  canFinalize
                    ? 'أكمل جميع المنشآت أولًا'
                    : 'إنهاء التكليف متاح لرئيس الفريق'
                }
              >
                <CheckCircle2 className="h-4 w-4" />
                {canFinalize
                  ? 'إنهاء التكليف · متبقي ' +
                    remainingCount.toLocaleString('en-US')
                  : 'إنهاء التكليف · رئيس الفريق'}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/v2/missions"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-teal-700"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            المأموريات الميدانية
          </Link>
          <h1 className="mt-2 text-xl font-black text-slate-900">
            تنفيذ التكليف الميداني
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            المرور على المنشآت وتسجيل نتيجة كل مأمورية حتى اكتمال التكليف.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={'/v2/print/missions/assignments/' + batchId}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600"
          >
            <FileText className="h-3.5 w-3.5" />
            نموذج التكليف
          </Link>
        </div>
      </div>

      {governorates.length > 1 && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] leading-5 text-rose-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          هذا سجل قديم يضم أكثر من محافظة. القاعدة الحالية تمنع إنشاء تكليفات
          جديدة بهذه الصورة، ويجب معالجة هذا السجل إداريًا قبل اعتباره نموذجًا
          لتكليف جديد.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[9px] font-black text-teal-800">
                {rows.length.toLocaleString('en-US')} منشأة
              </span>
              {governorates[0] && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black text-blue-700">
                  <MapPin className="h-3 w-3" />
                  {governorates[0]}
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">
                {formatDate(batch.scheduled_date)} —{' '}
                {formatDate(batch.expected_end_date || batch.scheduled_date)}
              </span>
            </div>

            <h2 className="mt-3 text-sm font-black text-slate-900">
              {batch.visit_purpose || 'تكليف مأمورية ميدانية'}
            </h2>
            {batch.notes && (
              <p className="mt-1 max-w-3xl text-[10px] leading-5 text-slate-500">
                {batch.notes}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
              <span>
                النتائج المسجلة {completedCount.toLocaleString('en-US')} /{' '}
                {rows.length.toLocaleString('en-US')}
              </span>
              <span>{progress.toLocaleString('en-US')}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-600"
                style={{ width: progress + '%' }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-center">
                <p className="text-[8px] font-bold text-emerald-700">نتيجة مسجلة</p>
                <p className="mt-1 text-base font-black text-emerald-900">
                  {completedCount.toLocaleString('en-US')}
                </p>
              </div>
              <div className="rounded-xl bg-teal-50 p-2.5 text-center">
                <p className="text-[8px] font-bold text-teal-700">جارية</p>
                <p className="mt-1 text-base font-black text-teal-900">
                  {currentCount.toLocaleString('en-US')}
                </p>
              </div>
              <div className="rounded-xl bg-sky-50 p-2.5 text-center">
                <p className="text-[8px] font-bold text-sky-700">قادمة</p>
                <p className="mt-1 text-base font-black text-sky-900">
                  {upcomingCount.toLocaleString('en-US')}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-2.5 text-center">
                <p className="text-[8px] font-bold text-slate-600">متبقية</p>
                <p className="mt-1 text-base font-black text-slate-900">
                  {remainingCount.toLocaleString('en-US')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <div>
            <h2 className="text-xs font-black text-slate-800">
              منشآت التكليف
            </h2>
            <p className="mt-0.5 text-[9px] text-slate-400">
              افتح المنشأة وسجل نتائج المرور، ثم عد إلى هذه الشاشة لمتابعة
              التقدم.
            </p>
          </div>
          <span className="text-[9px] font-bold text-slate-500">
            متاح لك تنفيذ {executableCount.toLocaleString('en-US')} مأمورية
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <div
              key={row.mission.id}
              className={
                'grid gap-3 border-r-4 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] ' +
                row.lifecycle.cardAccentClassName
              }
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-[10px] font-black text-slate-500">
                {(index + 1).toLocaleString('en-US')}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black ring-1 ' +
                      row.lifecycle.badgeClassName
                    }
                  >
                    <span
                      className={
                        'h-2 w-2 rounded-full ' + row.lifecycle.dotClassName
                      }
                    />
                    {row.lifecycle.label}
                  </span>
                  <span className="font-mono text-[8px] font-black text-teal-700">
                    {row.mission.serial_number}
                  </span>
                  {row.assignedToMe && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[8px] font-bold text-violet-700">
                      ضمن فريقي
                    </span>
                  )}
                </div>

                <h3 className="mt-1.5 text-[12px] font-black text-slate-900">
                  {row.facility.name}
                </h3>

                {row.completed && (
                  <p className={
                    'mt-1.5 text-[9px] font-black ' +
                    (row.outcome === 'not_performed' ? 'text-rose-700' : 'text-emerald-700')
                  }>
                    {row.outcome === 'not_performed'
                      ? 'لم يتم المرور: ' + (row.mission.non_execution_reason || 'لم يسجل السبب')
                      : 'تم المرور وتسجيل الاستمارة'}
                  </p>
                )}

                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[8px] font-bold">
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                    المحافظة: {row.facility.governorate || '—'}
                  </span>
                  <span className="rounded-full bg-teal-50 px-2 py-1 text-teal-700">
                    الإدارة: {row.facility.health_admin || '—'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                    التبعية: {row.organization}
                  </span>
                  {row.sector && (
                    <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">
                      القطاع: {row.sector}
                    </span>
                  )}
                  <span className="rounded-full bg-slate-50 px-2 py-1 text-slate-500">
                    {getFacilityTypeLabel(row.facility.facility_type)}
                  </span>
                </div>

                <p className="mt-1.5 text-[8px] text-slate-400">
                  رئيس الفريق: {row.primary}
                  {row.mission.actual_duration_days
                    ? ' · المدة الفعلية ' +
                      row.mission.actual_duration_days.toLocaleString('en-US') +
                      ' يوم'
                    : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                {row.completed ? (
                  <Link
                    href={'/dashboard/missions/' + row.mission.id + '/print'}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[9px] font-bold text-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    عرض النتيجة
                  </Link>
                ) : row.canExecute ? (
                  <Link
                    href={
                      '/v2/missions/' +
                      row.mission.id +
                      '/execute?returnTo=' +
                      encodeURIComponent(
                        '/v2/missions/assignments/' + batchId + '/execute'
                      )
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal-700 px-3 text-[9px] font-black text-white hover:bg-teal-800"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    {row.lifecycle.key === 'current'
                      ? 'استكمال التنفيذ'
                      : 'بدء التنفيذ'}
                    <ChevronLeft className="h-3 w-3" />
                  </Link>
                ) : (
                  <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2.5 text-[8px] font-bold text-slate-400">
                    <Clock3 className="h-3.5 w-3.5" />
                    غير متاح للتنفيذ
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div id="assignment-completion" className="scroll-mt-24">
        <GroupedAssignmentCompletionPanel
        batchId={batchId}
        allCompleted={allCompleted}
        canFinalize={canFinalize}
        plannedStartDate={batch.scheduled_date}
        plannedEndDate={
          batch.expected_end_date || batch.scheduled_date
        }
        suggestedStartDate={suggestedStartDate}
        suggestedEndDate={suggestedEndDate}
        actualStartDate={batch.actual_start_date}
        actualEndDate={batch.actual_end_date}
        actualOvernightNights={batch.actual_overnight_nights}
        completionDisposition={batch.completion_disposition}
        timingAdjustmentReason={batch.timing_adjustment_reason}
        finalized={finalized}
        actualDurationDays={batch.actual_duration_days}
        reportSubmittedAt={batch.report_submitted_to_finance_at}
        />
      </div>
    </div>
  )
}
