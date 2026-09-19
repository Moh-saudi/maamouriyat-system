import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  FileText,
  ListChecks,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import {
  checkV2ResourceAccess,
} from '@/server/authorization'
import { requireV2PagePermission } from '@/server/authorization/page-guard'
import {
  loadAllWorkspaceMissions,
  loadWorkspaceFacilities,
  loadWorkspaceTeamRows,
} from '@/server/services/missions/workspace-data'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type { V2ResourceScopeContext } from '@/server/authorization/scope-types'

function isOpenMission(status: string | null) {
  return ![
    'completed',
    'closed',
    'done',
    'cancelled',
    'rejected',
    'منفذة',
    'مكتملة',
    'مغلقة',
    'ملغاة',
    'مرفوضة',
  ].includes(status || '')
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

export default async function MissionChecklistManagementIndexPage() {
  const { user, access } = await requireV2PagePermission(
    'missions.checklist_change'
  )
  const admin = getAdminSupabaseClient()

  const allMissions = await loadAllWorkspaceMissions()
  const candidateMissions = allMissions.filter(
    (mission) =>
      Boolean(mission.assignment_batch_id) &&
      isOpenMission(mission.status)
  )

  const facilities = await loadWorkspaceFacilities(
    candidateMissions.map((mission) => mission.facility_id)
  )
  const teamRows = await loadWorkspaceTeamRows(
    candidateMissions.map((mission) => mission.id)
  )

  const teamByMission = new Map<string, string[]>()
  for (const row of teamRows) {
    const current = teamByMission.get(row.mission_id) ?? []
    current.push(row.user_id)
    teamByMission.set(row.mission_id, current)
  }

  const visible = []

  for (const mission of candidateMissions) {
    const facility = facilities.get(mission.facility_id)
    if (!facility || !mission.assignment_batch_id) continue

    const resource: V2ResourceScopeContext = {
      ownerUserId: mission.created_by,
      assignedUserIds: [
        mission.assigned_user_id,
        mission.primary_inspector_id,
        ...(teamByMission.get(mission.id) ?? []),
      ].filter((value): value is string => Boolean(value)),
      organizationId: facility.organization_id,
      sectorId: facility.sector_id,
      governorate: facility.governorate,
    }

    const decision = await checkV2ResourceAccess({
      user,
      snapshot: access,
      permissionKey: 'missions.checklist_change',
      resource,
    })

    if (decision.allowed) {
      visible.push({ mission, facility })
    }
  }

  const batchIds = [
    ...new Set(
      visible
        .map((row) => row.mission.assignment_batch_id)
        .filter((value): value is string => Boolean(value))
    ),
  ]

  const [{ data: batches }, { data: runs }] = await Promise.all([
    batchIds.length
      ? admin
          .from('mission_assignment_batches')
          .select(
            'id, visit_purpose, scheduled_date, expected_end_date, status, created_at'
          )
          .in('id', batchIds)
      : Promise.resolve({ data: [], error: null }),
    visible.length
      ? admin
          .from('mission_checklist_runs')
          .select('mission_id, template_id, template_name, status')
          .in(
            'mission_id',
            visible.map((row) => row.mission.id)
          )
          .eq('status', 'active')
      : Promise.resolve({ data: [], error: null }),
  ])

  const batchById = new Map(
    (batches ?? []).map((batch) => [String(batch.id), batch])
  )
  const runByMission = new Map(
    (runs ?? []).map((run) => [String(run.mission_id), run])
  )

  const groups = new Map<
    string,
    {
      batchId: string
      visitPurpose: string
      scheduledDate: string | null
      expectedEndDate: string | null
      governorates: Set<string>
      facilities: Set<string>
      templates: Set<string>
      missionCount: number
    }
  >()

  for (const row of visible) {
    const batchId = row.mission.assignment_batch_id
    if (!batchId) continue

    const batch = batchById.get(batchId)
    const current =
      groups.get(batchId) ?? {
        batchId,
        visitPurpose:
          String(batch?.visit_purpose || row.mission.visit_purpose || 'تكليف مأمورية ميدانية'),
        scheduledDate:
          (batch?.scheduled_date as string | null | undefined) ??
          row.mission.scheduled_date,
        expectedEndDate:
          (batch?.expected_end_date as string | null | undefined) ??
          row.mission.expected_end_date,
        governorates: new Set<string>(),
        facilities: new Set<string>(),
        templates: new Set<string>(),
        missionCount: 0,
      }

    if (row.facility.governorate) {
      current.governorates.add(row.facility.governorate)
    }
    current.facilities.add(row.facility.id)

    const run = runByMission.get(row.mission.id)
    if (run?.template_name) {
      current.templates.add(String(run.template_name))
    }

    current.missionCount += 1
    groups.set(batchId, current)
  }

  const items = [...groups.values()].sort((a, b) =>
    String(b.scheduledDate || '').localeCompare(
      String(a.scheduledDate || '')
    )
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/v2/checklists"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-teal-700"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            استماراتي ونماذج المرور
          </Link>
          <h1 className="mt-2 text-lg font-black text-slate-900">
            استمارات المأموريات
          </h1>
          <p className="mt-1 max-w-3xl text-[10px] leading-5 text-slate-500">
            إدارة الاستمارات المرتبطة بالتكليفات الواقعة داخل نطاقك التنظيمي.
            هذه الصفحة لا تمنح حق تنفيذ المأمورية أو الإجابة عن أسئلتها.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[9px] font-black text-teal-800">
          <ShieldCheck className="h-3.5 w-3.5" />
          إدارة محكومة بالصلاحيات
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <ListChecks className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-xs font-bold text-slate-500">
            لا توجد تكليفات جارية أو قادمة لإدارة استماراتها داخل نطاقك.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.batchId}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <FileText className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-xs font-black text-slate-900">
                    {item.visitPurpose}
                  </h2>

                  <div className="mt-2 flex flex-wrap gap-1.5 text-[8px] font-bold">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                      <MapPin className="h-3 w-3" />
                      {[...item.governorates].join('، ') || 'محافظة غير محددة'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                      {item.facilities.size.toLocaleString('en-US')} منشأة
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(item.scheduledDate)} —{' '}
                      {formatDate(item.expectedEndDate || item.scheduledDate)}
                    </span>
                  </div>

                  <p className="mt-2 text-[9px] leading-5 text-slate-500">
                    {item.templates.size > 0
                      ? 'الاستمارات الحالية: ' +
                        [...item.templates].join('، ')
                      : 'لم يتم العثور على جلسة استمارة نشطة.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Link
                  href={
                    '/v2/missions/assignments/' +
                    item.batchId +
                    '/forms'
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal-700 px-3 text-[10px] font-black text-white hover:bg-teal-800"
                >
                  <ListChecks className="h-4 w-4" />
                  إدارة استمارات التكليف
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
