import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerSupabaseClient()
    if (!supabaseServer) {
      return NextResponse.json({ error: 'خادم الاتصال بقاعدة البيانات غير مهيأ' }, { status: 500 })
    }

    // 1. Verify caller permissions
    const { data: { user: caller }, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !caller) {
      return NextResponse.json({ error: 'غير مصرح بالوصول - يرجى تسجيل الدخول أولاً' }, { status: 401 })
    }

    // Get the caller's profile to verify level <= 1 (techadmin/superadmin)
    const { data: profile, error: profileError } = await supabaseServer
      .from('users')
      .select('level')
      .eq('auth_id', caller.id)
      .maybeSingle()

    if (profileError || !profile || profile.level > 1) {
      return NextResponse.json({ error: 'غير مصرح بالوصول - هذه الصلاحية للمدير التقني والسوبر أدمن فقط' }, { status: 403 })
    }

    // 2. Parse request body
    const { userId, email } = await request.json()
    if (!userId || !email) {
      return NextResponse.json({ error: 'بيانات الموظف غير مكتملة' }, { status: 400 })
    }

    // 3. Create service client to bypass RLS and perform admin auth changes
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'إعدادات مفتاح الخدمة الإدارية (Service Role) غير متوفرة على المخدم' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Find the auth user by email
    const { data: authUserList, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      return NextResponse.json({ error: 'فشل استرجاع حسابات الخدمة: ' + listError.message }, { status: 500 })
    }

    const targetAuthUser = authUserList.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!targetAuthUser) {
      return NextResponse.json({ error: 'حساب المستخدم غير موجود في سجلات الهوية والمصادقة' }, { status: 404 })
    }

    const tempPassword = '123456'

    // 4. Update password and force password change flag in metadata
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetAuthUser.id,
      {
        password: tempPassword,
        user_metadata: {
          ...targetAuthUser.user_metadata,
          must_change_password: true
        }
      }
    )

    if (updateError) {
      return NextResponse.json({ error: 'فشل إعادة تعيين كلمة المرور في الخادم: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `تم إعادة تعيين كلمة المرور بنجاح للمستخدم (${email}) إلى "123456" وفرض تعيين كلمة مرور جديدة قوية عند تسجيل الدخول التالي.` 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'حدث خطأ غير متوقع' }, { status: 500 })
  }
}
