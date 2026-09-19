import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  FileText,
} from 'lucide-react'
import { MissionExecutionForm } from '@/app/dashboard/missions/[id]/execute/mission-execution-form'
import { defaultCorrectionUnits, type CorrectionUnitOption } from '@/lib/correction-units'
import {
  checkV2ResourceAccess,
} from '@/server/authorization'
import { loadMissionResourceScope } from '@/server/authorization/resources/mission'
import { requireV2PagePermission } from '@/server/authorization/page-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type PageProps = {
  params: Promise<{ missionId: string }>
  searchParams: Promise<{ returnTo?: string }>
}

type FacilityRow = {
  id: string
  name: string
  facility_type: string | null
  governorate: string | null
  health_admin: string | null
  latitude: number | null
  longitude: number | null
}

type OrganizationRow = {
  id: string
  name: string
  level: number | null
  level_label: string | null
  governorate: string | null
  health_admin: string | null
  parent_id: string | null
}

function safeReturnHref(
  value: string | undefined,
  batchId: string | null
) {
  if (
    value &&
    value.startsWith('/v2/missions/assignments/') &&
    value.endsWith('/execute')
  ) {
    return value
  }

  if (batchId) {
    return '/v2/missions/assignments/' + batchId + '/execute'
  }

  return '/v2/missions'
}

async function loadAllActiveFacilities() {
  const admin = getAdminSupabaseClient()
  const rows: FacilityRow[] = []

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('facilities')
      .select(
        'id, name, facility_type, governorate, health_admin, latitude, longitude'
      )
      .eq('is_active', true)
      .order('name')
      .range(from, from + 999)

    if (error) {
      throw new Error(
        '[mission-execute-v2] failed to load facilities: ' +
          error.message
      )
    }

    const page = (data ?? []) as FacilityRow[]
    rows.push(...page)
    if (page.length < 1000) break
  }

  return rows
}

async function loadAllOrganizations() {
  const admin = getAdminSupabaseClient()
  const rows: OrganizationRow[] = []

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('organizations')
      .select(
        'id, name, level, level_label, governorate, health_admin, parent_id'
      )
      .eq('is_active', true)
      .order('name')
      .range(from, from + 999)

    if (error) {
      throw new Error(
        '[mission-execute-v2] failed to load organizations: ' +
          error.message
      )
    }

    const page = (data ?? []) as OrganizationRow[]
    rows.push(...page)
    if (page.length < 1000) break
  }

  return rows
}

export default async function V2MissionExecutePage({
  params,
  searchParams,
}: PageProps) {
  const { missionId } = await params
  const query = await searchParams
  const { user, access } = await requireV2PagePermission(
    'missions.execute'
  )
  const admin = getAdminSupabaseClient()

  const { data: missionData, error: missionError } = await admin
    .from('missions')
    .select(
      `id,
       assignment_batch_id,
       serial_number,
       status,
       scheduled_date,
       expected_end_date,
       expected_nights,
       checkin_time,
       actual_start_date,
       actual_end_date,
       actual_duration_days,
       actual_overnight_nights,
       completion_disposition,
       timing_adjustment_reason,
       destination_type,
       visit_purpose,
       notes,
       execution_notes,
       target_facility_id,
       target_governorate_id,
       actual_facility_id,
       actual_governorate_id,
       destination_changed,
       change_reason,
       assigned_user_id,
       primary_inspector_id,
       sector_id,
       facility_id`
    )
    .eq('id', missionId)
    .maybeSingle()

  if (missionError || !missionData) {
    redirect('/v2/missions')
  }

  const mission = missionData as any
  const returnHref = safeReturnHref(
    query.returnTo,
    mission.assignment_batch_id
  )

  if (
    ['completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'].includes(
      mission.status || ''
    )
  ) {
    redirect(returnHref)
  }

  const [{ data: teamMember }, { data: profile }] = await Promise.all([
    admin
      .from('mission_team')
      .select('user_id')
      .eq('mission_id', missionId)
      .eq('user_id', user.profileId)
      .maybeSingle(),
    admin
      .from('users')
      .select(
        'id, full_name, level, org_level, department, org_unit_id, job_title, sector_id'
      )
      .eq('id', user.profileId)
      .maybeSingle(),
  ])

  const isTeamMember =
    mission.assigned_user_id === user.profileId ||
    mission.primary_inspector_id === user.profileId ||
    Boolean(teamMember)

  if (!isTeamMember) {
    redirect('/v2/access-denied')
  }

  const resource = await loadMissionResourceScope(missionId)
  if (!resource) {
    redirect('/v2/missions')
  }

  const executionDecision = await checkV2ResourceAccess({
    user,
    snapshot: access,
    permissionKey: 'missions.execute',
    resource,
  })

  if (!executionDecision.allowed) {
    redirect('/v2/access-denied')
  }

  if (!profile) {
    redirect('/v2/access-denied')
  }

  const [
    facilities,
    organizations,
    { data: users },
    { data: facility },
    { data: activeRun },
  ] = await Promise.all([
    loadAllActiveFacilities(),
    loadAllOrganizations(),
    admin
      .from('users')
      .select('id, full_name, level, department, job_title, email')
      .eq('is_active', true)
      .order('full_name'),
    admin
      .from('facilities')
      .select(
        'id, name, facility_type, governorate, health_admin, latitude, longitude'
      )
      .eq('id', mission.facility_id)
      .maybeSingle(),
    admin
      .from('mission_checklist_runs')
      .select('id')
      .eq('mission_id', missionId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  let savedResults: any[] = []
  if (activeRun?.id) {
    const { data } = await admin
      .from('mission_results')
      .select('checklist_item_id, form_criterion_id, answer, notes, photo_url')
      .eq('mission_id', missionId)
      .eq('checklist_run_id', activeRun.id)
    savedResults = (data ?? []).map((row) => ({
      ...row,
      checklist_item_id:
        row.form_criterion_id ?? row.checklist_item_id,
    }))
  } else {
    const { data } = await admin
      .from('mission_results')
      .select('checklist_item_id, form_criterion_id, answer, notes, photo_url')
      .eq('mission_id', missionId)
      .is('checklist_run_id', null)
    savedResults = (data ?? []).map((row) => ({
      ...row,
      checklist_item_id:
        row.form_criterion_id ?? row.checklist_item_id,
    }))
  }

  const normalizedMission = {
    ...mission,
    facilities: facility
      ? {
          name: facility.name,
        }
      : null,
    governorates: null,
  }

  const correctionUnits: CorrectionUnitOption[] =
    organizations.length > 0
      ? organizations.map((organization) => ({
          name: organization.name,
        }))
      : defaultCorrectionUnits.map((name) => ({ name }))

  const governorates = [
    ...new Set(
      facilities
        .map((row) => row.governorate)
        .filter((value): value is string => Boolean(value))
    ),
  ]
    .sort((a, b) => a.localeCompare(b, 'ar'))
    .map((name) => ({ id: name, name }))

  return (
    <div className="space-y-3">
      <div className="sticky top-2 z-40 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={returnHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50"
            >
              <ArrowRight className="h-4 w-4" />
              العودة للتكليف
            </Link>

            <div className="min-w-0">
              <p className="font-mono text-[8px] font-black text-teal-700">
                {mission.serial_number}
              </p>
              <h1 className="truncate text-sm font-black text-slate-900">
                {facility?.name || 'تنفيذ المأمورية'}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="#approved-checklist-section"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 text-[10px] font-bold text-teal-800"
            >
              <FileText className="h-3.5 w-3.5" />
              الاستمارة
            </a>
            <a
              href="#mission-execution-actions"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal-700 px-3 text-[10px] font-black text-white hover:bg-teal-800"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              إنهاء مرور المنشأة
            </a>
          </div>
        </div>
      </div>

      <MissionExecutionForm
        currentUserId={user.profileId}
        currentUserDept={profile.department ?? undefined}
        currentUserOrgUnitId={profile.org_unit_id ?? undefined}
        correctionUnits={correctionUnits}
        facilities={facilities}
        governorates={governorates}
        mission={normalizedMission}
        returnHref={returnHref}
        users={users ?? []}
        currentUserLevel={profile.level ?? profile.org_level ?? 7}
        savedResults={savedResults}
        orgUnits={organizations}
      />
    </div>
  )
}
