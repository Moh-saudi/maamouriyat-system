import { getAdminSupabaseClient } from '@/server/supabase/admin'

export const MISSION_WORKSPACE_DB_PAGE_SIZE = 1000

export type MissionWorkspaceMissionRow = {
  id: string
  assignment_batch_id: string | null
  serial_number: string
  facility_id: string
  primary_inspector_id: string
  assigned_user_id: string | null
  created_by: string | null
  status: string | null
  priority: string | null
  scheduled_date: string
  expected_end_date: string | null
  visit_purpose: string | null
  requires_overnight: boolean | null
  requires_hotel_booking: boolean | null
  checkin_time: string | null
  checkout_time: string | null
  gps_verified: boolean | null
  completed_at: string | null
  actual_start_date: string | null
  actual_end_date: string | null
  actual_duration_days: number | null
  actual_overnight_nights: number | null
  completion_disposition: string | null
  timing_adjustment_reason: string | null
  created_at: string | null
  source_target_id: string | null
  source_program_id: string | null
}

export type MissionWorkspaceFacilityRow = {
  id: string
  name: string
  facility_type: string
  organization_id: string
  sector_id: string | null
  governorate: string | null
  health_admin: string | null
  village_city: string | null
}

export type MissionWorkspaceUserRow = {
  id: string
  full_name: string
  job_title: string | null
}

export type MissionWorkspaceTeamRow = {
  mission_id: string
  user_id: string
  is_primary: boolean | null
}

export type MissionWorkspaceTargetRow = {
  id: string
  title: string
  scope_level: string
  scope_name: string
  assigned_user_id: string | null
  target_type: string
}

export type MissionWorkspaceProgramRow = {
  id: string
  name: string
  program_type: string
}

const MISSION_SELECT =
  'id, assignment_batch_id, serial_number, facility_id, primary_inspector_id, assigned_user_id, created_by, status, priority, scheduled_date, expected_end_date, visit_purpose, requires_overnight, requires_hotel_booking, checkin_time, checkout_time, gps_verified, completed_at, actual_start_date, actual_end_date, actual_duration_days, actual_overnight_nights, completion_disposition, timing_adjustment_reason, created_at, source_target_id, source_program_id'

export async function loadAllWorkspaceMissions(): Promise<
  MissionWorkspaceMissionRow[]
> {
  const admin = getAdminSupabaseClient()
  const rows: MissionWorkspaceMissionRow[] = []

  for (
    let from = 0;
    ;
    from += MISSION_WORKSPACE_DB_PAGE_SIZE
  ) {
    const { data, error } = await admin
      .from('missions')
      .select(MISSION_SELECT)
      .order('scheduled_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(
        from,
        from + MISSION_WORKSPACE_DB_PAGE_SIZE - 1
      )

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load missions page: ${error.message}`
      )
    }

    const page = (data ?? []) as MissionWorkspaceMissionRow[]
    rows.push(...page)

    if (page.length < MISSION_WORKSPACE_DB_PAGE_SIZE) break
  }

  return rows
}

export async function loadWorkspaceMissionsForGroup(input: {
  batchId?: string | null
  missionId?: string | null
}): Promise<MissionWorkspaceMissionRow[]> {
  const admin = getAdminSupabaseClient()

  if (input.batchId) {
    const { data, error } = await admin
      .from('missions')
      .select(MISSION_SELECT)
      .eq('assignment_batch_id', input.batchId)
      .order('scheduled_date')
      .order('serial_number')

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load batch missions: ${error.message}`
      )
    }

    return (data ?? []) as MissionWorkspaceMissionRow[]
  }

  if (input.missionId) {
    const { data, error } = await admin
      .from('missions')
      .select(MISSION_SELECT)
      .eq('id', input.missionId)
      .limit(1)

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load legacy mission: ${error.message}`
      )
    }

    return (data ?? []) as MissionWorkspaceMissionRow[]
  }

  return []
}

export async function loadWorkspaceTeamRows(
  missionIds?: readonly string[]
): Promise<MissionWorkspaceTeamRow[]> {
  const admin = getAdminSupabaseClient()

  if (missionIds) {
    const ids = [...new Set(missionIds)]
    const rows: MissionWorkspaceTeamRow[] = []

    for (let index = 0; index < ids.length; index += 500) {
      const chunk = ids.slice(index, index + 500)
      if (chunk.length === 0) continue

      const { data, error } = await admin
        .from('mission_team')
        .select('mission_id, user_id, is_primary')
        .in('mission_id', chunk)
        .order('mission_id')
        .order('user_id')

      if (error) {
        throw new Error(
          `[missions-workspace] failed to load mission team: ${error.message}`
        )
      }

      rows.push(...((data ?? []) as MissionWorkspaceTeamRow[]))
    }

    return rows
  }

  const rows: MissionWorkspaceTeamRow[] = []

  for (
    let from = 0;
    ;
    from += MISSION_WORKSPACE_DB_PAGE_SIZE
  ) {
    const { data, error } = await admin
      .from('mission_team')
      .select('mission_id, user_id, is_primary')
      .order('mission_id')
      .order('user_id')
      .range(
        from,
        from + MISSION_WORKSPACE_DB_PAGE_SIZE - 1
      )

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load mission team page: ${error.message}`
      )
    }

    const page = (data ?? []) as MissionWorkspaceTeamRow[]
    rows.push(...page)

    if (page.length < MISSION_WORKSPACE_DB_PAGE_SIZE) break
  }

  return rows
}

export async function loadWorkspaceFacilities(
  ids: readonly string[]
): Promise<Map<string, MissionWorkspaceFacilityRow>> {
  const admin = getAdminSupabaseClient()
  const result = new Map<string, MissionWorkspaceFacilityRow>()
  const unique = [...new Set(ids.filter(Boolean))]

  for (let index = 0; index < unique.length; index += 500) {
    const chunk = unique.slice(index, index + 500)
    if (chunk.length === 0) continue

    const { data, error } = await admin
      .from('facilities')
      .select(
        'id, name, facility_type, organization_id, sector_id, governorate, health_admin, village_city'
      )
      .in('id', chunk)

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load facilities: ${error.message}`
      )
    }

    for (const row of (data ?? []) as MissionWorkspaceFacilityRow[]) {
      result.set(row.id, row)
    }
  }

  return result
}

export async function loadWorkspaceUsers(
  ids: readonly string[]
): Promise<Map<string, MissionWorkspaceUserRow>> {
  const admin = getAdminSupabaseClient()
  const result = new Map<string, MissionWorkspaceUserRow>()
  const unique = [...new Set(ids.filter(Boolean))]

  for (let index = 0; index < unique.length; index += 500) {
    const chunk = unique.slice(index, index + 500)
    if (chunk.length === 0) continue

    const { data, error } = await admin
      .from('users')
      .select('id, full_name, job_title')
      .in('id', chunk)

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load users: ${error.message}`
      )
    }

    for (const row of (data ?? []) as MissionWorkspaceUserRow[]) {
      result.set(row.id, row)
    }
  }

  return result
}

export async function loadWorkspaceTargets(
  ids: readonly string[]
): Promise<Map<string, MissionWorkspaceTargetRow>> {
  const admin = getAdminSupabaseClient()
  const unique = [...new Set(ids.filter(Boolean))]
  const result = new Map<string, MissionWorkspaceTargetRow>()

  for (let index = 0; index < unique.length; index += 500) {
    const chunk = unique.slice(index, index + 500)
    if (chunk.length === 0) continue

    const { data, error } = await admin
      .from('mission_targets')
      .select(
        'id, title, scope_level, scope_name, assigned_user_id, target_type'
      )
      .in('id', chunk)

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load targets: ${error.message}`
      )
    }

    for (const row of (data ?? []) as MissionWorkspaceTargetRow[]) {
      result.set(row.id, row)
    }
  }

  return result
}

export async function loadWorkspacePrograms(
  ids: readonly string[]
): Promise<Map<string, MissionWorkspaceProgramRow>> {
  const admin = getAdminSupabaseClient()
  const unique = [...new Set(ids.filter(Boolean))]
  const result = new Map<string, MissionWorkspaceProgramRow>()

  for (let index = 0; index < unique.length; index += 500) {
    const chunk = unique.slice(index, index + 500)
    if (chunk.length === 0) continue

    const { data, error } = await admin
      .from('facility_programs')
      .select('id, name, program_type')
      .in('id', chunk)

    if (error) {
      throw new Error(
        `[missions-workspace] failed to load programs: ${error.message}`
      )
    }

    for (const row of (data ?? []) as MissionWorkspaceProgramRow[]) {
      result.set(row.id, row)
    }
  }

  return result
}

export function normalizeMissionWorkspaceStatus(
  status: string | null
): string {
  if (!status) return 'draft'
  if (status === 'منفذة' || status === 'مكتملة') return 'completed'
  if (status === 'مغلقة') return 'closed'
  if (status === 'مرفوضة') return 'rejected'
  if (status === 'ملغاة') return 'cancelled'
  return status
}

export function missionWorkspaceTargetSource(
  target: MissionWorkspaceTargetRow | undefined
) {
  if (!target) return null

  if (target.scope_level === 'user') {
    return {
      type: 'target_user' as const,
      label: 'مستهدف مستخدم',
      name: target.scope_name,
      target_type: target.target_type,
    }
  }

  return {
    type: 'target_place' as const,
    label: 'مستهدف مكاني',
    name: target.scope_name,
    target_type: target.target_type,
  }
}
