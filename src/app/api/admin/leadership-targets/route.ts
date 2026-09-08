import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const dataFilePath = path.join(process.cwd(), 'src', 'data', 'leadership-targets.json')

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://upxmlpiemqdfbhyipihh.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                             process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
                             process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                             ''
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration')
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

function readStoredTargets(): any[] {
  try {
    if (!fs.existsSync(dataFilePath)) {
      return []
    }
    const raw = fs.readFileSync(dataFilePath, 'utf8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('Error reading leadership targets file:', e)
    return []
  }
}

function writeStoredTargets(targets: any[]) {
  try {
    const dir = path.dirname(dataFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(targets, null, 2), 'utf8')
  } catch (e) {
    console.error('Error writing leadership targets file:', e)
  }
}

export async function GET() {
  try {
    const admin = getAdminClient()

    // 1. Resolve logged in user context
    let currentUser = {
      level: 1,
      id: '',
      email: '',
      governorate: '',
      isSectorHeadOrAbove: true
    }

    try {
      const serverClient = await createServerSupabaseClient()
      if (serverClient) {
        const { data: { user } } = await serverClient.auth.getUser()
        if (user) {
          const { data: profile } = await admin
            .from('users')
            .select('id, email, full_name, level, org_level, organization_id, sector_id')
            .eq('auth_id', user.id)
            .maybeSingle()

          if (profile) {
            const level = profile.org_level ?? profile.level ?? 7
            let userGov = ''
            if (profile.organization_id) {
              const { data: org } = await admin.from('organizations').select('governorate').eq('id', profile.organization_id).maybeSingle()
              if (org?.governorate) userGov = org.governorate
            }

            currentUser = {
              level,
              id: profile.id,
              email: profile.email || user.email || '',
              governorate: userGov,
              isSectorHeadOrAbove: level <= 2
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not resolve user auth in leadership-targets, defaulting to admin:', e)
    }

    // 2. Fetch all undersecretaries and directorate heads (level 5 and 6)
    const { data: undersecretaries } = await admin
      .from('users')
      .select('id, full_name, email, job_title, department, org_level, organization_id')
      .in('org_level', [5, 6])
      .order('full_name')

    // Fetch organizations to match governorates
    const { data: orgs } = await admin
      .from('organizations')
      .select('id, name, governorate, level')
      .in('level', [5, 6])

    const orgMap = new Map((orgs || []).map(o => [o.id, o]))

    const candidates = (undersecretaries || []).map(u => {
      const org = u.organization_id ? orgMap.get(u.organization_id) : null
      return {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        job_title: u.job_title,
        governorate: org?.governorate || (u.full_name.includes('القاهرة') ? 'القاهرة' : (u.full_name.includes('أبنوب') ? 'أسيوط' : 'عام'))
      }
    })

    // 3. Fetch targets from storage
    const rawTargets = readStoredTargets()

    // 4. Fetch actual completed missions from database to compute executed counts dynamically
    const { data: allMissions } = await admin
      .from('missions')
      .select('id, status, scheduled_date, assigned_user_id, facilities:facility_id(governorate)')

    // 5. Enrich targets with dynamic execution metrics
    const targets = rawTargets.map(target => {
      const start = target.start_date
      const end = target.end_date
      const gov = target.governorate?.trim()

      const relevantMissions = (allMissions || []).filter(m => {
        const dateMatch = (!start || (m.scheduled_date && m.scheduled_date >= start)) &&
                          (!end || (m.scheduled_date && m.scheduled_date <= end))
        const govMatch = !gov || (m.facilities as any)?.governorate === gov || gov === 'عام'
        const userMatch = target.undersecretary_id && m.assigned_user_id === target.undersecretary_id
        return dateMatch && (govMatch || userMatch)
      })

      const executedCount = relevantMissions.filter(m => m.status === 'completed' || m.status === 'منفذة').length
      const targetCount = Number(target.target_missions) || 1
      const completionRate = Math.min(100, Math.round((executedCount / targetCount) * 100))

      return {
        ...target,
        executed_missions: executedCount,
        in_progress_missions: relevantMissions.filter(m => m.status !== 'completed' && m.status !== 'cancelled').length,
        completion_rate: completionRate
      }
    })

    // Filter targets based on user scope:
    // If undersecretary / directorate head (level 5/6), only return their targets or their governorate
    let scopedTargets = targets
    if (!currentUser.isSectorHeadOrAbove && currentUser.governorate) {
      scopedTargets = targets.filter(t => 
        t.governorate === currentUser.governorate || 
        t.undersecretary_id === currentUser.id ||
        t.undersecretary_email?.toLowerCase() === currentUser.email.toLowerCase()
      )
    }

    return NextResponse.json({
      currentUser,
      candidates,
      targets: scopedTargets
    })
  } catch (err: any) {
    console.error('Error in leadership-targets GET:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { title, undersecretary_id, undersecretary_name, undersecretary_email, governorate, target_missions, start_date, end_date, instructions } = body

    if (!title || !governorate || !target_missions || !start_date || !end_date) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول الإلزامية للمستهدف' }, { status: 400 })
    }

    const currentTargets = readStoredTargets()
    const newTarget = {
      id: `target-${Date.now()}`,
      title,
      sector_head_id: body.sector_head_id || 'sector-head',
      sector_name: body.sector_name || 'قطاع الطب العلاجي',
      undersecretary_id: undersecretary_id || '',
      undersecretary_name: undersecretary_name || 'وكيل الوزارة',
      undersecretary_email: undersecretary_email || '',
      governorate,
      target_missions: Number(target_missions),
      start_date,
      end_date,
      status: 'active',
      instructions: instructions || '',
      created_at: new Date().toISOString()
    }

    currentTargets.unshift(newTarget)
    writeStoredTargets(currentTargets)

    return NextResponse.json({ success: true, target: newTarget })
  } catch (err: any) {
    console.error('Error in leadership-targets POST:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing target ID' }, { status: 400 })
    }

    const currentTargets = readStoredTargets()
    const filtered = currentTargets.filter(t => t.id !== id)
    writeStoredTargets(filtered)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
