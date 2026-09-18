import { NextResponse } from 'next/server'
import { checkV2ResourceAccess } from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

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
    const gate = await requireV2Permission('users.create')
    if (!gate.ok) return gate.response

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
    const { data: targetOrg } = await getAdminSupabaseClient()
      .from('organizations')
      .select('id, level, sector_id, governorate, name')
      .eq('id', targetOrgId)
      .maybeSingle()

    if (!targetOrg) {
      return NextResponse.json({ error: 'الجهة التنظيمية المحددة غير موجودة' }, { status: 400 })
    }

    const targetSectorId =
      targetOrg.level === 2 ? targetOrg.id : targetOrg.sector_id

    const scopeDecision = await checkV2ResourceAccess({
      user: gate.user,
      snapshot: gate.access,
      permissionKey: 'users.create',
      resource: {
        organizationId: targetOrg.id,
        sectorId: targetSectorId,
        governorate: targetOrg.governorate ?? null,
      },
    })

    if (!scopeDecision.allowed) {
      return NextResponse.json(
        { error: 'لا يمكنك إنشاء مستخدمين خارج نطاقك الإداري', code: 'SCOPE_DENIED' },
        { status: 403 }
      )
    }

    const userLevel = Number(level || org_level || targetOrg.level || 7)

    if (!Number.isInteger(userLevel) || userLevel < 1 || userLevel > 7) {
      return NextResponse.json(
        { error: 'المستوى التنظيمي للمستخدم غير صحيح' },
        { status: 400 }
      )
    }

    if (userLevel < gate.user.orgLevel) {
      return NextResponse.json(
        { error: 'لا يمكنك إنشاء مستخدم بمستوى إداري أعلى من مستواك' },
        { status: 403 }
      )
    }

    if (userLevel < targetOrg.level) {
      return NextResponse.json(
        { error: 'مستوى المستخدم لا يمكن أن يكون أعلى من مستوى الجهة التابع لها' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getAdminSupabaseClient()

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
      app_metadata: {
        must_change_password: true,
      },
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
          app_metadata: { ...(authUser.app_metadata || {}), must_change_password: true },
          user_metadata: { ...(authUser.user_metadata || {}), full_name, must_change_password: true },
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
      sector_id:          targetSectorId,
      can_inspect:        can_inspect ?? true,
      direct_manager_id:  direct_manager_id || null,
      is_active:          true,
    }

    const profileQuery = existingProfile?.id
      ? supabaseAdmin.from('users').update(profilePayload).eq('id', existingProfile.id)
      : supabaseAdmin.from('users').insert(profilePayload)

    const { data: insertedProfile, error: insertError } = await profileQuery
      .select('id, full_name, job_title, level, org_level, department, is_active, email, phone, facility_id, financial_code, organization_id, org_unit_id, sector_id, created_at')
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
      requires_role_assignment: true,
      message: 'تم إنشاء الحساب بنجاح. يجب تغيير كلمة المرور المؤقتة عند أول تسجيل دخول، ويلزم إسناد دور V2 للمستخدم قبل منحه صلاحيات النظام الجديد.',
    })
  } catch (error) {
    console.error('[create-user] unexpected error', error)
    return NextResponse.json({ error: 'خطأ غير متوقع' }, { status: 500 })
  }
}
