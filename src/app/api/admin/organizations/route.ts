import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
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

    // التحقق من صلاحيات المستخدم (مستوى 1 أو 2)
    const { data: profile } = await supabaseServer
      .from('users')
      .select('id, level, org_level, sector_id')
      .eq('auth_id', user.id)
      .maybeSingle()

    const userLevel = profile?.org_level ?? profile?.level ?? 7
    if (userLevel > 2) {
      return NextResponse.json({ error: 'هذه العملية تتطلب صلاحيات إدارة النظام أو رئاسة القطاع' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      code,
      parent_id,
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

    if (!parent_id) {
      return NextResponse.json({ error: 'يجب تحديد الجهة أو القطاع الرئيسي التابع له' }, { status: 400 })
    }

    // استرجاع بيانات الجهة الأم لتحديد القطاع والمحافظة تلقائياً
    const { data: parentOrg } = await supabaseServer
      .from('organizations')
      .select('id, name, level, sector_id, governorate, health_admin')
      .eq('id', parent_id)
      .maybeSingle()

    if (!parentOrg) {
      return NextResponse.json({ error: 'الجهة الرئيسية المحددة غير موجودة' }, { status: 400 })
    }

    // تحديد sector_id تلقائياً
    const resolvedSectorId = parentOrg.sector_id || parentOrg.id
    const resolvedGovernorate = governorate || parentOrg.governorate || null
    const resolvedHealthAdmin = health_admin || parentOrg.health_admin || null
    const resolvedLevel = Number(level || (parentOrg.level >= 5 ? 6 : parentOrg.level + 1))
    
    let defaultLabel = 'إدارة فرعية'
    if (resolvedLevel === 3) defaultLabel = 'إدارة مركزية'
    else if (resolvedLevel === 4) defaultLabel = 'إدارة عامة'
    else if (resolvedLevel === 5) defaultLabel = 'مديرية شئون صحية'
    else if (resolvedLevel === 6) defaultLabel = 'إدارة نوعية / صحية'
    else if (resolvedLevel === 7) defaultLabel = 'قسم / وحدة تفتيش'

    const generatedCode = (code && code.trim()) ? code.trim().toUpperCase() : `SUB-${Date.now().toString(36).toUpperCase()}`

    const supabaseAdmin = getSupabaseAdmin() || supabaseServer

    const payload = {
      name: name.trim(),
      code: generatedCode,
      parent_id,
      sector_id: resolvedSectorId,
      level: resolvedLevel,
      level_label: level_label || defaultLabel,
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
