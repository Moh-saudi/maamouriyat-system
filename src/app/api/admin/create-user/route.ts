import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type AuthAdminUser = {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
}

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'خادم الاتصال بقاعدة البيانات غير مهيأ' }, { status: 500 })
    }

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseServer.auth.getUser()

    if (authError || !caller) {
      return NextResponse.json({ error: 'غير مصرح بالوصول - يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabaseServer
      .from('users')
      .select('level')
      .eq('auth_id', caller.id)
      .maybeSingle()

    if (profileError || !profile || profile.level > 1) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول - هذه الصلاحية للمدير التقني والسوبر أدمن فقط' },
        { status: 403 }
      )
    }

    const { email, full_name, job_title, level, department, phone, financial_code, facility_id, org_unit_id } = await request.json()
    console.log('[create-user] Request body:', { email, full_name, job_title, level, department, phone, financial_code, facility_id, org_unit_id })
    if (!email || !full_name) {
      return NextResponse.json({ error: 'البريد الإلكتروني والاسم الكامل مطلوبان' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'إعدادات مفتاح الخدمة الإدارية (Service Role) غير متوفرة على المخدم' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const normalizedEmail = String(email).trim().toLowerCase()
    const tempPassword = '123456'
    const normalizedFacilityId =
      typeof facility_id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(facility_id)
        ? facility_id
        : null

    const normalizedOrgUnitId =
      typeof org_unit_id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(org_unit_id)
        ? org_unit_id
        : null

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('users')
      .select('id, auth_id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingProfileError) {
      return NextResponse.json(
        { error: 'فشل التحقق من ملف الموظف الحالي: ' + existingProfileError.message },
        { status: 500 }
      )
    }

    if (existingProfile?.auth_id) {
      return NextResponse.json(
        { error: 'هذا البريد الإلكتروني مسجل بالفعل لموظف موجود داخل المنظومة.' },
        { status: 409 }
      )
    }

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
      app_metadata: {
        level,
        department: department || null,
      },
    })

    if (createError) {
      console.error('[create-user] auth admin createUser failed', {
        email: normalizedEmail,
        message: createError.message,
        name: createError.name,
        status: createError.status,
      })

      const createUserErrorMessage = createError.message || ''
      if (
        createUserErrorMessage.includes('already been registered') ||
        createUserErrorMessage.includes('already registered')
      ) {
        const { data: authUserList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })

        if (listError) {
          return NextResponse.json(
            { error: 'فشل البحث عن حساب المصادقة الموجود: ' + listError.message },
            { status: 500 }
          )
        }

        authUser =
          authUserList.users.find((user) => user.email?.toLowerCase() === normalizedEmail) || null

        if (!authUser) {
          return NextResponse.json(
            { error: 'البريد الإلكتروني مسجل في المصادقة لكن تعذر العثور على الحساب الحالي.' },
            { status: 500 }
          )
        }

        const { error: updateExistingAuthError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            ...authUser.user_metadata,
            full_name,
            job_title: job_title || null,
            must_change_password: true,
          },
          app_metadata: {
            ...authUser.app_metadata,
            level,
            department: department || null,
          },
        })

        if (updateExistingAuthError) {
          return NextResponse.json(
            { error: 'فشل تحديث حساب المصادقة الموجود: ' + updateExistingAuthError.message },
            { status: 500 }
          )
        }
      } else if (
        createUserErrorMessage.includes('no unique or exclusion constraint') ||
        createUserErrorMessage.includes('Database error saving new user')
      ) {
        return NextResponse.json(
          {
            error:
              'تعذر إنشاء حساب المصادقة لأن قاعدة البيانات الحية تحتاج تحديث trigger المستخدمين. شغّل SQL إصلاح users_auth_id_key و handle_new_auth_user في Supabase SQL Editor ثم أعد المحاولة.',
          },
          { status: 500 }
        )
      } else {
        return NextResponse.json(
          { error: 'فشل إنشاء الحساب في المصادقة: ' + createError.message },
          { status: 500 }
        )
      }
    } else {
      authUser = authData.user
    }

    if (!authUser) {
      return NextResponse.json({ error: 'لم يتم إنشاء حساب مصادقة صالح' }, { status: 500 })
    }

    const profilePayload = {
      auth_id: authUser.id,
      full_name,
      job_title: job_title || null,
      level,
      department: department || null,
      phone: phone || null,
      financial_code: financial_code || null,
      facility_id: normalizedFacilityId,
      org_unit_id: normalizedOrgUnitId,
      email: normalizedEmail,
      is_active: true,
    }

    const profileQuery = existingProfile?.id
      ? supabaseAdmin
          .from('users')
          .update(profilePayload)
          .eq('id', existingProfile.id)
      : supabaseAdmin
          .from('users')
          .insert(profilePayload)

    const { data: insertedProfile, error: insertProfileError } = await profileQuery
      .select('id, full_name, job_title, level, department, is_active, email, phone, facility_id, financial_code, org_unit_id')
      .single()

    if (insertProfileError) {
      console.error('[create-user] profile upsert failed', {
        email: normalizedEmail,
        message: insertProfileError.message,
        code: insertProfileError.code,
        details: insertProfileError.details,
        hint: insertProfileError.hint,
      })
      return NextResponse.json(
        { error: 'فشل إنشاء ملف الموظف: ' + insertProfileError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: insertedProfile })
  } catch (error: any) {
    console.error('[create-user] unexpected failure', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    })
    return NextResponse.json({ error: error.message || 'حدث خطأ غير متوقع' }, { status: 500 })
  }
}
