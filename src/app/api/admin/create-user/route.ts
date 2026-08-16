import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ══════════════════════════════════════════════════════════════
// POST /api/admin/create-user
// إنشاء مستخدم جديد مع ربطه بالهيكل التنظيمي الجديد
// الحقل المحوري: organization_id (UUID) بدلاً من department (نص)
// ══════════════════════════════════════════════════════════════

type AuthAdminUser = {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
}

export async function POST(request: Request) {
  try {
    // ── التحقق من هوية المستخدم الحالي
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'خادم الاتصال بقاعدة البيانات غير مهيأ' }, { status: 500 })
    }

    const { data: { user: caller }, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !caller) {
      return NextResponse.json({ error: 'غير مصرح بالوصول — يرجى تسجيل الدخول' }, { status: 401 })
    }

    // ── التحقق من صلاحية الإنشاء (مستوى 1 أو 2 فقط)
    const { data: callerProfile, error: profileError } = await supabaseServer
      .from('users')
      .select('org_level, sector_id, organization_id')
      .eq('auth_id', caller.id)
      .maybeSingle()

    if (profileError || !callerProfile) {
      return NextResponse.json({ error: 'تعذر التحقق من صلاحياتك' }, { status: 403 })
    }

    if (callerProfile.org_level > 2) {
      return NextResponse.json(
        { error: 'غير مصرح — إنشاء المستخدمين للمستوى الوزاري والقطاعي فقط' },
        { status: 403 }
      )
    }

    // ── قراءة البيانات من الطلب
    const body = await request.json()
    const {
      email,
      full_name,
      job_title,
      phone,
      national_id,
      can_inspect,
      direct_manager_id,
      financial_code,
      facility_id,
      department,
      level,
      org_level,
    } = body

    const targetOrgId = body.organization_id || body.org_unit_id

    if (!email || !full_name) {
      return NextResponse.json({ error: 'البريد الإلكتروني والاسم الكامل مطلوبان' }, { status: 400 })
    }

    if (!targetOrgId) {
      return NextResponse.json({ error: 'يجب تحديد الجهة التنظيمية للمستخدم' }, { status: 400 })
    }

    // ── التحقق من أن الجهة المحددة ضمن نطاق صلاحية المُشغِّل
    const { data: targetOrg } = await supabaseServer
      .from('organizations')
      .select('id, level, sector_id, name')
      .eq('id', targetOrgId)
      .maybeSingle()

    if (!targetOrg) {
      return NextResponse.json({ error: 'الجهة التنظيمية المحددة غير موجودة' }, { status: 400 })
    }

    // مستوى 2 (قطاع) لا يستطيع إنشاء مستخدمين في قطاع آخر
    if (
      callerProfile.org_level === 2 &&
      targetOrg.sector_id !== callerProfile.sector_id &&
      targetOrg.id !== callerProfile.sector_id
    ) {
      return NextResponse.json(
        { error: 'لا يمكنك إنشاء مستخدمين خارج نطاق قطاعك' },
        { status: 403 }
      )
    }

    // ── إعداد عميل الخدمة الإدارية
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'مفتاح الخدمة الإدارية غير متوفر' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const normalizedEmail = String(email).trim().toLowerCase()
    const tempPassword = '123456'

    // ── التحقق من عدم وجود المستخدم مسبقاً
    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id, auth_id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingProfile?.auth_id) {
      return NextResponse.json(
        { error: 'هذا البريد الإلكتروني مسجل بالفعل في المنظومة' },
        { status: 409 }
      )
    }

    // ── إنشاء حساب المصادقة (Supabase Auth)
    let authUser: AuthAdminUser | null = null

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        job_title: job_title || null,
        must_change_password: true,
      },
    })

    if (createError) {
      const msg = createError.message || ''
      if (msg.includes('already been registered') || msg.includes('already registered')) {
        // البريد موجود في Auth — نبحث عنه ونحدّثه
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        authUser = authList?.users.find((u) => u.email?.toLowerCase() === normalizedEmail) ?? null
        if (!authUser) {
          return NextResponse.json(
            { error: 'البريد مسجل في المصادقة لكن تعذر الوصول إليه' },
            { status: 500 }
          )
        }
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          password: tempPassword,
          email_confirm: true,
          user_metadata: { ...authUser.user_metadata, full_name, must_change_password: true },
        })
      } else {
        return NextResponse.json(
          { error: 'فشل إنشاء الحساب: ' + createError.message },
          { status: 500 }
        )
      }
    } else {
      authUser = authData.user
    }

    if (!authUser) {
      return NextResponse.json({ error: 'لم يُنشأ حساب مصادقة صالح' }, { status: 500 })
    }

    // ── إنشاء ملف المستخدم في جدول users
    const userLevel = Number(level || org_level || targetOrg.level || 7)
    const profilePayload: any = {
      auth_id:            authUser.id,
      full_name,
      job_title:          job_title || null,
      phone:              phone || null,
      national_id:        national_id || null,
      email:              normalizedEmail,
      organization_id:    targetOrgId,
      org_unit_id:        targetOrgId,
      facility_id:        facility_id || null,
      financial_code:     financial_code || null,
      department:         department || targetOrg.name || null,
      level:              userLevel,
      org_level:          userLevel,
      sector_id:          targetOrg.sector_id || targetOrg.id,
      can_inspect:        can_inspect ?? true,
      direct_manager_id:  direct_manager_id || null,
      is_active:          true,
    }

    const profileQuery = existingProfile?.id
      ? supabaseAdmin.from('users').update(profilePayload).eq('id', existingProfile.id)
      : supabaseAdmin.from('users').insert(profilePayload)

    const { data: insertedProfile, error: insertError } = await profileQuery
      .select('id, full_name, job_title, org_level, sector_id, organization_id, email, is_active')
      .single()

    if (insertError) {
      console.error('[create-user] profile upsert failed', insertError)
      return NextResponse.json(
        { error: 'فشل إنشاء ملف المستخدم: ' + insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: insertedProfile,
      message: `تم إنشاء الحساب بنجاح. كلمة المرور المؤقتة: ${tempPassword} (يجب تغييرها عند أول تسجيل دخول)`,
    })
  } catch (error: any) {
    console.error('[create-user] unexpected error', error)
    return NextResponse.json({ error: error.message || 'خطأ غير متوقع' }, { status: 500 })
  }
}
