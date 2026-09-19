import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import {
  checkV2ResourceAccess,
  hasV2Permission,
} from '@/server/authorization'
import { requireAnyV2PagePermission } from '@/server/authorization/page-guard'
import {
  loadWorkspaceFacilities,
  loadWorkspaceMissionsForGroup,
  loadWorkspaceOrganizations,
  loadWorkspaceTeamRows,
  type MissionWorkspaceMissionRow,
  type MissionWorkspaceTeamRow,
} from '@/server/services/missions/workspace-data'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import { MissionAssignmentFormsPanel } from '@/features/missions/components/MissionAssignmentFormsPanel'
import type { V2ResourceScopeContext } from '@/server/authorization/scope-types'

type PageProps = {
  params: Promise<{ batchId: string }>
}

type RunRow = {
  id: string
  mission_id: string
  template_id: string
  template_name: string
  template_version: string | null
  status: string
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
  return [
    'completed',
    'closed',
    'done',
    'منفذة',
    'مكتملة',
    'مغلقة',
  ].includes(status || '')
}

export default async function AssignmentFormsPage({
  params,
}: PageProps) {
  const { batchId } = await params
  const { user, access } = await requireAnyV2PagePermission([
    'missions.execute',
    'missions.checklist_change',
  ])
  const admin = getAdminSupabaseClient()

  const { data: batch, error: batchError } = await admin
    .from('mission_assignment_batches')
    .select(
      'id, visit_purpose, scheduled_date, expected_end_date, status'
    )
    .eq('id', batchId)
    .maybeSingle()

  if (batchError || !batch) notFound()

  const missions = await loadWorkspaceMissionsForGroup({ batchId })
  if (missions.length === 0) notFound()

  const [teamRows, facilities] = await Promise.all([
    loadWorkspaceTeamRows(missions.map((mission) => mission.id)),
    loadWorkspaceFacilities(missions.map((mission) => mission.facility_id)),
  ])

  const teamByMission = buildTeamMap(teamRows)
  const organizationIds = new Set<string>()

  for (const facility of facilities.values()) {
    organizationIds.add(facility.organization_id)
    if (facility.sector_id) organizationIds.add(facility.sector_id)
  }

  const organizations = await loadWorkspaceOrganizations([
    ...organizationIds,
  ])

  const missionIds = missions.map((mission) => mission.id)

  const [{ data: runRows, error: runError }, { data: resultRows, error: resultError }] =
    await Promise.all([
      admin
        .from('mission_checklist_runs')
        .select(
          'id, mission_id, template_id, template_name, template_version, status'
        )
        .in('mission_id', missionIds)
        .eq('status', 'active'),
      admin
        .from('mission_results')
        .select('mission_id, checklist_run_id')
        .in('mission_id', missionIds),
    ])

  if (runError || resultError) {
    throw new Error(
      '[assignment-forms] failed to load checklist state: ' +
        (runError?.message || resultError?.message || 'unknown error')
    )
  }

  const runByMission = new Map<string, RunRow>()
  for (const run of (runRows ?? []) as RunRow[]) {
    runByMission.set(run.mission_id, run)
  }

  const answerCountByRun = new Map<string, number>()
  for (const row of resultRows ?? []) {
    if (!row.checklist_run_id) continue
    const key = String(row.checklist_run_id)
    answerCountByRun.set(
      key,
      (answerCountByRun.get(key) ?? 0) + 1
    )
  }

  const canUseExecutePermission = hasV2Permission(
    access,
    'missions.execute'
  )
  const canUseManagePermission = hasV2Permission(
    access,
    'missions.checklist_change'
  )

  async function missionPermissions(
    mission: MissionWorkspaceMissionRow
  ) {
    const facility = facilities.get(mission.facility_id)
    if (!facility) {
      return {
        canExecute: false,
        canManage: false,
        isTeamMember: false,
      }
    }

    const team = teamByMission.get(mission.id) ?? []
    const assignedUserIds = [
      mission.assigned_user_id,
      mission.primary_inspector_id,
      ...team.map((member) => member.user_id),
    ].filter((value): value is string => Boolean(value))

    const isTeamMember = assignedUserIds.includes(user.profileId)

    const resource: V2ResourceScopeContext = {
      ownerUserId: mission.created_by,
      assignedUserIds: [...new Set(assignedUserIds)],
      organizationId: facility.organization_id,
      sectorId: facility.sector_id,
      governorate: facility.governorate,
    }

    let canExecute = false
    if (isTeamMember && canUseExecutePermission) {
      const decision = await checkV2ResourceAccess({
        user,
        snapshot: access,
        permissionKey: 'missions.execute',
        resource,
      })
      canExecute = decision.allowed
    }

    let canManage = false
    if (canUseManagePermission) {
      const decision = await checkV2ResourceAccess({
        user,
        snapshot: access,
        permissionKey: 'missions.checklist_change',
        resource,
      })
      canManage = decision.allowed
    }

    return {
      canExecute,
      canManage,
      isTeamMember,
    }
  }

  const rows = []

  for (const mission of missions) {
    const facility = facilities.get(mission.facility_id)
    if (!facility) continue

    const permissions = await missionPermissions(mission)
    if (!permissions.canExecute && !permissions.canManage) continue

    const run = runByMission.get(mission.id)
    const organization = organizations.get(facility.organization_id)

    rows.push({
      missionId: mission.id,
      serialNumber: mission.serial_number,
      facilityName: facility.name,
      governorate: facility.governorate,
      healthAdmin: facility.health_admin,
      organizationName: organization?.name || 'غير محددة',
      currentTemplateId: run?.template_id || mission.template_id,
      currentTemplateName:
        run?.template_name || 'استمارة غير مسماة',
      currentTemplateVersion: run?.template_version || null,
      answerCount: run?.id
        ? answerCountByRun.get(run.id) ?? 0
        : 0,
      teamTemplateChangeAllowed:
        mission.team_template_change_allowed,
      canManage: permissions.canManage,
      canChange:
        !completedStatus(mission.status) &&
        (permissions.canManage ||
          (permissions.canExecute &&
            mission.team_template_change_allowed)),
      canExecute:
        permissions.canExecute &&
        !completedStatus(mission.status),
      completed: completedStatus(mission.status),
    })
  }

  if (rows.length === 0) {
    redirect('/v2/access-denied')
  }

  rows.sort((a, b) => {
    const adminCompare = (a.healthAdmin || '').localeCompare(
      b.healthAdmin || '',
      'ar'
    )
    if (adminCompare !== 0) return adminCompare
    return a.facilityName.localeCompare(b.facilityName, 'ar')
  })

  const manageCount = rows.filter((row) => row.canManage).length
  const executableCount = rows.filter((row) => row.canExecute).length

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-40 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={
                '/v2/missions/assignments/' +
                batchId +
                '/execute'
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50"
            >
              <ArrowRight className="h-4 w-4" />
              العودة للتكليف
            </Link>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-black text-violet-700">
              {rows.length.toLocaleString('en-US')} استمارة
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {executableCount > 0 && (
              <Link
                href={
                  '/v2/missions/assignments/' +
                  batchId +
                  '/execute'
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal-700 px-3 text-[10px] font-black text-white"
              >
                <ClipboardCheck className="h-4 w-4" />
                تنفيذ التكليف
              </Link>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-slate-900">
              استمارات التكليف
            </h1>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">
              كل منشأة مرتبطة باستمارة تنفيذ محددة. تغيير النموذج لا يحذف
              الإجابات السابقة؛ يحتفظ النظام بها داخل جلسة مؤرشفة مع سبب
              التغيير.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {manageCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[9px] font-black text-teal-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                إدارة {manageCount.toLocaleString('en-US')} استمارة داخل نطاقك
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">
              <FileText className="h-3.5 w-3.5" />
              {batch.visit_purpose || 'تكليف مأمورية ميدانية'}
            </span>
          </div>
        </div>
      </section>

      <MissionAssignmentFormsPanel
        batchId={batchId}
        initialRows={rows}
      />
    </div>
  )
}
