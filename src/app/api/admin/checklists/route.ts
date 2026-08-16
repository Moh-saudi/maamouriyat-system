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

// 1. GET: Fetch form templates, sections, and criteria scoped by Sector & Role
export async function GET() {
  try {
    const adminClient = getAdminClient()

    // 1. Resolve User Context if authenticated
    let userContext = {
      level: 1,
      roleTitle: 'مدير النظام (ديوان الوزارة)',
      orgName: 'وزارة الصحة والسكان',
      sectorId: null as string | null,
      sectorName: 'كافة قطاعات الوزارة',
      canEdit: true,
      canCustomize: true
    }

    try {
      const supabaseServer = await createServerSupabaseClient()
      if (supabaseServer) {
        const { data: { user } } = await supabaseServer.auth.getUser()
        if (user) {
          const { data: userProfile } = await adminClient
            .from('users')
            .select(`
              id, full_name, org_level, organization_id, sector_id,
              organizations:organization_id (id, name, level)
            `)
            .eq('auth_id', user.id)
            .maybeSingle()

          if (userProfile) {
            const level = userProfile.org_level ?? 1
            const org = userProfile.organizations as any

            let roleTitle = 'مستخدم النظام'
            if (level === 1) roleTitle = 'المشرف العام (ديوان عام الوزارة)'
            else if (level === 2) roleTitle = `رئيس القطاع المركزي (${org?.name || 'القطاع'})`
            else if (level === 3) roleTitle = 'رئيس الإدارة المركزية'
            else if (level === 4) roleTitle = 'مدير عام الإدارة العامة'
            else if (level === 5) roleTitle = `مدير مديرية الشئون الصحية (${org?.name || 'المديرية'})`
            else if (level === 6) roleTitle = `مدير الإدارة الصحية (${org?.name || 'الإدارة'})`
            else roleTitle = 'مفتش / عضو فريق المرور الميداني'

            let sectorName = 'كافة قطاعات الوزارة'
            if (userProfile.sector_id) {
              const { data: secOrg } = await adminClient
                .from('organizations')
                .select('name')
                .eq('id', userProfile.sector_id)
                .maybeSingle()
              if (secOrg) sectorName = secOrg.name
            }

            userContext = {
              level,
              roleTitle,
              orgName: org?.name || 'وزارة الصحة والسكان',
              sectorId: userProfile.sector_id || null,
              sectorName,
              canEdit: level <= 2, // Level 1 Superadmin or Level 2 Sector Head can modify base template
              canCustomize: level <= 5 // Directorate can add localized criteria
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Checklists GET] Could not resolve session user, defaulting to admin context')
    }

    // 2. Fetch all Sectors (Level 2)
    const { data: sectors } = await adminClient
      .from('organizations')
      .select('id, name, level')
      .eq('level', 2)
      .order('name', { ascending: true })

    // 3. Fetch form templates
    const { data: templates, error: tmplError } = await adminClient
      .from('form_templates')
      .select('id, name, version, description, applicable_sectors, is_base, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('is_base', { ascending: false })

    if (tmplError) {
      console.error('[Checklists GET tmplError]', tmplError)
      return NextResponse.json({ error: tmplError.message }, { status: 500 })
    }

    // 4. Fetch all sections
    const { data: sections, error: secError } = await adminClient
      .from('form_sections')
      .select('id, template_id, name, section_number, max_score, sort_order, is_base, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (secError) {
      console.error('[Checklists GET secError]', secError)
      return NextResponse.json({ error: secError.message }, { status: 500 })
    }

    // 5. Fetch all criteria
    const { data: criteria, error: critError } = await adminClient
      .from('form_criteria')
      .select(`
        id, section_id, template_id, criterion_text,
        score_type, score_0_label, score_mid_label, score_mid_value,
        score_max_label, score_max_value, requires_photo, requires_note,
        sort_order, is_base, is_active
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .range(0, 999)

    if (critError) {
      console.error('[Checklists GET critError]', critError)
      return NextResponse.json({ error: critError.message }, { status: 500 })
    }

    // Assemble hierarchical structure
    const criteriaBySection = new Map<string, any[]>()
    for (const c of criteria || []) {
      if (!criteriaBySection.has(c.section_id)) {
        criteriaBySection.set(c.section_id, [])
      }
      criteriaBySection.get(c.section_id)!.push(c)
    }

    const sectionsByTemplate = new Map<string, any[]>()
    for (const s of sections || []) {
      const secWithCriteria = {
        ...s,
        criteria: criteriaBySection.get(s.id) || []
      }
      if (!sectionsByTemplate.has(s.template_id)) {
        sectionsByTemplate.set(s.template_id, [])
      }
      sectionsByTemplate.get(s.template_id)!.push(secWithCriteria)
    }

    const result = (templates || []).map((t) => ({
      ...t,
      updated_by_name: 'ديوان عام الوزارة - قطاع الرعاية الصحية الأولية وتنمية الأسرة',
      sections: sectionsByTemplate.get(t.id) || []
    }))

    return NextResponse.json({
      userContext,
      sectors: sectors || [],
      templates: result,
      totalSections: sections?.length || 0,
      totalCriteria: criteria?.length || 0
    })
  } catch (err: any) {
    console.error('[Checklists GET exception]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// 2. POST: Add a new custom criterion or section
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

    const body = await request.json()
    const adminClient = getAdminClient()

    if (body.action === 'add_criterion') {
      const { section_id, template_id, criterion_text, score_max_value } = body
      const { data, error } = await adminClient
        .from('form_criteria')
        .insert({
          section_id,
          template_id: template_id || '00000000-0000-0000-0000-000000001000',
          criterion_text,
          score_type: body.score_type || 'binary',
          score_0_label: 'غير مطابق',
          score_max_label: 'مطابق',
          score_max_value: score_max_value || 2,
          is_base: false,
          is_active: true
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, data })
    }

    if (body.action === 'add_section') {
      const { template_id, name } = body
      const { data, error } = await adminClient
        .from('form_sections')
        .insert({
          template_id: template_id || '00000000-0000-0000-0000-000000001000',
          name,
          section_number: body.section_number || 99,
          sort_order: body.sort_order || 99,
          is_base: false,
          is_active: true
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, data })
    }

    if (body.action === 'create_template') {
      const { name, version, description, applicable_sectors } = body
      const { data, error } = await adminClient
        .from('form_templates')
        .insert({
          name,
          version: version || '1.0',
          description: description || null,
          applicable_sectors: applicable_sectors || null,
          applicable_levels: [5, 6, 7],
          is_base: false,
          is_active: true
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, data })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
