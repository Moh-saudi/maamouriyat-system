import { NextResponse } from 'next/server'
import {
  checkV2ResourceAccess,
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

function normalizeResultInput(
  result: MissionResultInput,
  validItemIds: ReadonlySet<string>,
  missionId: string
) {
  const rawIdCandidate = result.item_id ?? result.checklist_item_id
  const rawId = typeof rawIdCandidate === 'string' ? rawIdCandidate : ''
  const isValidForeignKey = rawId.length > 0 && validItemIds.has(rawId)
  const rawNotes = typeof result.notes === 'string' ? result.notes : ''

  return {
    mission_id: missionId,
    checklist_item_id: isValidForeignKey ? rawId : null,
    answer: typeof result.answer === 'string' ? result.answer : null,
    notes:
      !isValidForeignKey && rawId
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
    const { data, error } = await admin
      .from('mission_results')
      .select('checklist_item_id, answer, notes, photo_url')
      .eq('mission_id', missionId)

    if (error) {
      console.error('[mission-results:GET] query failed:', error.message)
      return NextResponse.json(
        { error: 'تعذر تحميل نتائج المأمورية' },
        { status: 500 }
      )
    }

    const mapped = ((data ?? []) as MissionResultRow[]).map((row) => {
      let itemId = row.checklist_item_id
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
        answer: row.answer,
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

    const admin = getAdminSupabaseClient()

    const { data: validItems, error: validItemsError } = await admin
      .from('checklist_items')
      .select('id')

    if (validItemsError) {
      console.error(
        '[mission-results:POST] checklist lookup failed:',
        validItemsError.message
      )
      return NextResponse.json(
        { error: 'تعذر التحقق من عناصر نموذج التقييم' },
        { status: 500 }
      )
    }

    const validItemIds = new Set(
      (validItems ?? []).map((item) => String(item.id))
    )

    const payload = (body.results as MissionResultInput[]).map((result) =>
      normalizeResultInput(result, validItemIds, missionId)
    )

    // NOTE: This preserves the legacy replace-all contract. A later domain-service
    // phase should move delete+insert into a database transaction/RPC so partial
    // failure cannot remove previously saved results.
    const { error: deleteError } = await admin
      .from('mission_results')
      .delete()
      .eq('mission_id', missionId)

    if (deleteError) {
      console.error('[mission-results:POST] delete failed:', deleteError.message)
      return NextResponse.json(
        { error: 'Failed to clear old results' },
        { status: 500 }
      )
    }

    if (payload.length > 0) {
      const { error: insertError } = await admin
        .from('mission_results')
        .insert(payload)

      if (insertError) {
        console.error('[mission-results:POST] insert failed:', insertError.message)
        return NextResponse.json(
          { error: 'Failed to save results' },
          { status: 500 }
        )
      }
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
