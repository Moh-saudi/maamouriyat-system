import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    // 1. Build the admin client (Service Role)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'إعدادات مفتاح الخدمة الإدارية غير متوفرة على المخدم' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 2. Identify the caller via the Bearer token sent from the browser client
    const authHeader = request.headers.get('authorization') || ''
    const accessToken = authHeader.replace('Bearer ', '').trim()

    if (!accessToken) {
      return NextResponse.json(
        { error: 'لم يتم إرسال رمز الدخول — يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !user) {
      return NextResponse.json(
        { error: 'رمز الدخول غير صالح أو منتهي الصلاحية — يرجى تسجيل الدخول مجدداً' },
        { status: 401 }
      )
    }

    // 3. Parse and validate the new password
    const { newPassword } = await request.json()

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'كلمة المرور الجديدة مطلوبة' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل' },
        { status: 400 }
      )
    }
    if (newPassword === '123456') {
      return NextResponse.json(
        { error: 'يجب اختيار كلمة مرور مختلفة عن الكلمة الافتراضية' },
        { status: 400 }
      )
    }

    // 4. Update password and clear the must_change_password flag
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
      user_metadata: {
        ...user.user_metadata,
        must_change_password: false
      }
    })

    if (updateError) {
      return NextResponse.json(
        { error: 'فشل تحديث كلمة المرور: ' + updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'حدث خطأ غير متوقع' }, { status: 500 })
  }
}

