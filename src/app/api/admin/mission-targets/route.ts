import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────
export type TargetFacility = {
  id: string
  name: string
  governorate?: string
  facility_type?: string
  health_admin?: string
  is_visited?: boolean
  visited_at?: string
  mission_id?: string
}

export type MissionTarget = {
  id: string
  title: string
  period_type: 'monthly' | 'quarterly' | 'custom'
  period_label: string
  start_date: string
  end_date: string
  target_missions: number
  scope_level: 'ministry' | 'sector' | 'governorate' | 'health_admin' | 'user'
  scope_name: string
  scope_id?: string
  target_type?: 'aggregate' | 'specific_facilities'
  target_facilities?: TargetFacility[]
  assigned_user_id?: string
  assigned_user_name?: string
  sector_id?: string
  sector_name?: string
  notes?: string
  status: 'active' | 'completed' | 'cancelled'
  created_by?: string
  created_by_name?: string
  created_at: string
  // Computed on read
  executed_missions?: number
  completion_rate?: number
}

import defaultTargetsData from '@/data/mission-targets.json'

// ─── Data File ───────────────────────────────────────────────────────────────
const DATA_PATH = path.join(process.cwd(), 'src', 'data', 'mission-targets.json')

function readTargets(): MissionTarget[] {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const content = fs.readFileSync(DATA_PATH, 'utf8')
      return JSON.parse(content)
    }
  } catch (e) {
    console.warn('Could not read dynamic targets from fs, falling back to bundled data:', e)
  }
  return (defaultTargetsData as unknown as MissionTarget[]) || []
}

function writeTargets(targets: MissionTarget[]) {
  try {
    const dir = path.dirname(DATA_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(DATA_PATH, JSON.stringify(targets, null, 2), 'utf8')
  } catch (e) {
    console.warn('Could not write targets to disk (read-only filesystem in serverless):', e)
  }
}

// ─── Supabase Client ──────────────────────────────────────────────────────────
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://upxmlpiemqdfbhyipihh.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
              ''
  if (!url || !key) return null
  try {
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  } catch (e) {
    console.error('Failed to create Supabase client:', e)
    return null
  }
}

// ─── Helper: Count executed missions & enrich facility status ────────────────
async function enrichTargetExecution(
  admin: ReturnType<typeof getAdminClient>,
  target: MissionTarget
): Promise<{ executed: number; facilities?: TargetFacility[] }> {
  if (!admin) return { executed: 0, facilities: target.target_facilities }
  try {
    // 1. If specific facilities are targeted: check each facility individually
    if (target.target_type === 'specific_facilities' && target.target_facilities && target.target_facilities.length > 0) {
      const facilityIds = target.target_facilities.map(f => typeof f === 'string' ? f : f.id)
      
      let facQuery = admin
        .from('missions')
        .select('id, target_facility_id, facility_id, scheduled_date, completed_at, status, assigned_user_id')
        .in('status', ['completed', 'closed', 'done'])
        .gte('scheduled_date', target.start_date)
        .lte('scheduled_date', target.end_date)

      if (target.assigned_user_id) {
        facQuery = facQuery.eq('assigned_user_id', target.assigned_user_id)
      }

      const { data: missions } = await facQuery
      const visitedMap = new Map<string, { visited_at?: string; mission_id?: string }>()

      for (const m of (missions || [])) {
        const fid = m.target_facility_id || m.facility_id
        if (fid && facilityIds.includes(fid)) {
          visitedMap.set(fid, {
            visited_at: m.completed_at || m.scheduled_date || undefined,
            mission_id: m.id,
          })
        }
      }

      const updatedFacilities: TargetFacility[] = target.target_facilities.map(f => {
        const item = typeof f === 'string' ? { id: f, name: 'منشأة' } : { ...f }
        const visit = visitedMap.get(item.id)
        if (visit) {
          return {
            ...item,
            is_visited: true,
            visited_at: visit.visited_at,
            mission_id: visit.mission_id,
          }
        }
        return {
          ...item,
          is_visited: false,
        }
      })

      const executedCount = updatedFacilities.filter(f => f.is_visited).length
      return { executed: executedCount, facilities: updatedFacilities }
    }

    // 2. Aggregate target mode
    let query = admin
      .from('missions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['completed', 'closed', 'done'])
      .gte('scheduled_date', target.start_date)
      .lte('scheduled_date', target.end_date)

    if (target.scope_level === 'user' && target.assigned_user_id) {
      query = query.eq('assigned_user_id', target.assigned_user_id)
    } else if (target.scope_level === 'sector' && target.sector_id) {
      query = query.eq('sector_id', target.sector_id)
    } else if (target.scope_level === 'governorate' && target.scope_name) {
      const { data: facIds } = await admin
        .from('facilities')
        .select('id')
        .eq('governorate', target.scope_name)
      if (facIds && facIds.length > 0) {
        query = query.in('target_facility_id', facIds.map((f: any) => f.id))
      }
    } else if (target.scope_level === 'health_admin' && target.scope_name) {
      const { data: facIds } = await admin
        .from('facilities')
        .select('id')
        .eq('health_admin', target.scope_name)
      if (facIds && facIds.length > 0) {
        query = query.in('target_facility_id', facIds.map((f: any) => f.id))
      }
    }

    const { count } = await query
    return { executed: count ?? 0 }
  } catch {
    return { executed: 0 }
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const scopeFilter  = searchParams.get('scope') || 'all'
    const statusFilter = searchParams.get('status') || 'all'
    const typeFilter   = searchParams.get('type') || 'all' // 'aggregate' | 'specific_facilities' | 'all'
    const reportMode   = searchParams.get('report') === 'true'
    const forMission   = searchParams.get('for_mission') === 'true' || searchParams.get('all') === 'true'

    const admin = getAdminClient()

    // Resolve caller identity & hierarchy
    let callerLevel = 1
    let callerSectorId: string | null = null
    let callerGov: string | null = null
    let callerHealthAdmin: string | null = null
    let callerUserId: string | null = null
    let callerName = ''

    try {
      const serverClient = await createServerSupabaseClient()
      if (serverClient) {
        const { data: { user } } = await serverClient.auth.getUser()
        if (user && admin) {
          const { data: profile } = await admin
            .from('users')
            .select('id, full_name, level, org_level, sector_id, organization_id')
            .eq('auth_id', user.id)
            .maybeSingle()
          if (profile) {
            callerLevel    = profile.org_level ?? profile.level ?? 7
            callerSectorId = profile.sector_id || null
            callerUserId   = profile.id
            callerName     = profile.full_name || ''
            if (profile.organization_id) {
              const { data: org } = await admin.from('organizations').select('governorate, health_admin').eq('id', profile.organization_id).maybeSingle()
              callerGov = org?.governorate || null
              callerHealthAdmin = org?.health_admin || null
            }
          }
        }
      }
    } catch { /* non-blocking */ }

    // Fetch targets and filter by caller level
    let targets = readTargets()

    if (forMission) {
      // For mission creation wizard: return active targets so any selected team member's targets are available
      targets = targets.filter(t => t.status === 'active')
    } else if (callerLevel >= 2 && callerLevel <= 4 && callerSectorId) {
      targets = targets.filter(t => 
        (callerUserId && t.assigned_user_id === callerUserId) ||
        !t.sector_id || 
        t.sector_id === callerSectorId ||
        t.scope_level === 'user'
      )
    } else if (callerLevel === 5 && callerGov) {
      targets = targets.filter(t => 
        (callerUserId && t.assigned_user_id === callerUserId) ||
        t.scope_level === 'user' || 
        t.scope_level === 'governorate' || 
        t.scope_name === callerGov || 
        !t.scope_name
      )
    } else if (callerLevel === 6 && callerGov) {
      targets = targets.filter(t => 
        (callerUserId && t.assigned_user_id === callerUserId) ||
        t.scope_level === 'user' || 
        t.scope_name === callerGov || 
        !t.scope_name
      )
    } else if (callerLevel === 7 && callerUserId) {
      targets = targets.filter(t => t.scope_level === 'user' && t.assigned_user_id === callerUserId)
    }

    // Additional filters
    if (scopeFilter !== 'all') targets = targets.filter(t => t.scope_level === scopeFilter)
    if (statusFilter !== 'all') targets = targets.filter(t => t.status === statusFilter)
    if (typeFilter !== 'all') targets = targets.filter(t => (t.target_type || 'aggregate') === typeFilter)

    // Enrich with live execution counts & facility statuses
    const enriched = await Promise.all(
      targets.map(async (t) => {
        const { executed, facilities } = await enrichTargetExecution(admin, t)
        const rate = Math.min(100, Math.round((executed / Math.max(1, t.target_missions)) * 100))
        return {
          ...t,
          target_facilities: facilities || t.target_facilities,
          executed_missions: executed,
          completion_rate: rate,
        }
      })
    )

    // Fetch subordinate users (who caller is allowed to set targets for)
    let users: any[] = []
    if (admin && callerLevel <= 6) {
      let usersQuery = admin
        .from('users')
        .select('id, full_name, job_title, level, org_level, sector_id, organization_id')
        .order('full_name')

      // SuperAdmin (level 1): all users
      if (callerLevel === 1) {
        usersQuery = usersQuery.gt('level', 1)
      } else if (callerLevel >= 2 && callerLevel <= 4 && callerSectorId) {
        // Sector: users in caller's sector
        usersQuery = usersQuery.eq('sector_id', callerSectorId).gt('level', callerLevel)
      } else if (callerLevel === 5) {
        // Directorate: users in level 6 or 7
        usersQuery = usersQuery.gte('level', 6)
      } else if (callerLevel === 6) {
        // Health admin: level 7 inspectors
        usersQuery = usersQuery.gte('level', 7)
      }

      const { data: usersData } = await usersQuery.limit(500)
      users = usersData || []
    }

    // Fetch facilities available for facility-based target selection
    let facilities: any[] = []
    if (admin && callerLevel <= 6) {
      let facQuery = admin
        .from('facilities')
        .select('id, name, facility_type, governorate, health_admin, sector_id')
        .eq('is_active', true)
        .order('name')

      if (callerLevel >= 2 && callerLevel <= 4 && callerSectorId) {
        facQuery = facQuery.eq('sector_id', callerSectorId)
      } else if (callerLevel === 5 && callerGov) {
        facQuery = facQuery.eq('governorate', callerGov)
      } else if (callerLevel === 6 && callerHealthAdmin) {
        facQuery = facQuery.eq('health_admin', callerHealthAdmin)
      }

      const { data: facData } = await facQuery.limit(2000)
      facilities = facData || []
    }

    // Compute aggregate report data if requested
    let report = null
    if (reportMode) {
      const totalTarget   = enriched.reduce((s, t) => s + t.target_missions, 0)
      const totalExecuted = enriched.reduce((s, t) => s + (t.executed_missions ?? 0), 0)
      const byScope: Record<string, { target: number; executed: number; count: number }> = {}
      
      let specificTargetsCount = 0
      let aggregateTargetsCount = 0
      let totalFacilitiesTargeted = 0
      let totalFacilitiesVisited = 0

      for (const t of enriched) {
        const key = t.scope_name || t.scope_level
        if (!byScope[key]) byScope[key] = { target: 0, executed: 0, count: 0 }
        byScope[key].target   += t.target_missions
        byScope[key].executed += t.executed_missions ?? 0
        byScope[key].count    += 1

        if (t.target_type === 'specific_facilities') {
          specificTargetsCount++
          const facs = t.target_facilities || []
          totalFacilitiesTargeted += facs.length
          totalFacilitiesVisited  += facs.filter(f => f.is_visited).length
        } else {
          aggregateTargetsCount++
        }
      }

      report = {
        totalTarget,
        totalExecuted,
        overallRate: Math.min(100, Math.round((totalExecuted / Math.max(1, totalTarget)) * 100)),
        specificTargetsCount,
        aggregateTargetsCount,
        totalFacilitiesTargeted,
        totalFacilitiesVisited,
        facilityCoverageRate: totalFacilitiesTargeted > 0 ? Math.min(100, Math.round((totalFacilitiesVisited / totalFacilitiesTargeted) * 100)) : 100,
        byScope: Object.entries(byScope).map(([name, d]) => ({
          name,
          target: d.target,
          executed: d.executed,
          rate: Math.min(100, Math.round((d.executed / Math.max(1, d.target)) * 100)),
          count: d.count,
        })).sort((a, b) => b.executed - a.executed),
      }
    }

    return NextResponse.json({
      targets: enriched,
      users,
      facilities,
      callerLevel,
      callerSectorId,
      callerGov,
      callerHealthAdmin,
      callerUserId,
      callerName,
      report,
    })
  } catch (err: any) {
    console.error('Error in /api/admin/mission-targets GET:', err)
    return NextResponse.json({
      targets: readTargets(),
      users: [],
      facilities: [],
      callerLevel: 1,
      report: null,
      error: err?.message || 'Internal Server Error',
    }, { status: 200 })
  }
}

// ─── POST (Create) ────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const serverClient = await createServerSupabaseClient()
    if (!serverClient) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = getAdminClient()
    if (!admin) return NextResponse.json({ error: 'Supabase service is unavailable' }, { status: 503 })

    const { data: profile } = await admin
      .from('users')
      .select('id, full_name, level, org_level, sector_id')
      .eq('auth_id', user.id)
      .maybeSingle()

    const callerLevel = profile?.org_level ?? profile?.level ?? 7
    if (callerLevel > 6) return NextResponse.json({ error: 'ليس لديك صلاحية إضافة مستهدفات' }, { status: 403 })

    const body = await request.json()
    const {
      title, period_type, period_label, start_date, end_date,
      target_missions, scope_level, scope_name, scope_id,
      target_type, target_facilities,
      assigned_user_id, assigned_user_name, sector_id, sector_name, notes
    } = body

    if (!title || !start_date || !end_date || !scope_level) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 })
    }

    // Determine target count: if specific facilities, defaults to number of facilities
    const finalTargetCount = (target_type === 'specific_facilities' && Array.isArray(target_facilities) && target_facilities.length > 0)
      ? (Number(target_missions) > 0 ? Number(target_missions) : target_facilities.length)
      : Number(target_missions || 1)

    // Format target facilities
    const formattedFacilities: TargetFacility[] = Array.isArray(target_facilities)
      ? target_facilities.map((f: any) => ({
          id: f.id,
          name: f.name || 'منشأة',
          governorate: f.governorate,
          facility_type: f.facility_type,
          health_admin: f.health_admin,
          is_visited: false,
        }))
      : []

    const newTarget: MissionTarget = {
      id: `target-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      period_type: period_type || 'monthly',
      period_label: period_label || title,
      start_date,
      end_date,
      target_missions: finalTargetCount,
      scope_level,
      scope_name: scope_name || (scope_level === 'user' ? (assigned_user_name || 'مفتش') : ''),
      scope_id: scope_id || undefined,
      target_type: target_type || 'aggregate',
      target_facilities: formattedFacilities,
      assigned_user_id: assigned_user_id || undefined,
      assigned_user_name: assigned_user_name || undefined,
      sector_id: sector_id || profile?.sector_id || undefined,
      sector_name: sector_name || undefined,
      notes: notes || undefined,
      status: 'active',
      created_by: profile?.id,
      created_by_name: profile?.full_name || user.email || '',
      created_at: new Date().toISOString(),
    }

    const targets = readTargets()
    targets.unshift(newTarget)
    writeTargets(targets)

    return NextResponse.json({ target: newTarget })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── PATCH (Update) ───────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const serverClient = await createServerSupabaseClient()
    if (!serverClient) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, target_facilities, target_missions, ...updates } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const targets = readTargets()
    const idx = targets.findIndex(t => t.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Target not found' }, { status: 404 })

    const current = targets[idx]
    let formattedFacilities = current.target_facilities

    if (Array.isArray(target_facilities)) {
      formattedFacilities = target_facilities.map((f: any) => ({
        id: f.id,
        name: f.name || 'منشأة',
        governorate: f.governorate,
        facility_type: f.facility_type,
        health_admin: f.health_admin,
        is_visited: Boolean(f.is_visited),
        visited_at: f.visited_at,
        mission_id: f.mission_id,
      }))
    }

    targets[idx] = {
      ...current,
      ...updates,
      target_missions: target_missions ? Number(target_missions) : current.target_missions,
      target_facilities: formattedFacilities,
    }
    writeTargets(targets)

    return NextResponse.json({ target: targets[idx] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const serverClient = await createServerSupabaseClient()
    if (!serverClient) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const targets = readTargets()
    writeTargets(targets.filter(t => t.id !== id))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
