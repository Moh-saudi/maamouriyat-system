import { NextResponse } from 'next/server'
import {
  checkV2ResourceAccess,
  hasV2Permission,
} from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { loadMissionResourceScope } from '@/server/authorization/resources/mission'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type {
  V2AuthenticatedUser,
} from '@/server/auth/types'
import type {
  V2AuthorizationSnapshot,
} from '@/server/authorization/types'

type MissionResultRow = {
  checklist_item_id: string | null
  form_criterion_id: string | null
  answer: string | null
  notes: string | null
  photo_url: string | null
}

type MissionResultInput = {
  item_id?: unknown
  checklist_item_id?: unknown
  answer?: unknown
  notes?: unknown
  photo_url?: unknown
}

async function authorizeMissionResource(input: {
  user: V2AuthenticatedUser
  access: V2AuthorizationSnapshot
  permissionKey: string
  missionId: string
}) {
  const resource = await loadMissionResourceScope(input.missionId)

  if (!resource) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'المأمورية غير موجودة', code: 'MISSION_NOT_FOUND' },
        { status: 404 }
      ),
    }
  }

  const decision = await checkV2ResourceAccess({
    user: input.user,
    snapshot: input.access,
    permissionKey: input.permissionKey,
    resource,
  })

  if (!decision.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'ليس لديك صلاحية الوصول إلى هذه المأمورية', code: 'SCOPE_DENIED' },
        { status: 403 }
      ),
    }
  }

  return { ok: true as const }
}

async function loadMissionTeamState(
  missionId: string,
  userId: string
) {
  const admin = getAdminSupabaseClient()

  const { data: mission, error: missionError } = await admin
    .from('missions')
    .select('assigned_user_id, primary_inspector_id')
    .eq('id', missionId)
    .maybeSingle()

  if (missionError) {
    throw new Error(
      '[mission-results] failed to load mission team anchors: ' +
        missionError.message
    )
  }

  if (!mission) return { exists: false, isTeamMember: false }

  const { data: teamMember, error: teamError } = await admin
    .from('mission_team')
    .select('user_id')
    .eq('mission_id', missionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (teamError) {
    throw new Error(
      '[mission-results] failed to load team member: ' +
        teamError.message
    )
  }

  return {
    exists: true,
    isTeamMember:
      mission.assigned_user_id === userId ||
      mission.primary_inspector_id === userId ||
      Boolean(teamMember),
  }
}

async function loadActiveChecklistRunId(missionId: string) {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('mission_checklist_runs')
    .select('id')
    .eq('mission_id', missionId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(
      '[mission-results] failed to load active checklist run: ' +
        error.message
    )
  }

  return data?.id ? String(data.id) : null
}

function encodeMissionResultAnswer(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') return value

  try {
    return '__json__:' + JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function decodeMissionResultAnswer(value: string | null): unknown {
  if (!value) return value

  if (!value.startsWith('__json__:')) {
    return value
  }

  try {
    return JSON.parse(value.slice('__json__:'.length))
  } catch {
    return value
  }
}

function normalizeResultInput(
  result: MissionResultInput,
  validLegacyItemIds: ReadonlySet<string>,
  validFormCriterionIds: ReadonlySet<string>,
  missionId: string
) {
  const rawIdCandidate = result.item_id ?? result.checklist_item_id
  const rawId = typeof rawIdCandidate === 'string' ? rawIdCandidate : ''
  const isValidLegacyItem =
    rawId.length > 0 && validLegacyItemIds.has(rawId)
  const isValidFormCriterion =
    rawId.length > 0 && validFormCriterionIds.has(rawId)
  const rawNotes = typeof result.notes === 'string' ? result.notes : ''

  return {
    mission_id: missionId,
    checklist_item_id: isValidLegacyItem ? rawId : null,
    form_criterion_id: isValidFormCriterion ? rawId : null,
    answer: encodeMissionResultAnswer(result.answer),
    notes:
      !isValidLegacyItem && !isValidFormCriterion && rawId
        ? `__item_id__:${rawId}||${rawNotes}`
        : rawNotes || null,
    photo_url: typeof result.photo_url === 'string' ? result.photo_url : null,
  }
}

// GET: fetch saved results for a mission after permission + scope enforcement.
export async function GET(request: Request) {
  try {
    const gate = await requireV2Permission('mission_results.view')
    if (!gate.ok) return gate.response

    const { searchParams } = new URL(request.url)
    const missionId = searchParams.get('mission_id')

    if (!missionId) {
      return NextResponse.json(
        { error: 'Missing mission_id parameter' },
        { status: 400 }
      )
    }

    const missionAccess = await authorizeMissionResource({
      user: gate.user,
      access: gate.access,
      permissionKey: 'mission_results.view',
      missionId,
    })

    if (!missionAccess.ok) return missionAccess.response

    const admin = getAdminSupabaseClient()
    const activeRunId = await loadActiveChecklistRunId(missionId)

    let query = admin
      .from('mission_results')
      .select('checklist_item_id, form_criterion_id, answer, notes, photo_url')
      .eq('mission_id', missionId)

    query = activeRunId
      ? query.eq('checklist_run_id', activeRunId)
      : query.is('checklist_run_id', null)

    const { data, error } = await query

    if (error) {
      console.error('[mission-results:GET] query failed:', error.message)
      return NextResponse.json(
        { error: 'تعذر تحميل نتائج المأمورية' },
        { status: 500 }
      )
    }

    const mapped = ((data ?? []) as MissionResultRow[]).map((row) => {
      let itemId = row.form_criterion_id ?? row.checklist_item_id
      let notes = row.notes || ''

      if (notes.startsWith('__item_id__:') || notes.startsWith('__static_id__:')) {
        const prefix = notes.startsWith('__item_id__:')
          ? '__item_id__:'
          : '__static_id__:'
        const delimiterIndex = notes.indexOf('||')

        if (delimiterIndex !== -1) {
          itemId = notes.substring(prefix.length, delimiterIndex)
          notes = notes.substring(delimiterIndex + 2)
        }
      }

      return {
        checklist_item_id: itemId,
        item_id: itemId,
        answer: decodeMissionResultAnswer(row.answer),
        notes,
        photo_url: row.photo_url || null,
      }
    })

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('[mission-results:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء تحميل النتائج' },
      { status: 500 }
    )
  }
}

// POST: replace mission results after explicit edit permission + trusted scope check.
export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('mission_results.edit')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as {
      mission_id?: unknown
      results?: unknown
    }

    const missionId =
      typeof body.mission_id === 'string' ? body.mission_id : ''

    if (!missionId || !Array.isArray(body.results)) {
      return NextResponse.json(
        { error: 'Invalid or incomplete payload' },
        { status: 400 }
      )
    }

    const missionAccess = await authorizeMissionResource({
      user: gate.user,
      access: gate.access,
      permissionKey: 'mission_results.edit',
      missionId,
    })

    if (!missionAccess.ok) return missionAccess.response

    const teamState = await loadMissionTeamState(
      missionId,
      gate.user.profileId
    )

    if (
      !teamState.exists ||
      !teamState.isTeamMember ||
      !hasV2Permission(gate.access, 'missions.execute')
    ) {
      return NextResponse.json(
        {
          error:
            'تسجيل إجابات الاستمارة متاح فقط لعضو فريق المأمورية المكلف بالتنفيذ.',
          code: 'MISSION_TEAM_EXECUTION_REQUIRED',
        },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()

    const rawIds = [
      ...new Set(
        (body.results as MissionResultInput[])
          .map((result) => result.item_id ?? result.checklist_item_id)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      ),
    ]

    const [
      { data: validItems, error: validItemsError },
      { data: validCriteria, error: validCriteriaError },
    ] = await Promise.all([
      rawIds.length > 0
        ? admin
            .from('checklist_items')
            .select('id')
            .in('id', rawIds)
        : Promise.resolve({ data: [], error: null }),
      rawIds.length > 0
        ? admin
            .from('form_criteria')
            .select('id')
            .in('id', rawIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    const lookupError = validItemsError || validCriteriaError

    if (lookupError) {
      console.error(
        '[mission-results:POST] checklist lookup failed:',
        lookupError.message
      )
      return NextResponse.json(
        { error: 'تعذر التحقق من عناصر نموذج التقييم' },
        { status: 500 }
      )
    }

    const validLegacyItemIds = new Set(
      (validItems ?? []).map((item) => String(item.id))
    )
    const validFormCriterionIds = new Set(
      (validCriteria ?? []).map((item) => String(item.id))
    )

    const payload = (body.results as MissionResultInput[]).map((result) =>
      normalizeResultInput(
        result,
        validLegacyItemIds,
        validFormCriterionIds,
        missionId
      )
    )

    const { error: replaceError } = await admin.rpc('replace_mission_results', {
      p_mission_id: missionId,
      p_results: payload,
    })

    if (replaceError) {
      console.error(
        '[mission-results:POST] atomic replace failed:',
        replaceError.message
      )
      return NextResponse.json(
        { error: 'Failed to save results' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[mission-results:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء حفظ النتائج' },
      { status: 500 }
    )
  }
}
