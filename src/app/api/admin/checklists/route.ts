import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase Service Role configuration is missing on the server.')
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// 1. GET: Fetch checklists (bypassing RLS for client initial loading)
export async function GET() {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database client not initialized' }, { status: 500 })
    }

    const { data: { user: caller } } = await supabaseServer.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = getAdminClient()
    let { data, error } = await adminClient
      .from('checklists')
      .select(`
        id,
        name,
        description,
        org_unit_id,
        checklist_sections (
          id,
          name,
          checklist_items (
            id,
            text,
            answer_type,
            is_required,
            violation_priority,
            correction_dept
          )
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error && (error.code === '42703' || error.code === 'PGRST204' || error.message.includes('org_unit_id'))) {
      console.warn('[Checklists API GET] org_unit_id column does not exist on checklists table. Falling back to query without it.')
      const fallbackQuery = await adminClient
        .from('checklists')
        .select(`
          id,
          name,
          description,
          checklist_sections (
            id,
            name,
            checklist_items (
              id,
              text,
              answer_type,
              is_required,
              violation_priority,
              correction_dept
            )
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      data = (fallbackQuery.data || []).map((item: any) => ({
        ...item,
        org_unit_id: null
      })) as any
      error = fallbackQuery.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// 2. POST: Create a checklist, its section, and items
export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database client not initialized' }, { status: 500 })
    }

    const { data: { user: caller }, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseServer
      .from('users')
      .select('id, level')
      .eq('auth_id', caller.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    let isAllowed = profile.level <= 4
    if (!isAllowed) {
      const { data: userPermission } = await supabaseServer
        .from('user_permissions')
        .select('allowed_pages')
        .eq('user_id', profile.id)
        .maybeSingle()

      if (Array.isArray(userPermission?.allowed_pages) && userPermission.allowed_pages.includes('checklists')) {
        isAllowed = true
      }
    }

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { title, dept, type, items, org_unit_id } = await request.json()
    if (!title || !dept || !type || !Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: 'Invalid or incomplete checklist payload' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // A. Create main checklist entry
    let insertPayload: any = {
      name: title,
      facility_type: 'general',
      description: `${dept}|${type}`,
      org_unit_id: org_unit_id || null,
      created_by: profile.id,
      is_active: true
    }

    let { data: newChk, error: chkErr } = await adminClient
      .from('checklists')
      .insert(insertPayload)
      .select('id')
      .single()

    if (chkErr && (chkErr.code === '42703' || chkErr.code === 'PGRST204' || chkErr.message.includes('org_unit_id'))) {
      console.warn('[Checklists API POST] org_unit_id column does not exist on checklists table. Falling back to insert without it.')
      delete insertPayload.org_unit_id
      const fallbackInsert = await adminClient
        .from('checklists')
        .insert(insertPayload)
        .select('id')
        .single()
      newChk = fallbackInsert.data
      chkErr = fallbackInsert.error
    }

    if (chkErr || !newChk) {
      return NextResponse.json({ error: `Failed to create checklist: ${chkErr?.message}` }, { status: 500 })
    }

    // B. Create section
    const { data: newSec, error: secErr } = await adminClient
      .from('checklist_sections')
      .insert({
        checklist_id: newChk.id,
        name: title,
        sort_order: 0
      })
      .select('id')
      .single()

    if (secErr || !newSec) {
      return NextResponse.json({ error: `Failed to create checklist section: ${secErr?.message}` }, { status: 500 })
    }

    // C. Create items
    const itemsPayload = items.map((item: any, idx: number) => ({
      checklist_id: newChk.id,
      section_id: newSec.id,
      text: item.text.trim(),
      answer_type: item.answer_type || 'yes_no',
      is_required: item.is_required ?? true,
      violation_priority: item.violation_priority || 'medium',
      correction_dept: item.correction_dept || dept,
      sort_order: idx
    }))

    const { error: itemsErr } = await adminClient
      .from('checklist_items')
      .insert(itemsPayload)

    if (itemsErr) {
      return NextResponse.json({ error: `Failed to create checklist items: ${itemsErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: newChk.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// 3. DELETE: Remove a checklist by ID
export async function DELETE(request: Request) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database client not initialized' }, { status: 500 })
    }

    const { data: { user: caller }, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseServer
      .from('users')
      .select('id, level')
      .eq('auth_id', caller.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let isAllowed = profile.level <= 4
    if (!isAllowed) {
      const { data: userPermission } = await supabaseServer
        .from('user_permissions')
        .select('allowed_pages')
        .eq('user_id', profile.id)
        .maybeSingle()

      if (Array.isArray(userPermission?.allowed_pages) && userPermission.allowed_pages.includes('checklists')) {
        isAllowed = true
      }
    }

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { url } = request
    const urlObj = new URL(url)
    const id = urlObj.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Checklist ID is required' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    const { error } = await adminClient
      .from('checklists')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// 4. PUT: Update an existing checklist template
export async function PUT(request: Request) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database client not initialized' }, { status: 500 })
    }

    const { data: { user: caller }, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseServer
      .from('users')
      .select('id, level')
      .eq('auth_id', caller.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    let isAllowed = profile.level <= 4
    if (!isAllowed) {
      const { data: userPermission } = await supabaseServer
        .from('user_permissions')
        .select('allowed_pages')
        .eq('user_id', profile.id)
        .maybeSingle()

      if (Array.isArray(userPermission?.allowed_pages) && userPermission.allowed_pages.includes('checklists')) {
        isAllowed = true
      }
    }

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id, title, dept, type, items, org_unit_id } = await request.json()
    if (!id || !title || !dept || !type || !Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: 'Invalid or incomplete checklist payload' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // A. Update checklists main entry
    let updatePayload: any = {
      name: title,
      description: `${dept}|${type}`,
      org_unit_id: org_unit_id || null
    }

    let { error: chkErr } = await adminClient
      .from('checklists')
      .update(updatePayload)
      .eq('id', id)

    if (chkErr && (chkErr.code === '42703' || chkErr.code === 'PGRST204' || chkErr.message.includes('org_unit_id'))) {
      console.warn('[Checklists API PUT] org_unit_id column does not exist on checklists table. Falling back to update without it.')
      delete updatePayload.org_unit_id
      const fallbackUpdate = await adminClient
        .from('checklists')
        .update(updatePayload)
        .eq('id', id)
      chkErr = fallbackUpdate.error
    }

    if (chkErr) {
      return NextResponse.json({ error: `Failed to update checklist: ${chkErr.message}` }, { status: 500 })
    }

    // B. Clean old sections and items (cascades)
    await adminClient.from('checklist_items').delete().eq('checklist_id', id)
    await adminClient.from('checklist_sections').delete().eq('checklist_id', id)

    // C. Create new section
    const { data: newSec, error: secErr } = await adminClient
      .from('checklist_sections')
      .insert({
        checklist_id: id,
        name: title,
        sort_order: 0
      })
      .select('id')
      .single()

    if (secErr || !newSec) {
      return NextResponse.json({ error: `Failed to create checklist section: ${secErr?.message}` }, { status: 500 })
    }

    // D. Create new items
    const itemsPayload = items.map((item: any, idx: number) => ({
      checklist_id: id,
      section_id: newSec.id,
      text: item.text.trim(),
      answer_type: item.answer_type || 'yes_no',
      is_required: item.is_required ?? true,
      violation_priority: item.violation_priority || 'medium',
      correction_dept: item.correction_dept || dept,
      sort_order: idx
    }))

    const { error: itemsErr } = await adminClient
      .from('checklist_items')
      .insert(itemsPayload)

    if (itemsErr) {
      return NextResponse.json({ error: `Failed to create checklist items: ${itemsErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
