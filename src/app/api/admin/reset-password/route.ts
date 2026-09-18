import { NextResponse } from 'next/server'
import { checkV2ResourceAccess } from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { loadUserAuthorizationResource } from '@/server/authorization/resources/user'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('users.reset_password')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as {
      userId?: unknown
      email?: unknown
    }

    const userId = typeof body.userId === 'string' ? body.userId : ''
    if (!userId) {
      return NextResponse.json(
        { error: 'بيانات الموظف غير مكتملة' },
        { status: 400 }
      )
    }

    const target = await loadUserAuthorizationResource(userId)
    if (!target) {
      return NextResponse.json(
        { error: 'الموظف المطلوب غير موجود' },
        { status: 404 }
      )
    }

    const decision = await checkV2ResourceAccess({
      user: gate.user,
      snapshot: gate.access,
      permissionKey: 'users.reset_password',
      resource: target.resource,
    })

    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: 'لا يمكنك إعادة تعيين كلمة مرور مستخدم خارج نطاقك',
          code: 'SCOPE_DENIED',
        },
        { status: 403 }
      )
    }

    if (!target.profile.auth_id) {
      return NextResponse.json(
        { error: 'حساب المستخدم غير مرتبط بخدمة المصادقة' },
        { status: 409 }
      )
    }

    const admin = getAdminSupabaseClient()

    const { data: latestAuthData, error: latestAuthError } =
      await admin.auth.admin.getUserById(target.profile.auth_id)

    if (latestAuthError || !latestAuthData?.user) {
      console.error(
        '[reset-password] latest auth lookup failed:',
        latestAuthError?.message
      )
      return NextResponse.json(
        { error: 'تعذر تحميل أحدث بيانات حساب المصادقة' },
        { status: 500 }
      )
    }

    const latestAuthUser = latestAuthData.user
    const tempPassword = '123456'

    const { error: updateError } = await admin.auth.admin.updateUserById(
      latestAuthUser.id,
      {
        password: tempPassword,
        app_metadata: {
          ...(latestAuthUser.app_metadata || {}),
          must_change_password: true,
        },
        user_metadata: {
          ...(latestAuthUser.user_metadata || {}),
          must_change_password: true,
        },
      }
    )

    if (updateError) {
      console.error('[reset-password] auth update failed:', updateError.message)
      return NextResponse.json(
        { error: 'فشل إعادة تعيين كلمة المرور في الخادم' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `تم إعادة تعيين كلمة المرور بنجاح للمستخدم (${target.profile.email || target.profile.full_name}) وفرض تغييرها عند تسجيل الدخول التالي.`,
    })
  } catch (error) {
    console.error('[reset-password] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    )
  }
}
