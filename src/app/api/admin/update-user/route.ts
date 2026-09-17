import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ══════════════════════════════════════════════════════════════
// POST /api/admin/update-user
// تحديث بيانات وصلاحيات ومستويات الموظفين بصلاحيات الإدارة المعتمدة
// ══════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'خادم الاتصال بقاعدة البيانات غير مهيأ' }, { status: 500 })
    }

    const { data: { user: caller }, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !caller) {
      return NextResponse.json({ error: 'غير مصرح بالوصول — يرجى تسجيل الدخول' }, { status: 401 })
    }

    // التحقق من صلاحية المعدّل (المستويات 1 إلى 4 مسموح لها)
    const { data: callerProfile, error: profileError } = await supabaseServer
      .from('users')
      .select('id, level, org_level, sector_id, organization_id')
      .eq('auth_id', caller.id)
      .maybeSingle()

    if (profileError || !callerProfile) {
      return NextResponse.json({ error: 'تعذر التحقق من صلاحياتك' }, { status: 403 })
    }

    const callerLevel = Number(callerProfile.level ?? callerProfile.org_level ?? 7)
    if (callerLevel > 4) {
      return NextResponse.json(
        { error: 'غير مصرح — تعديل المستخدمين مقتصر على الإدارات القيادية (مستوى 1 إلى 4)' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      userId,
      full_name,
      job_title,
      level,
      org_level,
      department,
      organization_id,
      org_unit_id,
      facility_id,
      email,
      phone,
      financial_code,
      is_active,
    } = body

    if (!userId) {
      return NextResponse.json({ error: 'معرّف الموظف مطلوب' }, { status: 400 })
    }

    const targetOrgId = organization_id || org_unit_id || null
    const finalLevel = Number(level ?? org_level ?? 7)

    // التحقق من التدرج القيادي: لا يجوز للمشرف رفع مستخدم لمستوى أعلى من مستواه
    if (callerLevel > 1 && finalLevel < callerLevel) {
      return NextResponse.json(
        { error: 'لا يمكنك تعيين مستوى إداري أعلى من مستواك الوظيفي' },
        { status: 403 }
      )
    }

    // إعداد عميل الخدمة الإدارية (Service Role)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'مفتاح الخدمة الإدارية غير متوفر' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // جلب بيانات الموظف الحالية للتحقق
    const { data: existingUser, error: userFetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (userFetchError || !existingUser) {
      return NextResponse.json({ error: 'الموظف المطلوب غير موجود بقاعدة البيانات' }, { status: 404 })
    }

    // التحقق من نطاق القطاع للمستويات 2 إلى 4
    const callerSectorId = callerProfile.sector_id || callerProfile.organization_id
    if (callerLevel > 1 && callerSectorId) {
      const isSameSector =
        existingUser.sector_id === callerSectorId ||
        existingUser.organization_id === callerSectorId ||
        existingUser.id === callerProfile.id

      if (!isSameSector) {
        return NextResponse.json(
          { error: 'لا يمكنك تعديل موظف خارج نطاق قطاعك الإداري' },
          { status: 403 }
        )
      }
    }

    // في حال تحديد جهة تنظيمية جديدة، نتحقق منها ونجلب قطاعها واسمها
    let targetOrg: any = null
    if (targetOrgId) {
      const { data: orgData } = await supabaseAdmin
        .from('organizations')
        .select('id, name, level, sector_id')
        .eq('id', targetOrgId)
        .maybeSingle()
      targetOrg = orgData
    }

    const normalizedEmail = email ? String(email).trim().toLowerCase() : existingUser.email
    const finalDepartment = department || targetOrg?.name || existingUser.department || 'ديوان عام الوزارة'
    const finalSectorId = targetOrg?.sector_id || targetOrg?.id || existingUser.sector_id || null

    const updatePayload: Record<string, any> = {
      full_name: full_name ? String(full_name).trim() : existingUser.full_name,
      job_title: job_title !== undefined ? (job_title ? String(job_title).trim() : null) : existingUser.job_title,
      level: finalLevel,
      org_level: finalLevel, // الحفاظ على اتساق الحقلين معاً بشكل متزامن
      department: finalDepartment,
      organization_id: targetOrgId || existingUser.organization_id,
      org_unit_id: targetOrgId || existingUser.org_unit_id,
      sector_id: finalSectorId,
      facility_id: facility_id !== undefined ? (facility_id || null) : existingUser.facility_id,
      email: normalizedEmail,
      phone: phone !== undefined ? (phone ? String(phone).trim() : null) : existingUser.phone,
      financial_code: financial_code !== undefined ? (financial_code ? String(financial_code).trim() : null) : existingUser.financial_code,
      is_active: is_active !== undefined ? Boolean(is_active) : existingUser.is_active,
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('id, full_name, job_title, level, org_level, department, is_active, email, phone, facility_id, financial_code, organization_id, org_unit_id, sector_id, created_at')
      .single()

    if (updateError) {
      console.error('[update-user] database update failed:', updateError)
      return NextResponse.json(
        { error: 'فشل تحديث بيانات الموظف: ' + updateError.message },
        { status: 500 }
      )
    }

    // تحديث حساب المصادقة في Supabase Auth إذا كان للموظف auth_id
    if (existingUser.auth_id) {
      try {
        const authUpdates: Record<string, any> = {
          user_metadata: {
            full_name: updatePayload.full_name,
            job_title: updatePayload.job_title,
            level: finalLevel,
            org_level: finalLevel,
          }
        }
        if (normalizedEmail && normalizedEmail !== existingUser.email) {
          authUpdates.email = normalizedEmail
        }
        await supabaseAdmin.auth.admin.updateUserById(existingUser.auth_id, authUpdates)
      } catch (authErr) {
        console.warn('[update-user] auth metadata update warning:', authErr)
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedProfile,
      message: 'تم تحديث بيانات ومستوى وصلاحيات الموظف بنجاح.',
    })
  } catch (error: any) {
    console.error('[update-user] unexpected error:', error)
    return NextResponse.json({ error: error.message || 'خطأ غير متوقع أثناء التحديث' }, { status: 500 })
  }
}
