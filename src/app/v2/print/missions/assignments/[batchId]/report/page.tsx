import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Users,
} from 'lucide-react'
import { MissionDocumentPrintButton } from '@/features/missions/components/MissionDocumentPrintButton'
import {
  evaluateV2ResourceScope,
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

type PageProps = {
  params: Promise<{ batchId: string }>
}

type PrintedReportRow = {
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

function completedStatus(status: string | null) {
  const normalized = normalizeMissionWorkspaceStatus(status)
  return normalized === 'completed' || normalized === 'closed'
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

export default async function GroupedMissionReportPrintPage({
  params,
}: PageProps) {
  const { batchId } = await params
  const { user, access } = await requireV2PagePermission('missions.view')
  const admin = getAdminSupabaseClient()

  const { data: batchData, error: batchError } = await admin
    .from('mission_assignment_batches')
    .select(
      'id, created_by, created_by_org, scheduled_date, expected_end_date, actual_start_date, actual_end_date, actual_duration_days, actual_overnight_nights, completion_disposition, timing_adjustment_reason, completed_by, completed_at, report_submitted_to_finance_at, visit_purpose, notes, status, mission_count'
    )
    .eq('id', batchId)
    .maybeSingle()

  if (batchError || !batchData) notFound()
  const batch = batchData as BatchRow

  const missions = await loadWorkspaceMissionsForGroup({ batchId })
  if (
    missions.length === 0 ||
    !missions.every((mission) => completedStatus(mission.status)) ||
    !batch.actual_start_date ||
    !batch.actual_end_date ||
    !['completed', 'closed'].includes(batch.status)
  ) {
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
    .filter((row): row is PrintedReportRow => Boolean(row))
    .sort((a, b) => {
      const adminCompare = (a.facility.health_admin ?? '').localeCompare(
        b.facility.health_admin ?? '',
        'ar'
      )
      if (adminCompare !== 0) return adminCompare
      return a.facility.name.localeCompare(b.facility.name, 'ar')
    })

  const governorates = [
    ...new Set(rows.map((row) => row.facility.governorate || '').filter(Boolean)),
  ]
  const governorate = governorates[0] || 'غير محددة'
  const creator = batch.created_by ? users.get(batch.created_by) : null
  const completedBy = batch.completed_by ? users.get(batch.completed_by) : null
  const issuingOrganization = batch.created_by_org
    ? organizations.get(batch.created_by_org)
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
  const scored = rows.filter(
    (row) =>
      row.mission.execution_outcome !== 'not_performed' &&
      row.mission.score_pct !== null
  )
  const averageScore =
    scored.length > 0
      ? Math.round(
          scored.reduce(
            (sum, row) => sum + Number(row.mission.score_pct || 0),
            0
          ) / scored.length
        )
      : null

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          .print-sheet { box-shadow: none !important; border: 0 !important; max-width: none !important; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>

      <div className="mx-auto mb-4 flex max-w-5xl items-center justify-between gap-3 px-4 print:hidden">
        <Link
          href={'/v2/missions/assignments/' + batchId + '/report'}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للتقرير
        </Link>
        <MissionDocumentPrintButton />
      </div>

      <article className="print-sheet mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b-2 border-teal-800 px-7 py-6">
          <div className="grid grid-cols-[90px_1fr_170px] items-center gap-4">
            <div className="flex justify-center">
              <Image
                src="/mohp-logo.png"
                width={72}
                height={72}
                alt="شعار وزارة الصحة والسكان"
                priority
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-slate-900">
                وزارة الصحة والسكان
              </p>
              <h1 className="mt-1 text-xl font-black text-teal-900">
                تقرير مأمورية ميدانية مجمعة
              </h1>
              <p className="mt-1 text-[11px] text-slate-500">
                محافظة {governorate}
              </p>
            </div>
            <div className="text-left text-[9px] leading-5 text-slate-500">
              <p>
                <span className="font-bold text-slate-700">مرجع التكليف:</span>{' '}
                {batch.id.slice(0, 8).toUpperCase()}
              </p>
              <p>
                <span className="font-bold text-slate-700">المنشآت:</span>{' '}
                {rows.length.toLocaleString('en-US')}
              </p>
              <p>
                <span className="font-bold text-slate-700">تاريخ الإنهاء:</span>{' '}
                {formatDate(batch.completed_at)}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-3 border-b border-slate-200 px-7 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['جهة الإصدار', issuingOrganization?.name || 'غير محددة'],
            ['غرض المأمورية', batch.visit_purpose || 'غير محدد'],
            [
              'المدة المقدرة',
              formatDate(batch.scheduled_date) +
                ' — ' +
                formatDate(batch.expected_end_date),
            ],
            [
              'المدة الفعلية',
              formatDate(batch.actual_start_date) +
                ' — ' +
                formatDate(batch.actual_end_date),
            ],
            [
              'الأيام الفعلية',
              (batch.actual_duration_days ?? 0).toLocaleString('en-US') + ' يوم',
            ],
            [
              'ليالي المبيت',
              (batch.actual_overnight_nights ?? 0).toLocaleString('en-US') + ' ليلة',
            ],
            ['بعد انتهاء التكليف', dispositionLabel(batch.completion_disposition)],
            [
              'متوسط التقييم',
              averageScore === null
                ? 'غير محسوب'
                : averageScore.toLocaleString('en-US') + '%',
            ],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[8px] font-bold text-slate-400">{label}</p>
              <p className="mt-1 text-[10px] font-black text-slate-800">
                {value}
              </p>
            </div>
          ))}
        </section>

        {batch.timing_adjustment_reason && (
          <section className="border-b border-slate-200 px-7 py-3">
            <p className="text-[9px] leading-5 text-amber-800">
              <span className="font-black">سبب تعديل المدة:</span>{' '}
              {batch.timing_adjustment_reason}
            </p>
          </section>
        )}

        <section className="avoid-break border-b border-slate-200 px-7 py-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="mb-2 flex items-center gap-2 text-teal-800">
                <Users className="h-4 w-4" />
                <h2 className="text-xs font-black">فريق المأمورية</h2>
              </div>
              <div className="space-y-1.5">
                {team.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-[9px]"
                  >
                    <span className="font-bold text-slate-800">
                      {member.full_name}
                    </span>
                    <span className="text-slate-500">
                      {member.job_title || 'عضو فريق'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-teal-800">
                <CheckCircle2 className="h-4 w-4" />
                <h2 className="text-xs font-black">ملخص التنفيذ</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-[8px] font-bold text-emerald-700">
                    المنشآت المنفذة
                  </p>
                  <p className="mt-1 text-lg font-black text-emerald-900">
                    {rows.length.toLocaleString('en-US')}
                  </p>
                </div>
                <div className="rounded-xl bg-rose-50 p-3">
                  <p className="text-[8px] font-bold text-rose-700">
                    المخالفات / الملاحظات
                  </p>
                  <p className="mt-1 text-lg font-black text-rose-900">
                    {violations.toLocaleString('en-US')}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[9px] leading-5 text-slate-500">
                تم إنهاء التكليف بواسطة{' '}
                <span className="font-bold text-slate-700">
                  {completedBy?.full_name || creator?.full_name || 'غير محدد'}
                </span>
                .
              </p>
            </div>
          </div>
        </section>

        <section className="px-7 py-5">
          <div className="mb-3 flex items-center gap-2 text-teal-800">
            <Building2 className="h-4 w-4" />
            <h2 className="text-xs font-black">
              نتائج المرور على المنشآت
            </h2>
          </div>

          <table className="w-full border-collapse text-[8px]">
            <thead>
              <tr className="bg-teal-900 text-white">
                <th className="border border-teal-800 px-2 py-2">#</th>
                <th className="border border-teal-800 px-2 py-2 text-right">
                  المنشأة
                </th>
                <th className="border border-teal-800 px-2 py-2">
                  الإدارة الصحية
                </th>
                <th className="border border-teal-800 px-2 py-2">
                  التبعية
                </th>
                <th className="border border-teal-800 px-2 py-2">
                  التقييم
                </th>
                <th className="border border-teal-800 px-2 py-2">
                  ملاحظات
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.mission.id} className="avoid-break align-top">
                  <td className="border border-slate-200 px-2 py-2 text-center">
                    {(index + 1).toLocaleString('en-US')}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 font-bold text-slate-800">
                    {row.facility.name}
                    <span className="mt-0.5 block font-mono text-[7px] font-normal text-slate-400">
                      {row.mission.serial_number}
                    </span>
                    <span className={
                      'mt-1 block text-[7px] font-black ' +
                      (row.mission.execution_outcome === 'not_performed'
                        ? 'text-rose-700'
                        : 'text-emerald-700')
                    }>
                      {row.mission.execution_outcome === 'not_performed'
                        ? 'لم يتم المرور: ' + (row.mission.non_execution_reason || 'السبب غير مسجل')
                        : 'تم المرور'}
                    </span>
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center">
                    {row.facility.health_admin || '—'}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center">
                    {row.organization}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center font-black">
                    {row.mission.execution_outcome === 'not_performed'
                      ? 'لم يتم'
                      : row.mission.score_pct === null
                      ? '—'
                      : Number(row.mission.score_pct).toLocaleString('en-US') + '%'}
                  </td>
                  <td className="border border-slate-200 px-2 py-2">
                    {row.mission.execution_outcome === 'not_performed'
                      ? row.mission.non_execution_reason || 'سبب عدم التنفيذ غير مسجل'
                      : row.recommendations || 'لا توجد توصيات مسجلة'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="avoid-break border-t border-slate-200 px-7 py-8">
          <div className="grid grid-cols-3 gap-8 text-center text-[10px]">
            <div>
              <p className="font-black text-slate-700">القائم بالمأمورية</p>
              <p className="mt-10 border-t border-slate-400 pt-2 text-slate-400">
                الاسم والتوقيع
              </p>
            </div>
            <div>
              <p className="font-black text-slate-700">رئيس فريق المأمورية</p>
              <p className="mt-10 border-t border-slate-400 pt-2 text-slate-400">
                الاسم والتوقيع
              </p>
            </div>
            <div>
              <p className="font-black text-slate-700">المراجعة / الاعتماد</p>
              <p className="mt-10 border-t border-slate-400 pt-2 text-slate-400">
                الاسم والتوقيع والختم
              </p>
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-7 py-3 text-[8px] text-slate-400">
          <span>نظام المأموريات الميدانية — وزارة الصحة والسكان</span>
          <span>
            {batch.report_submitted_to_finance_at
              ? 'تم إرسال التقرير للمالية بعد التوقيع.'
              : 'نسخة التقرير للمراجعة والتوقيع قبل الإرسال للمالية.'}
          </span>
        </footer>
      </article>
    </main>
  )
}
