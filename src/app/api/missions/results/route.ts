import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://upxmlpiemqdfbhyipihh.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                             process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
                             process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                             ''
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing on the server.')
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// 1. GET: Fetch saved results for a mission (bypassing RLS or direct queries)
export async function GET(request: Request) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database client not initialized' }, { status: 500 })
    }

    const { data: { user: caller } } = await supabaseServer.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const missionId = searchParams.get('mission_id')

    if (!missionId) {
      return NextResponse.json({ error: 'Missing mission_id parameter' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    const { data, error } = await adminClient
      .from('mission_results')
      .select('checklist_item_id, answer, notes, photo_url')
      .eq('mission_id', missionId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const mapped = (data || []).map((row: any) => {
      let itemId = row.checklist_item_id
      let notes = row.notes || ''

      if (notes) {
        if (notes.startsWith('__item_id__:')) {
          const delim = notes.indexOf('||')
          if (delim !== -1) {
            itemId = notes.substring('__item_id__:'.length, delim)
            notes = notes.substring(delim + 2)
          }
        } else if (notes.startsWith('__static_id__:')) {
          const delim = notes.indexOf('||')
          if (delim !== -1) {
            itemId = notes.substring('__static_id__:'.length, delim)
            notes = notes.substring(delim + 2)
          }
        }
      }

      return {
        checklist_item_id: itemId,
        item_id: itemId,
        answer: row.answer,
        notes,
        photo_url: row.photo_url || null
      }
    })

    return NextResponse.json(mapped)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// 2. POST: Clear old results and insert fresh ones in a safe backend transaction using Service Role
export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database client not initialized' }, { status: 500 })
    }

    const { data: { user: caller } } = await supabaseServer.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { mission_id, results } = await request.json()

    if (!mission_id || !Array.isArray(results)) {
      return NextResponse.json({ error: 'Invalid or incomplete payload' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // A. Delete existing results for this mission to avoid duplicates and bypass lack of client-side RLS DELETE policy
    const { error: delError } = await adminClient
      .from('mission_results')
      .delete()
      .eq('mission_id', mission_id)

    if (delError) {
      return NextResponse.json({ error: `Failed to clear old results: ${delError.message}` }, { status: 500 })
    }

    // B. Insert new results payload with foreign key safety check
    if (results.length > 0) {
      const { data: validItems } = await adminClient
        .from('checklist_items')
        .select('id')

      const validItemIds = new Set((validItems || []).map((i: any) => i.id))

      const payload = results.map((r: any) => {
        const rawId = r.item_id || r.checklist_item_id || ''
        const isValidFkey = rawId && validItemIds.has(rawId)
        const checklist_item_id = isValidFkey ? rawId : null

        let finalNotes = r.notes || null
        if (!isValidFkey && rawId) {
          finalNotes = `__item_id__:${rawId}||${r.notes || ''}`
        }

        return {
          mission_id,
          checklist_item_id,
          answer: r.answer,
          notes: finalNotes,
          photo_url: r.photo_url || null
        }
      })

      const { error: insError } = await adminClient
        .from('mission_results')
        .insert(payload)

      if (insError) {
        return NextResponse.json({ error: `Failed to save results: ${insError.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
