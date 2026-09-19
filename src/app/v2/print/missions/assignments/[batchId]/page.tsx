import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ShieldAlert,
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
  type MissionWorkspaceFacilityRow,
  type MissionWorkspaceMissionRow,
  type MissionWorkspaceOrganizationRow,
  type MissionWorkspaceUserRow,
} from '@/server/services/missions/workspace-data'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import { getFacilityTypeLabel } from '@/config/facility-types'

type PageProps = {
  params: Promise<{ batchId: string }>
  searchParams: Promise<{ governorate?: string }>
}

type BatchRow = {
  id: string
  created_by: string | null
  created_by_org: string | null
  template_id: string | null
  source_target_id: string | null
  source_program_id: string | null
  selection_source: string | null
  scheduled_date: string
  expected_end_date: string | null
  priority: string | null
  visit_purpose: string | null
  notes: string | null
  requires_overnight: boolean | null
  requires_hotel_booking: boolean | null
  mission_count: number | null
  status: string | null
  approved_by: string | null
  approved_at: string | null
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

function statusLabel(value: string | null) {
  if (value === 'approved') return 'معتمد'
  if (value === 'pending_approval') return 'بانتظار الاعتماد'
  if (value === 'completed') return 'منفذ'
  if (value === 'closed') return 'منتهٍ'
  return value || 'غير محدد'
}

function priorityLabel(value: string | null) {
  if (value === 'urgent') return 'عاجلة'
  if (value === 'high') return 'مرتفعة'
  return 'عادية'
}

export default async function GroupedMissionAssignmentPrintPage({
  params,
  searchParams,
}: PageProps) {
  const { batchId } = await params
  const query = await searchParams
  const requestedGovernorate = query.governorate?.trim() || null
  const { user, access } = await requireV2PagePermission('missions.view')
  const admin = getAdminSupabaseClient()

  const { data: batchData, error: batchError } = await admin
    .from('mission_assignment_batches')
    .select(
      'id, created_by, created_by_org, template_id, source_target_id, source_program_id, selection_source, scheduled_date, expected_end_date, priority, visit_purpose, notes, requires_overnight, requires_hotel_booking, mission_count, status, approved_by, approved_at, created_at'
    )
    .eq('id', batchId)
    .maybeSingle()

  if (batchError || !batchData) notFound()
  const batch = batchData as BatchRow

  const allMissions = await loadWorkspaceMissionsForGroup({ batchId })
  if (allMissions.length === 0) notFound()

  const [teamRows, facilities] = await Promise.all([
    loadWorkspaceTeamRows(allMissions.map((mission) => mission.id)),
    loadWorkspaceFacilities(allMissions.map((mission) => mission.facility_id)),
  ])

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

  const teamByMission = new Map<string, string[]>()
  for (const member of teamRows) {
    const current = teamByMission.get(member.mission_id) ?? []
    current.push(member.user_id)
    teamByMission.set(member.mission_id, current)
  }

  const visibleMissions = allMissions.filter((mission) => {
    const facility = facilities.get(mission.facility_id)
    if (!facility) return false

    const assignedUserIds = [
      mission.assigned_user_id,
      mission.primary_inspector_id,
      ...(teamByMission.get(mission.id) ?? []),
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
  })

  if (visibleMissions.length === 0) {
    redirect('/v2/access-denied')
  }

  const availableGovernorates = [
    ...new Set(
      visibleMissions
        .map(
          (mission) =>
            facilities.get(mission.facility_id)?.governorate?.trim() || ''
        )
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, 'ar'))

  if (
    requestedGovernorate &&
    !availableGovernorates.includes(requestedGovernorate)
  ) {
    notFound()
  }

  if (!requestedGovernorate && availableGovernorates.length > 1) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-100 p-5 sm:p-10">
        <div className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-lg font-black text-slate-900">
            هذا سجل قديم متعدد المحافظات
          </h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            القاعدة الحالية تمنع إصدار مستند رسمي واحد لمحافظات مختلفة.
            اختر المحافظة المطلوب طباعة تكليفها بشكل مستقل.
          </p>

          <div className="mt-5 grid gap-2">
            {availableGovernorates.map((governorate) => (
              <Link
                key={governorate}
                href={
                  '/v2/print/missions/assignments/' +
                  batchId +
                  '?governorate=' +
                  encodeURIComponent(governorate)
                }
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:border-teal-200 hover:bg-teal-50"
              >
                <span>{governorate}</span>
                <ArrowRight className="h-4 w-4 rotate-180" />
              </Link>
            ))}
          </div>

          <Link
            href="/v2/missions"
            className="mt-5 inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600"
          >
            العودة إلى المأموريات
          </Link>
        </div>
      </main>
    )
  }

  const missions = requestedGovernorate
    ? visibleMissions.filter(
        (mission) =>
          facilities.get(mission.facility_id)?.governorate ===
          requestedGovernorate
      )
    : visibleMissions

  if (missions.length === 0) notFound()

  const userIds = new Set<string>()
  if (batch.created_by) userIds.add(batch.created_by)
  if (batch.approved_by) userIds.add(batch.approved_by)

  for (const mission of missions) {
    userIds.add(mission.primary_inspector_id)
    if (mission.assigned_user_id) userIds.add(mission.assigned_user_id)
    for (const member of teamRows) {
      if (member.mission_id === mission.id) userIds.add(member.user_id)
    }
  }

  const organizationIds = new Set<string>()
  if (batch.created_by_org) organizationIds.add(batch.created_by_org)

  for (const mission of missions) {
    const facility = facilities.get(mission.facility_id)
    if (!facility) continue
    organizationIds.add(facility.organization_id)
    if (facility.sector_id) organizationIds.add(facility.sector_id)
  }

  const [users, organizations] = await Promise.all([
    loadWorkspaceUsers([...userIds]),
    loadWorkspaceOrganizations([...organizationIds]),
  ])

  const creator = batch.created_by ? users.get(batch.created_by) : null
  const approvingUser = batch.approved_by ? users.get(batch.approved_by) : null
  const issuingOrganization = batch.created_by_org
    ? organizations.get(batch.created_by_org)
    : null

  const distinctTeamIds = new Set<string>()
  const primaryIds = new Set<string>()

  for (const mission of missions) {
    primaryIds.add(mission.primary_inspector_id)
    for (const member of teamRows) {
      if (member.mission_id === mission.id) {
        distinctTeamIds.add(member.user_id)
        if (member.is_primary) primaryIds.add(member.user_id)
      }
    }
  }

  if (distinctTeamIds.size === 0) {
    for (const mission of missions) {
      distinctTeamIds.add(mission.primary_inspector_id)
    }
  }

  const team = [...distinctTeamIds]
    .map((id) => users.get(id))
    .filter((member): member is MissionWorkspaceUserRow => Boolean(member))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'))

  let sourceLabel = 'اختيار حر'
  if (batch.source_target_id) {
    const { data } = await admin
      .from('mission_targets')
      .select('title')
      .eq('id', batch.source_target_id)
      .maybeSingle()
    sourceLabel = data?.title ? 'مستهدف: ' + String(data.title) : 'مستهدف محدد'
  } else if (batch.source_program_id) {
    const { data } = await admin
      .from('facility_programs')
      .select('name')
      .eq('id', batch.source_program_id)
      .maybeSingle()
    sourceLabel = data?.name
      ? 'مشروع / مبادرة: ' + String(data.name)
      : 'مشروع / مبادرة'
  }

  const governorate =
    requestedGovernorate ||
    facilities.get(missions[0].facility_id)?.governorate ||
    'غير محددة'

  const facilityRows = missions
    .map((mission) => {
      const facility = facilities.get(mission.facility_id)
      if (!facility) return null

      return {
        mission,
        facility,
        organization: organizations.get(facility.organization_id) ?? null,
        sector: facility.sector_id
          ? organizations.get(facility.sector_id) ?? null
          : null,
      }
    })
    .filter(
      (
        row
      ): row is {
        mission: MissionWorkspaceMissionRow
        facility: MissionWorkspaceFacilityRow
        organization: MissionWorkspaceOrganizationRow | null
        sector: MissionWorkspaceOrganizationRow | null
      } => Boolean(row)
    )
    .sort((a, b) => {
      const adminCompare = (a.facility.health_admin ?? '').localeCompare(
        b.facility.health_admin ?? '',
        'ar'
      )
      if (adminCompare !== 0) return adminCompare
      return a.facility.name.localeCompare(b.facility.name, 'ar')
    })

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
          href="/v2/missions"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
        >
          <ArrowRight className="h-4 w-4" />
          العودة
        </Link>
        <MissionDocumentPrintButton />
      </div>

      <article className="print-sheet mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b-2 border-teal-800 px-7 py-6">
          <div className="grid grid-cols-[90px_1fr_160px] items-center gap-4">
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
                نموذج تكليف بمأمورية ميدانية مجمعة
              </h1>
              <p className="mt-1 text-[11px] text-slate-500">
                محافظة {governorate}
              </p>
            </div>

            <div className="text-left text-[10px] leading-5 text-slate-500">
              <p>
                <span className="font-bold text-slate-700">مرجع الدفعة:</span>{' '}
                {batch.id.slice(0, 8).toUpperCase()}
              </p>
              <p>
                <span className="font-bold text-slate-700">الحالة:</span>{' '}
                {statusLabel(batch.status)}
              </p>
              <p>
                <span className="font-bold text-slate-700">تاريخ الإصدار:</span>{' '}
                {formatDate(batch.created_at)}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-3 border-b border-slate-200 px-7 py-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[9px] font-bold text-slate-400">جهة الإصدار</p>
            <p className="mt-1 text-[11px] font-black text-slate-800">
              {issuingOrganization?.name || 'غير محددة'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[9px] font-bold text-slate-400">مصدر التكليف</p>
            <p className="mt-1 text-[11px] font-black text-slate-800">
              {sourceLabel}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[9px] font-bold text-slate-400">الفترة المقدرة</p>
            <p className="mt-1 text-[11px] font-black text-slate-800">
              {formatDate(batch.scheduled_date)} —{' '}
              {formatDate(batch.expected_end_date || batch.scheduled_date)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[9px] font-bold text-slate-400">الأولوية</p>
            <p className="mt-1 text-[11px] font-black text-slate-800">
              {priorityLabel(batch.priority)}
            </p>
          </div>
        </section>

        <section className="avoid-break border-b border-slate-200 px-7 py-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <div className="mb-2 flex items-center gap-2 text-teal-800">
                <Users className="h-4 w-4" />
                <h2 className="text-xs font-black">فريق المأمورية</h2>
              </div>
              <div className="space-y-1.5">
                {team.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-[10px]"
                  >
                    <span className="font-bold text-slate-800">
                      {member.full_name}
                    </span>
                    <span className="text-slate-500">
                      {primaryIds.has(member.id)
                        ? 'رئيس الفريق'
                        : member.job_title || 'عضو فريق'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-teal-800">
                <CalendarDays className="h-4 w-4" />
                <h2 className="text-xs font-black">بيانات التكليف</h2>
              </div>
              <dl className="grid gap-2 text-[10px]">
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <dt className="font-bold text-slate-400">القائم بالإصدار</dt>
                  <dd className="font-bold text-slate-700">
                    {creator?.full_name || 'غير محدد'}
                  </dd>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <dt className="font-bold text-slate-400">المعتمد</dt>
                  <dd className="font-bold text-slate-700">
                    {approvingUser?.full_name || 'غير محدد'}
                  </dd>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <dt className="font-bold text-slate-400">غرض المأمورية</dt>
                  <dd className="font-bold leading-5 text-slate-700">
                    {batch.visit_purpose || 'غير محدد'}
                  </dd>
                </div>
                {batch.notes && (
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="font-bold text-slate-400">ملاحظات</dt>
                    <dd className="font-bold leading-5 text-slate-700">
                      {batch.notes}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </section>

        <section className="px-7 py-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-teal-800">
              <Building2 className="h-4 w-4" />
              <h2 className="text-xs font-black">المنشآت المكلف بالمرور عليها</h2>
            </div>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[9px] font-black text-teal-800">
              {facilityRows.length.toLocaleString('en-US')} منشأة
            </span>
          </div>

          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr className="bg-teal-900 text-white">
                <th className="border border-teal-800 px-2 py-2">#</th>
                <th className="border border-teal-800 px-2 py-2 text-right">المنشأة</th>
                <th className="border border-teal-800 px-2 py-2">رقم المأمورية</th>
                <th className="border border-teal-800 px-2 py-2">الإدارة الصحية</th>
                <th className="border border-teal-800 px-2 py-2">التبعية</th>
                <th className="border border-teal-800 px-2 py-2">القطاع</th>
                <th className="border border-teal-800 px-2 py-2">النوع</th>
              </tr>
            </thead>
            <tbody>
              {facilityRows.map((row, index) => (
                <tr key={row.mission.id} className="avoid-break">
                  <td className="border border-slate-200 px-2 py-2 text-center">
                    {(index + 1).toLocaleString('en-US')}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 font-bold text-slate-800">
                    {row.facility.name}
                    {row.facility.village_city && (
                      <span className="mt-0.5 block text-[8px] font-normal text-slate-400">
                        {row.facility.village_city}
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center font-mono text-[8px]">
                    {row.mission.serial_number}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center">
                    {row.facility.health_admin || '—'}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center">
                    {row.organization?.name || '—'}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center">
                    {row.sector?.name || '—'}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center">
                    {getFacilityTypeLabel(row.facility.facility_type)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="avoid-break border-t border-slate-200 px-7 py-7">
          <div className="grid grid-cols-3 gap-8 text-center text-[10px]">
            <div>
              <p className="font-black text-slate-700">القائم بإصدار التكليف</p>
              <p className="mt-8 border-t border-slate-400 pt-2 text-slate-400">
                الاسم والتوقيع
              </p>
            </div>
            <div>
              <p className="font-black text-slate-700">رئيس فريق المأمورية</p>
              <p className="mt-8 border-t border-slate-400 pt-2 text-slate-400">
                الاسم والتوقيع
              </p>
            </div>
            <div>
              <p className="font-black text-slate-700">الاعتماد الإداري</p>
              <p className="mt-8 border-t border-slate-400 pt-2 text-slate-400">
                الاسم والتوقيع والختم
              </p>
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-7 py-3 text-[8px] text-slate-400">
          <span>نظام المأموريات الميدانية — وزارة الصحة والسكان</span>
          <span>
            هذا المستند خاص بمحافظة {governorate} ولا يضم محافظات أخرى.
          </span>
        </footer>
      </article>
    </main>
  )
}
