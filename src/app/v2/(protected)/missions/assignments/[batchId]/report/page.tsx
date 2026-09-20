import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  MapPin,
  ShieldCheck,
  Users,
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
  type MissionWorkspaceUserRow,
} from '@/server/services/missions/workspace-data'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import { GroupedReportSubmissionPanel } from '@/features/missions/components/GroupedReportSubmissionPanel'

type PageProps = {
  params: Promise<{ batchId: string }>
}

type ReportFacilityRow = {
  mission: MissionWorkspaceMissionRow
  facility: MissionWorkspaceFacilityRow
  organization: string
  sector: string | null
  recommendations: string | null
}

type BatchRow = {
  id: string
  created_by: string | null
  created_by_org: string | null
  scheduled_date: string
  expected_end_date: string
  actual_start_date: string | null
  actual_end_date: string | null
  actual_duration_days: number | null
  actual_overnight_nights: number | null
  completion_disposition: string | null
  timing_adjustment_reason: string | null
  completed_by: string | null
  completed_at: string | null
  report_submitted_to_finance_at: string | null
  report_submitted_to_finance_by: string | null
  visit_purpose: string
  notes: string | null
  status: string
  mission_count: number
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

function extractRecommendations(notes: string | null) {
  if (!notes) return null
  const marker = '📋 توصيات المأمورية المعتمدة:'
  const index = notes.lastIndexOf(marker)
  if (index < 0) return null
  const value = notes.slice(index + marker.length).trim()
  return value || null
}

function dispositionLabel(value: string | null) {
  if (value === 'return_to_base') return 'العودة إلى مقر العمل'
  if (value === 'next_mission') return 'الانتقال إلى مأمورية أخرى'
  if (value === 'other') return 'إجراء آخر'
  return 'غير محدد'
}

export default async function GroupedMissionReportPage({
  params,
}: PageProps) {
  const { batchId } = await params
  const { user, access } = await requireV2PagePermission('missions.view')
  const admin = getAdminSupabaseClient()

  const { data: batchData, error: batchError } = await admin
    .from('mission_assignment_batches')
    .select(
      'id, created_by, created_by_org, scheduled_date, expected_end_date, actual_start_date, actual_end_date, actual_duration_days, actual_overnight_nights, completion_disposition, timing_adjustment_reason, completed_by, completed_at, report_submitted_to_finance_at, report_submitted_to_finance_by, visit_purpose, notes, status, mission_count'
    )
    .eq('id', batchId)
    .maybeSingle()

  if (batchError || !batchData) notFound()
  const batch = batchData as BatchRow

  const missions = await loadWorkspaceMissionsForGroup({ batchId })
  if (missions.length === 0) notFound()

  const allCompleted = missions.every((mission) =>
    completedStatus(mission.status)
  )
  const finalized =
    Boolean(batch.actual_start_date && batch.actual_end_date) &&
    (batch.status === 'completed' || batch.status === 'closed')

  if (!allCompleted || !finalized) {
    redirect('/v2/missions/assignments/' + batchId + '/execute')
  }

  const [teamRows, facilities] = await Promise.all([
    loadWorkspaceTeamRows(missions.map((mission) => mission.id)),
    loadWorkspaceFacilities(missions.map((mission) => mission.facility_id)),
  ])
  const teamByMission = buildTeamMap(teamRows)

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

  function canViewMission(mission: MissionWorkspaceMissionRow) {
    const facility = facilities.get(mission.facility_id)
    if (!facility) return false

    const assignedUserIds = [
      mission.assigned_user_id,
      mission.primary_inspector_id,
      ...(teamByMission.get(mission.id) ?? []).map(
        (member) => member.user_id
      ),
    ].filter((value): value is string => Boolean(value))

    return evaluateV2ResourceScope({
      user,
      snapshot: access,
      permissionKey: 'missions.view',
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

  if (missions.some((mission) => !canViewMission(mission))) {
    redirect('/v2/access-denied')
  }

  const userIds = new Set<string>()
  if (batch.created_by) userIds.add(batch.created_by)
  if (batch.completed_by) userIds.add(batch.completed_by)

  for (const mission of missions) {
    userIds.add(mission.primary_inspector_id)
    for (const member of teamByMission.get(mission.id) ?? []) {
      userIds.add(member.user_id)
    }
  }

  const organizationIds = new Set<string>()
  if (batch.created_by_org) organizationIds.add(batch.created_by_org)
  for (const facility of facilities.values()) {
    organizationIds.add(facility.organization_id)
    if (facility.sector_id) organizationIds.add(facility.sector_id)
  }

  const [users, organizations] = await Promise.all([
    loadWorkspaceUsers([...userIds]),
    loadWorkspaceOrganizations([...organizationIds]),
  ])

  const teamIds = new Set<string>()
  for (const mission of missions) {
    teamIds.add(mission.primary_inspector_id)
    for (const member of teamByMission.get(mission.id) ?? []) {
      teamIds.add(member.user_id)
    }
  }

  const team = [...teamIds]
    .map((id) => users.get(id))
    .filter((member): member is MissionWorkspaceUserRow => Boolean(member))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'))

  const rows = missions
    .map((mission) => {
      const facility = facilities.get(mission.facility_id)
      if (!facility) return null
      return {
        mission,
        facility,
        organization:
          organizations.get(facility.organization_id)?.name ?? 'غير محددة',
        sector: facility.sector_id
          ? organizations.get(facility.sector_id)?.name ?? null
          : null,
        recommendations: extractRecommendations(mission.notes),
      }
    })
    .filter((row): row is ReportFacilityRow => Boolean(row))
    .sort((a, b) => {
      const adminCompare = (a.facility.health_admin ?? '').localeCompare(
        b.facility.health_admin ?? '',
        'ar'
      )
      if (adminCompare !== 0) return adminCompare
      return a.facility.name.localeCompare(b.facility.name, 'ar')
    })

  const scoredRows = rows.filter(
    (row) =>
      row.mission.execution_outcome !== 'not_performed' &&
      row.mission.score_pct !== null
  )
  const averageScore =
    scoredRows.length > 0
      ? Math.round(
          scoredRows.reduce(
            (sum, row) => sum + Number(row.mission.score_pct || 0),
            0
          ) / scoredRows.length
        )
      : null
  const violations = rows.reduce(
    (sum, row) =>
      sum +
      Number(
        row.mission.violations_count ??
          row.mission.violation_count ??
          0
      ),
    0
  )
  const criteria = rows.reduce(
    (sum, row) => sum + Number(row.mission.total_criteria || 0),
    0
  )
  const governorates = [
    ...new Set(
      rows
        .map((row) => row.facility.governorate || '')
        .filter(Boolean)
    ),
  ]
  const completedBy = batch.completed_by
    ? users.get(batch.completed_by)
    : null

  const canSubmitToFinance =
    hasV2Permission(access, 'missions.execute') &&
    (
      missions.some(
        (mission) =>
          mission.primary_inspector_id === user.profileId
      ) ||
      teamRows.some(
        (member) =>
          member.user_id === user.profileId &&
          member.is_primary === true
      )
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={'/v2/missions/assignments/' + batchId + '/execute'}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-teal-700"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            تنفيذ التكليف
          </Link>
          <h1 className="mt-2 text-xl font-black text-slate-900">
            مراجعة التقرير النهائي للتكليف
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            هذا التقرير لا يتاح إلا بعد اكتمال جميع المنشآت وتثبيت المدة
            الفعلية للتكليف.
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

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          <span className="text-xs font-black text-emerald-900">
            التنفيذ مكتمل
          </span>
          {governorates[0] && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[9px] font-bold text-blue-700">
              <MapPin className="h-3 w-3" />
              {governorates[0]}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-bold text-slate-400">
              المدة المقدرة
            </p>
            <p className="mt-1 text-[11px] font-black text-slate-800">
              {formatDate(batch.scheduled_date)} —{' '}
              {formatDate(batch.expected_end_date)}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-bold text-emerald-600">
              المدة الفعلية
            </p>
            <p className="mt-1 text-[11px] font-black text-emerald-800">
              {formatDate(batch.actual_start_date)} —{' '}
              {formatDate(batch.actual_end_date)}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-bold text-slate-400">
              الأيام / المبيت
            </p>
            <p className="mt-1 text-[11px] font-black text-slate-800">
              {(batch.actual_duration_days ?? 0).toLocaleString('en-US')} يوم
              {' · '}
              {(batch.actual_overnight_nights ?? 0).toLocaleString('en-US')}{' '}
              ليلة
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-bold text-slate-400">
              بعد انتهاء التكليف
            </p>
            <p className="mt-1 text-[11px] font-black text-slate-800">
              {dispositionLabel(batch.completion_disposition)}
            </p>
          </div>
        </div>

        {batch.timing_adjustment_reason && (
          <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
            <span className="font-black">سبب تعديل المدة:</span>{' '}
            {batch.timing_adjustment_reason}
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <Building2 className="h-4 w-4 text-teal-700" />
          <p className="mt-2 text-[9px] font-bold text-slate-400">
            المنشآت المنفذة
          </p>
          <p className="mt-1 text-xl font-black text-slate-900">
            {rows.length.toLocaleString('en-US')}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <p className="mt-2 text-[9px] font-bold text-slate-400">
            متوسط التقييم
          </p>
          <p className="mt-1 text-xl font-black text-slate-900">
            {averageScore === null
              ? '—'
              : averageScore.toLocaleString('en-US') + '%'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <FileText className="h-4 w-4 text-amber-700" />
          <p className="mt-2 text-[9px] font-bold text-slate-400">
            البنود المقيمة
          </p>
          <p className="mt-1 text-xl font-black text-slate-900">
            {criteria.toLocaleString('en-US')}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <FileText className="h-4 w-4 text-rose-700" />
          <p className="mt-2 text-[9px] font-bold text-slate-400">
            مخالفات / ملاحظات
          </p>
          <p className="mt-1 text-xl font-black text-slate-900">
            {violations.toLocaleString('en-US')}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-teal-700" />
          <h2 className="text-xs font-black text-slate-800">
            فريق المأمورية
          </h2>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {team.map((member) => (
            <span
              key={member.id}
              className="rounded-full bg-slate-100 px-2.5 py-1.5 text-[9px] font-bold text-slate-600"
            >
              {member.full_name}
              {member.job_title ? ' · ' + member.job_title : ''}
            </span>
          ))}
        </div>
        {completedBy && (
          <p className="mt-3 text-[9px] text-slate-400">
            تم إنهاء التكليف بواسطة{' '}
            <span className="font-bold text-slate-600">
              {completedBy.full_name}
            </span>
            {batch.completed_at
              ? ' · ' + new Date(batch.completed_at).toLocaleString('ar-EG')
              : ''}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <h2 className="text-xs font-black text-slate-800">
            نتائج المنشآت
          </h2>
          <p className="mt-0.5 text-[9px] text-slate-400">
            ملخص النتائج والتوصيات المسجلة أثناء المرور الفعلي.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <article key={row.mission.id} className="p-4">
              <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-[10px] font-black text-slate-500">
                  {(index + 1).toLocaleString('en-US')}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-[12px] font-black text-slate-900">
                      {row.facility.name}
                    </h3>
                    <span className="font-mono text-[8px] font-bold text-teal-700">
                      {row.mission.serial_number}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[8px] font-bold">
                    <span className="rounded-full bg-teal-50 px-2 py-1 text-teal-700">
                      {row.facility.health_admin || 'إدارة غير محددة'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                      {row.organization}
                    </span>
                    {row.sector && (
                      <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">
                        {row.sector}
                      </span>
                    )}
                  </div>

                  <p className={
                    'mt-2 rounded-lg px-2.5 py-2 text-[9px] font-black ' +
                    (row.mission.execution_outcome === 'not_performed'
                      ? 'bg-rose-50 text-rose-800'
                      : 'bg-emerald-50 text-emerald-800')
                  }>
                    {row.mission.execution_outcome === 'not_performed'
                      ? 'لم يتم المرور — السبب: ' + (row.mission.non_execution_reason || 'غير مسجل')
                      : 'تم المرور وتسجيل الاستمارة'}
                    {row.mission.outcome_recorded_at
                      ? ' · ' + new Date(row.mission.outcome_recorded_at).toLocaleString('ar-EG')
                      : ''}
                  </p>

                  {row.recommendations && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[9px] leading-5 text-amber-900">
                      <span className="font-black">التوصيات:</span>{' '}
                      {row.recommendations}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className="rounded-lg bg-slate-50 px-2.5 py-2 text-center">
                    <span className="block text-[8px] font-bold text-slate-400">
                      التقييم
                    </span>
                    <strong className="text-[11px] text-slate-800">
                      {row.mission.execution_outcome === 'not_performed'
                        ? 'لم يتم'
                        : row.mission.score_pct === null
                        ? '—'
                        : Number(row.mission.score_pct).toLocaleString('en-US') +
                          '%'}
                    </strong>
                  </span>
                  <span className="rounded-lg bg-rose-50 px-2.5 py-2 text-center">
                    <span className="block text-[8px] font-bold text-rose-500">
                      الملاحظات
                    </span>
                    <strong className="text-[11px] text-rose-800">
                      {Number(
                        row.mission.violations_count ??
                          row.mission.violation_count ??
                          0
                      ).toLocaleString('en-US')}
                    </strong>
                  </span>
                  <Link
                    href={'/dashboard/missions/' + row.mission.id + '/print'}
                    className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-[9px] font-bold text-slate-600 hover:bg-slate-50"
                  >
                    التفاصيل
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <GroupedReportSubmissionPanel
        batchId={batchId}
        canSubmit={canSubmitToFinance}
        submittedAt={batch.report_submitted_to_finance_at}
      />

      <section className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-[10px] leading-5 text-blue-800">
        التقرير أصبح متاحًا لأن التنفيذ الفعلي للتكليف انتهى. الاستحقاقات
        المالية لا تُنشأ إلا بعد مراجعة التقرير وطباعته وتوقيعه ثم تأكيد
        إرساله للشئون المالية.
      </section>
    </div>
  )
}
