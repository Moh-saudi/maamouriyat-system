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
            let sectorId: string | null = null

            if (level === 1) {
              // Level 1: Superadmin oversees all ministry sectors
              sectorName = 'كافة قطاعات الوزارة'
              sectorId = null
            } else if (userProfile.sector_id) {
              sectorId = userProfile.sector_id
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
              sectorId,
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

    // 2. Fetch Sectors, Templates, Sections, and Criteria concurrently in parallel (Promise.all)
    const [sectorsRes, templatesRes, sectionsRes, criteriaRes] = await Promise.all([
      adminClient
        .from('organizations')
        .select('id, name, level')
        .eq('level', 2)
        .order('name', { ascending: true }),
      adminClient
        .from('form_templates')
        .select('id, name, version, description, applicable_sectors, is_base, is_active, created_at, updated_at')
        .eq('is_active', true)
        .order('is_base', { ascending: false }),
      adminClient
        .from('form_sections')
        .select('id, template_id, name, section_number, max_score, sort_order, is_base, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      adminClient
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
    ])

    const sectors = sectorsRes.data || []
    const templates = templatesRes.data || []
    const sections = sectionsRes.data || []
    const criteria = criteriaRes.data || []

    if (templatesRes.error) {
      console.error('[Checklists GET tmplError]', templatesRes.error)
      return NextResponse.json({ error: templatesRes.error.message }, { status: 500 })
    }
    if (sectionsRes.error) {
      console.error('[Checklists GET secError]', sectionsRes.error)
      return NextResponse.json({ error: sectionsRes.error.message }, { status: 500 })
    }
    if (criteriaRes.error) {
      console.error('[Checklists GET critError]', criteriaRes.error)
      return NextResponse.json({ error: criteriaRes.error.message }, { status: 500 })
    }

    // Assemble hierarchical structure (ignoring any non-question headers or total footers)
    const criteriaBySection = new Map<string, any[]>()
    for (const c of criteria || []) {
      const t = (c.criterion_text || '').trim()
      if (
        t === 'المجموع' ||
        t.startsWith('المجموع الكلي') ||
        t.startsWith('المجموع') ||
        t === 'المعيار' ||
        t === 'الدرجة' ||
        t.includes('إجمالي الدرجات') ||
        t === 'ملاحظات' ||
        t === 'البيان' ||
        t === 'م'
      ) {
        continue
      }

      let detectedType = c.score_type
      if (c.score_max_label?.includes('[rating_5]')) detectedType = 'rating_5'
      else if (c.score_max_label?.includes('[percentage]')) detectedType = 'percentage'
      else if (c.score_max_label?.includes('[availability]')) detectedType = 'availability'
      else if (c.score_max_label?.includes('[yes_no]')) detectedType = 'yes_no'
      else if (c.score_max_label?.includes('[compliance_3level]')) detectedType = 'compliance_3level'
      else if (c.score_type === 'binary') detectedType = 'yes_no'
      else if (c.score_type === 'scale_3') detectedType = 'compliance_3level'

      const cleanMaxLabel = (c.score_max_label || '').replace(/\s*\[.*?\]/, '').trim() || (c.score_type === 'binary' ? 'نعم' : 'مطابق')

      const processedCriterion = {
        ...c,
        score_type: detectedType,
        score_max_label: cleanMaxLabel
      }

      if (!criteriaBySection.has(c.section_id)) {
        criteriaBySection.set(c.section_id, [])
      }
      criteriaBySection.get(c.section_id)!.push(processedCriterion)
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
      const { section_id, template_id, criterion_text, score_max_value, score_type } = body
      
      const qType = score_type || 'compliance_3level'
      // Postgres table constraint form_criteria_score_type_check only allows ('binary', 'scale_3')
      const dbScoreType = (qType === 'yes_no') ? 'binary' : 'scale_3'

      // Ensure score_max_value is an integer for Postgres integer column compatibility
      const maxVal = Math.max(1, Math.round(Number(score_max_value) || 5))

      let maxLabel = 'مطابق'
      let zeroLabel = 'غير مطابق'
      let midLabel: string | null = null
      let midValue: number | null = null

      if (qType === 'yes_no') {
        maxLabel = 'نعم'
        zeroLabel = 'لا'
      } else if (qType === 'availability') {
        maxLabel = 'متوفر ومطابق'
        midLabel = 'متوفر وغير مطابق'
        zeroLabel = 'غير متوفر'
        midValue = Math.max(1, Math.round(maxVal * 0.5))
      } else if (qType === 'rating_5') {
        maxLabel = '5 نجوم'
        zeroLabel = 'نجمة واحدة'
        midLabel = '3 نجوم'
        midValue = Math.max(1, Math.round(maxVal * 0.6))
      } else if (qType === 'percentage') {
        maxLabel = '100%'
        zeroLabel = '0%'
        midLabel = '50%'
        midValue = Math.max(1, Math.round(maxVal * 0.5))
      } else if (qType === 'compliance_3level' || qType === 'scale_3') {
        maxLabel = 'مطابق'
        zeroLabel = 'غير مطابق'
        midLabel = 'مطابق جزئياً'
        midValue = Math.max(1, Math.round(maxVal * 0.5))
      }

      // Encode question type in score_max_label so it preserves full fidelity across reloads
      const encodedMaxLabel = `${maxLabel} [${qType}]`

      const { data, error } = await adminClient
        .from('form_criteria')
        .insert({
          section_id,
          template_id: template_id || '00000000-0000-0000-0000-000000001000',
          criterion_text,
          score_type: dbScoreType,
          score_0_label: zeroLabel,
          score_mid_label: midLabel,
          score_mid_value: midValue,
          score_max_label: encodedMaxLabel,
          score_max_value: maxVal,
          requires_photo: Boolean(body.requires_photo),
          requires_note: Boolean(body.requires_note),
          is_base: false,
          is_active: true
        })
        .select()
        .single()

      if (error) {
        console.error('[Checklists POST add_criterion Error]', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, data })
    }

    if (body.action === 'delete_criterion') {
      const { criterion_id } = body
      if (!criterion_id) return NextResponse.json({ error: 'Missing criterion_id' }, { status: 400 })

      const { error } = await adminClient
        .from('form_criteria')
        .update({ is_active: false })
        .eq('id', criterion_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'auto_balance_weights') {
      const { template_id } = body
      if (!template_id) return NextResponse.json({ error: 'Missing template_id' }, { status: 400 })

      // Fetch all active criteria for this template
      const { data: criteria, error: fetchErr } = await adminClient
        .from('form_criteria')
        .select('id')
        .eq('template_id', template_id)
        .eq('is_active', true)

      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 })
      if (!criteria || criteria.length === 0) {
        return NextResponse.json({ success: true, message: 'No criteria to balance' })
      }

      const count = criteria.length
      const baseWeight = Math.floor(100 / count)
      const remainder = 100 - (baseWeight * count)

      for (let i = 0; i < criteria.length; i++) {
        const c = criteria[i]
        const w = i < remainder ? baseWeight + 1 : baseWeight
        await adminClient
          .from('form_criteria')
          .update({
            score_max_value: w,
            score_mid_value: Math.max(1, Math.round(w * 0.5))
          })
          .eq('id', c.id)
      }

      return NextResponse.json({ success: true, balancedCount: count, weightPerCriterion: baseWeight })
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

    if (body.action === 'update_section') {
      const { section_id, name } = body
      if (!section_id || !name?.trim()) {
        return NextResponse.json({ error: 'Missing section_id or name' }, { status: 400 })
      }

      const { data, error } = await adminClient
        .from('form_sections')
        .update({ name: name.trim() })
        .eq('id', section_id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, data })
    }

    if (body.action === 'delete_section') {
      const { section_id } = body
      if (!section_id) return NextResponse.json({ error: 'Missing section_id' }, { status: 400 })

      // Deactivate criteria in this section first
      await adminClient
        .from('form_criteria')
        .update({ is_active: false })
        .eq('section_id', section_id)

      const { error } = await adminClient
        .from('form_sections')
        .update({ is_active: false })
        .eq('id', section_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
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

    if (body.action === 'update_template') {
      const { template_id, name, description, applicable_sectors, version } = body
      if (!template_id || !name?.trim()) {
        return NextResponse.json({ error: 'Missing template_id or name' }, { status: 400 })
      }

      const updates: any = {
        name: name.trim(),
        updated_at: new Date().toISOString()
      }
      if (description !== undefined) updates.description = description ? description.trim() : null
      if (applicable_sectors !== undefined) updates.applicable_sectors = applicable_sectors
      if (version !== undefined) updates.version = version

      const { data, error } = await adminClient
        .from('form_templates')
        .update(updates)
        .eq('id', template_id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, data })
    }

    if (body.action === 'delete_template') {
      const { template_id } = body
      if (!template_id) return NextResponse.json({ error: 'Missing template_id' }, { status: 400 })

      const { error } = await adminClient
        .from('form_templates')
        .update({ is_active: false })
        .eq('id', template_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
