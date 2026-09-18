import { NextResponse } from 'next/server'
import {
  checkV2ResourceAccess,
  hasV2Permission,
} from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type { V2ResourceScopeContext } from '@/server/authorization/scope-types'

type LeadershipTargetRow = {
  id: string
  title: string
  sector_head_id: string | null
  sector_id: string | null
  target_organization_id: string | null
  undersecretary_id: string | null
  undersecretary_name: string
  governorate: string | null
  target_missions: number
  start_date: string
  end_date: string
  status: string
  instructions: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type CandidateRow = {
  id: string
  full_name: string
  email: string | null
  job_title: string | null
  organization_id: string | null
  sector_id: string | null
  org_level: number | null
  organization?: {
    id: string
    name: string
    governorate: string | null
    sector_id: string | null
  } | null
}

function targetResource(target: LeadershipTargetRow): V2ResourceScopeContext {
  return {
    ownerUserId: target.created_by,
    assignedUserIds: target.undersecretary_id
      ? [target.undersecretary_id]
      : [],
    organizationId: target.target_organization_id,
    sectorId: target.sector_id,
    governorate: target.governorate,
  }
}

function candidateResource(candidate: CandidateRow): V2ResourceScopeContext {
  return {
    assignedUserIds: [candidate.id],
    organizationId: candidate.organization_id,
    sectorId: candidate.sector_id ?? candidate.organization?.sector_id ?? null,
    governorate: candidate.organization?.governorate ?? null,
  }
}

async function enrichTargetExecution(target: LeadershipTargetRow) {
  const admin = getAdminSupabaseClient()

  let query = admin
    .from('missions')
    .select('id, status, scheduled_date, assigned_user_id, facility_id')
    .gte('scheduled_date', target.start_date)
    .lte('scheduled_date', target.end_date)

  if (target.undersecretary_id) {
    query = query.eq('assigned_user_id', target.undersecretary_id)
  }

  const { data: missions, error } = await query

  if (error) {
    console.error('[leadership-targets] mission metrics failed:', error.message)
    return {
      ...target,
      executed_missions: 0,
      in_progress_missions: 0,
      completion_rate: 0,
    }
  }

  let relevant = missions ?? []

  if (target.governorate && !target.undersecretary_id) {
    const facilityIds = [...new Set(
      relevant
        .map((mission) => mission.facility_id)
        .filter((value): value is string => Boolean(value))
    )]

    if (facilityIds.length > 0) {
      const { data: facilities } = await admin
        .from('facilities')
        .select('id, governorate')
        .in('id', facilityIds)

      const allowedFacilityIds = new Set(
        (facilities ?? [])
          .filter((facility) => facility.governorate === target.governorate)
          .map((facility) => String(facility.id))
      )

      relevant = relevant.filter(
        (mission) =>
          mission.facility_id && allowedFacilityIds.has(String(mission.facility_id))
      )
    } else {
      relevant = []
    }
  }

  const executed = relevant.filter((mission) =>
    ['completed', 'closed', 'done', 'منفذة'].includes(String(mission.status))
  ).length

  const inProgress = relevant.filter(
    (mission) =>
      !['completed', 'closed', 'done', 'cancelled', 'منفذة'].includes(
        String(mission.status)
      )
  ).length

  const targetCount = Math.max(1, Number(target.target_missions))

  return {
    ...target,
    executed_missions: executed,
    in_progress_missions: inProgress,
    completion_rate: Math.min(100, Math.round((executed / targetCount) * 100)),
  }
}

export async function GET() {
  try {
    const gate = await requireV2Permission('leadership_targets.view')
    if (!gate.ok) return gate.response

    const admin = getAdminSupabaseClient()

    const { data: rows, error } = await admin
      .from('leadership_targets')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[leadership-targets:GET] query failed:', error.message)
      return NextResponse.json(
        { error: 'تعذر تحميل مستهدفات القيادات' },
        { status: 500 }
      )
    }

    const targets = (rows ?? []) as LeadershipTargetRow[]
    const visibleTargets: LeadershipTargetRow[] = []

    for (const target of targets) {
      const decision = await checkV2ResourceAccess({
        user: gate.user,
        snapshot: gate.access,
        permissionKey: 'leadership_targets.view',
        resource: targetResource(target),
      })

      if (decision.allowed) visibleTargets.push(target)
    }

    const enrichedTargets = await Promise.all(
      visibleTargets.map((target) => enrichTargetExecution(target))
    )

    let candidates: Array<Record<string, unknown>> = []

    if (hasV2Permission(gate.access, 'leadership_targets.create')) {
      const { data: candidateRows, error: candidatesError } = await admin
        .from('users')
        .select(
          'id, full_name, email, job_title, organization_id, sector_id, org_level, organization:organization_id(id, name, governorate, sector_id)'
        )
        .in('org_level', [5, 6])
        .eq('is_active', true)
        .order('full_name')

      if (candidatesError) {
        console.error(
          '[leadership-targets:GET] candidates failed:',
          candidatesError.message
        )
      } else {
        const scopedCandidates: Array<Record<string, unknown>> = []

        for (const candidate of (candidateRows ?? []) as unknown as CandidateRow[]) {
          const decision = await checkV2ResourceAccess({
            user: gate.user,
            snapshot: gate.access,
            permissionKey: 'leadership_targets.create',
            resource: candidateResource(candidate),
          })

          if (!decision.allowed) continue

          scopedCandidates.push({
            id: candidate.id,
            full_name: candidate.full_name,
            email: candidate.email,
            job_title: candidate.job_title,
            governorate: candidate.organization?.governorate ?? null,
            organization_id: candidate.organization_id,
            sector_id: candidate.sector_id,
          })
        }

        candidates = scopedCandidates
      }
    }

    return NextResponse.json({
      currentUser: {
        level: gate.user.orgLevel,
        id: gate.user.profileId,
        email: gate.user.email,
        governorate: null,
        isSectorHeadOrAbove: hasV2Permission(
          gate.access,
          'leadership_targets.create'
        ),
      },
      candidates,
      targets: enrichedTargets,
    })
  } catch (error) {
    console.error('[leadership-targets:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء تحميل المستهدفات' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('leadership_targets.create')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const undersecretaryId =
      typeof body.undersecretary_id === 'string' ? body.undersecretary_id : ''
    const targetMissions = Number(body.target_missions)
    const startDate =
      typeof body.start_date === 'string' ? body.start_date : ''
    const endDate = typeof body.end_date === 'string' ? body.end_date : ''

    if (
      !title ||
      !undersecretaryId ||
      !Number.isFinite(targetMissions) ||
      targetMissions <= 0 ||
      !startDate ||
      !endDate
    ) {
      return NextResponse.json(
        { error: 'يرجى ملء جميع الحقول الإلزامية للمستهدف' },
        { status: 400 }
      )
    }

    const admin = getAdminSupabaseClient()

    const { data: candidateData, error: candidateError } = await admin
      .from('users')
      .select(
        'id, full_name, email, job_title, organization_id, sector_id, org_level, is_active, organization:organization_id(id, name, governorate, sector_id)'
      )
      .eq('id', undersecretaryId)
      .maybeSingle()

    if (candidateError || !candidateData || candidateData.is_active !== true) {
      return NextResponse.json(
        { error: 'المسؤول المستهدف غير موجود أو غير نشط' },
        { status: 400 }
      )
    }

    const candidate = candidateData as unknown as CandidateRow
    const resource = candidateResource(candidate)

    const decision = await checkV2ResourceAccess({
      user: gate.user,
      snapshot: gate.access,
      permissionKey: 'leadership_targets.create',
      resource,
    })

    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: 'لا يمكنك إنشاء مستهدف لهذا المسؤول خارج نطاقك',
          code: 'SCOPE_DENIED',
        },
        { status: 403 }
      )
    }

    const { data: inserted, error: insertError } = await admin
      .from('leadership_targets')
      .insert({
        title,
        sector_head_id: gate.user.profileId,
        sector_id:
          candidate.sector_id ?? candidate.organization?.sector_id ?? null,
        target_organization_id: candidate.organization_id,
        undersecretary_id: candidate.id,
        undersecretary_name: candidate.full_name,
        governorate: candidate.organization?.governorate ?? null,
        target_missions: Math.floor(targetMissions),
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        instructions:
          typeof body.instructions === 'string'
            ? body.instructions.trim() || null
            : null,
        created_by: gate.user.profileId,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('[leadership-targets:POST] insert failed:', insertError.message)
      return NextResponse.json(
        { error: 'تعذر حفظ المستهدف' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      target: {
        ...(inserted as LeadershipTargetRow),
        undersecretary_email: candidate.email,
      },
    })
  } catch (error) {
    console.error('[leadership-targets:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء حفظ المستهدف' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const gate = await requireV2Permission('leadership_targets.delete')
    if (!gate.ok) return gate.response

    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing target ID' }, { status: 400 })
    }

    const admin = getAdminSupabaseClient()
    const { data, error } = await admin
      .from('leadership_targets')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[leadership-targets:DELETE] lookup failed:', error.message)
      return NextResponse.json({ error: 'تعذر تحميل المستهدف' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'المستهدف غير موجود' }, { status: 404 })
    }

    const target = data as LeadershipTargetRow

    const decision = await checkV2ResourceAccess({
      user: gate.user,
      snapshot: gate.access,
      permissionKey: 'leadership_targets.delete',
      resource: targetResource(target),
    })

    if (!decision.allowed) {
      return NextResponse.json(
        { error: 'لا يمكنك حذف مستهدف خارج نطاقك', code: 'SCOPE_DENIED' },
        { status: 403 }
      )
    }

    const { error: deleteError } = await admin
      .from('leadership_targets')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[leadership-targets:DELETE] delete failed:', deleteError.message)
      return NextResponse.json({ error: 'تعذر حذف المستهدف' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[leadership-targets:DELETE] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء حذف المستهدف' },
      { status: 500 }
    )
  }
}
