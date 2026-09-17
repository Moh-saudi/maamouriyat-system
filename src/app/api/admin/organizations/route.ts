import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://upxmlpiemqdfbhyipihh.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                             process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
                             process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                             ''
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// 1. GET: استرجاع الهيكل التنظيمي والوحدات الفرعية
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 })
    }

    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*')
      .order('level')
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: orgs ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ غير متوقع' }, { status: 500 })
  }
}

// 2. POST: إنشاء وحدة / قسم / إدارة فرعية جديدة (Sub-Unit) مع صلاحياتها
export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 })
    }

    const { data: { user } } = await supabaseServer.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'جلسة المستخدم منتهية' }, { status: 401 })
    }

    // التحقق من صلاحيات المستخدم (مستوى 0 دعم فني، 1 وزارة، 2 قطاع، 3 إدارة مركزية)
    const { data: profile } = await supabaseServer
      .from('users')
      .select('id, level, org_level, sector_id, email')
      .eq('auth_id', user.id)
      .maybeSingle()

    const userLevel = profile?.org_level ?? profile?.level ?? 7
    const userEmail = (user.email || profile?.email || '').toLowerCase()
    const isSuperOrTech = userLevel === 0 || userLevel === 1 || userEmail.includes('admin@')

    if (userLevel > 3 && !isSuperOrTech) {
      return NextResponse.json({ error: 'هذه العملية تتطلب صلاحيات إدارة النظام أو رئاسة القطاع أو الإدارة المركزية' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      code,
      parent_id,
      parent_name,
      level,
      level_label,
      governorate,
      health_admin,
      can_issue_missions = true,
      can_approve_missions = false,
      can_view_all_governorate = false,
      can_view_sector_facilities = false,
    } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'اسم الوحدة أو الإدارة الفرعية مطلوب' }, { status: 400 })
    }

    if (!parent_id && !parent_name && !body.sector_id) {
      return NextResponse.json({ error: 'يجب تحديد الجهة أو الإدارة التابع لها' }, { status: 400 })
    }

    // استرجاع بيانات الجهة الأم لتحديد القطاع والمحافظة تلقائياً
    let parentOrg: any = null
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(parent_id || ''))

    if (isUuid) {
      const { data } = await supabaseServer
        .from('organizations')
        .select('id, name, level, sector_id, governorate, health_admin')
        .eq('id', parent_id)
        .maybeSingle()
      parentOrg = data
    }

    if (!parentOrg && (parent_name || parent_id)) {
      const searchName = String(parent_name || parent_id).trim()
      const { data: exactMatch } = await supabaseServer
        .from('organizations')
        .select('id, name, level, sector_id, governorate, health_admin')
        .eq('name', searchName)
        .maybeSingle()
      parentOrg = exactMatch

      if (!parentOrg) {
        const { data: list } = await supabaseServer
          .from('organizations')
          .select('id, name, level, sector_id, governorate, health_admin')
          .ilike('name', `%${searchName}%`)
          .limit(1)
        parentOrg = list?.[0] || null
      }
    }

    if (!parentOrg && body.sector_id) {
      const { data: sectorOrg } = await supabaseServer
        .from('organizations')
        .select('id, name, level, sector_id, governorate, health_admin')
        .eq('id', body.sector_id)
        .maybeSingle()
      parentOrg = sectorOrg
    }

    if (!parentOrg) {
      return NextResponse.json({ error: 'الجهة الرئيسية المحددة غير موجودة في قاعدة البيانات' }, { status: 400 })
    }

    // تحديد sector_id تلقائياً
    const resolvedSectorId = parentOrg.sector_id || parentOrg.id
    const resolvedGovernorate = governorate || parentOrg.governorate || null
    const resolvedHealthAdmin = health_admin || parentOrg.health_admin || null
    const resolvedLevel = Number(level || (parentOrg.level >= 5 ? 6 : parentOrg.level + 1))

    // حظر أمني: رئيس القطاع (المستوى 2) لا يمكنه إضافة إدارات خارج نطاق قطاعه
    if (userLevel === 2 && profile?.sector_id && !isSuperOrTech) {
      if (resolvedSectorId !== profile.sector_id) {
        return NextResponse.json({ error: 'لا يمكن لرئيس القطاع إضافة إدارات أو وحدات خارج نطاق قطاعه المعتمد' }, { status: 403 })
      }
    }
    
    // التوافق التام مع قيد قاعدة البيانات organizations_level_label_check
    const validLevelLabels: Record<number, string> = {
      1: 'ministry',
      2: 'sector',
      3: 'central_admin',
      4: 'general_admin',
      5: 'directorate',
      6: 'health_admin',
      7: 'unit',
    }
    const defaultLabel = validLevelLabels[resolvedLevel] || 'unit'
    const allowedLabels = ['ministry', 'sector', 'central_admin', 'general_admin', 'directorate', 'health_admin', 'unit']
    const finalLevelLabel = (level_label && allowedLabels.includes(level_label)) ? level_label : defaultLabel

    const generatedCode = (code && code.trim()) ? code.trim().toUpperCase() : `SUB-${Date.now().toString(36).toUpperCase()}`

    const supabaseAdmin = getSupabaseAdmin() || supabaseServer

    const payload = {
      name: name.trim(),
      code: generatedCode,
      parent_id: parentOrg.id,
      sector_id: resolvedSectorId,
      level: resolvedLevel,
      level_label: finalLevelLabel,
      governorate: resolvedGovernorate,
      health_admin: resolvedHealthAdmin,
      can_issue_missions: Boolean(can_issue_missions),
      can_approve_missions: Boolean(can_approve_missions),
      can_view_all_governorate: Boolean(can_view_all_governorate),
      can_view_sector_facilities: Boolean(can_view_sector_facilities),
      is_active: true,
    }

    const { data: insertedOrg, error: insertError } = await supabaseAdmin
      .from('organizations')
      .insert(payload)
      .select('*')
      .single()

    if (insertError) {
      console.error('[organizations:POST] insert error:', insertError)
      return NextResponse.json({ error: 'فشل حفظ الوحدة الفرعية: ' + insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: insertedOrg,
      message: `تم إنشاء وتسجيل الوحدة الفرعية (${insertedOrg.name}) وضبط صلاحياتها بنجاح.`
    })
  } catch (err: any) {
    console.error('[organizations:POST] unexpected error:', err)
    return NextResponse.json({ error: err.message || 'خطأ غير متوقع' }, { status: 500 })
  }
}

// 3. PUT: تحديث الوحدة الفرعية وصلاحياتها
export async function PUT(request: NextRequest) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 })
    }

    const { data: { user } } = await supabaseServer.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'جلسة المستخدم منتهية' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, code, can_issue_missions, can_approve_missions, can_view_all_governorate, can_view_sector_facilities, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'معرف الوحدة مطلوب' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin() || supabaseServer

    const updatePayload: any = {}
    if (name !== undefined) updatePayload.name = name.trim()
    if (code !== undefined) updatePayload.code = code.trim().toUpperCase()
    if (can_issue_missions !== undefined) updatePayload.can_issue_missions = Boolean(can_issue_missions)
    if (can_approve_missions !== undefined) updatePayload.can_approve_missions = Boolean(can_approve_missions)
    if (can_view_all_governorate !== undefined) updatePayload.can_view_all_governorate = Boolean(can_view_all_governorate)
    if (can_view_sector_facilities !== undefined) updatePayload.can_view_sector_facilities = Boolean(can_view_sector_facilities)
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active)

    const { data: updatedOrg, error: updateError } = await supabaseAdmin
      .from('organizations')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'فشل تحديث بيانات الوحدة: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: updatedOrg,
      message: `تم تحديث صلاحيات وبيانات الوحدة (${updatedOrg.name}) بنجاح.`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ غير متوقع' }, { status: 500 })
  }
}

// 4. DELETE: تعطيل أو حذف وحدة تنظيمية
export async function DELETE(request: NextRequest) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 })
    }

    const { data: { user } } = await supabaseServer.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'جلسة المستخدم منتهية' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'معرف الوحدة مطلوب' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin() || supabaseServer

    const { error: deleteError } = await supabaseAdmin
      .from('organizations')
      .update({ is_active: false })
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: 'فشل تعطيل الوحدة: ' + deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'تم تعطيل الوحدة التنظيمية بنجاح.'
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ غير متوقع' }, { status: 500 })
  }
}
