import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const DEMO_USERS = [
  {
    email: 'admin@admin.com',
    password: '123456',
    full_name: 'أحمد محمود العشري',
    job_title: 'مدير عام المتابعة والحوكمة',
    level: 1,
    department: 'ديوان عام وزارة الصحة والسكان',
    financial_code: 'FIN-100293',
  },
  {
    email: 'inspector@inspector.com',
    password: '123456',
    full_name: 'سارة خالد البشري',
    job_title: 'مفتش منشآت صحية ومكافحة عدوى',
    level: 7,
    department: 'إدارة مكافحة العدوى',
    financial_code: 'FIN-200384',
  },
  {
    email: 'supervisor@supervisor.com',
    password: '123456',
    full_name: 'محمد علي سليم',
    job_title: 'مشرف ميداني ومتابع تشغيل',
    level: 3,
    department: 'إدارة الصيدلة والمستلزمات',
    financial_code: 'FIN-300482',
  },
  {
    email: 'techadmin@mohp.gov.eg',
    password: '123456',
    full_name: 'المهندس عمرو عبد العزيز',
    job_title: 'مدير الإدارة التقنية والدعم الفني',
    level: 0,
    department: 'نظم المعلومات والتحول الرقمي',
    financial_code: 'FIN-000001',
  },
  {
    email: 'generalmanager@mohp.gov.eg',
    password: '123456',
    full_name: 'د. ميرفت أحمد الجندي',
    job_title: 'مدير عام المستشفيات العلاجية',
    level: 3,
    department: 'الإدارة العامة للمستشفيات',
    financial_code: 'FIN-300100',
  },
  {
    email: 'creator@mohp.gov.eg',
    password: '123456',
    full_name: 'د. ياسر جلال المنشاوي',
    job_title: 'موظف تكليف وتشغيل ميداني',
    level: 4,
    department: 'قسم التشغيل والتكليف',
    financial_code: 'FIN-400100',
  },
  {
    email: 'financial@mohp.gov.eg',
    password: '123456',
    full_name: 'أ. طارق عبد الحميد',
    job_title: 'مفتش ومراجع مالي وإداري',
    level: 5,
    department: 'الإدارة الشؤون المالية والإدارية',
    financial_code: 'FIN-500100',
  },
  {
    email: 'director@director.com',
    password: '123456',
    full_name: 'مدير التفتيش',
    job_title: 'مدير إدارة التفتيش',
    level: 3,
    department: 'التفتيش والمتابعة',
    financial_code: 'FIN-600100',
  },
  {
    email: 'corrections@corrections.com',
    password: '123456',
    full_name: 'مسؤول التصحيح',
    job_title: 'منسق تصحيح المخالفات',
    level: 6,
    department: 'إدارة التصحيح',
    financial_code: 'FIN-700100',
  },
]

export async function GET() {
  return handleSetup()
}

export async function POST() {
  return handleSetup()
}

async function handleSetup() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'إعدادات مفتاح الخدمة الإدارية (SUPABASE_SERVICE_ROLE_KEY) غير متوفرة في .env.local',
        },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Fetch existing auth users to prevent duplicates
    const { data: authUsersList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (listError) {
      return NextResponse.json(
        { success: false, error: `فشل جلب قائمة مستخدمي المصادقة: ${listError.message}` },
        { status: 500 }
      )
    }

    const existingAuthMap = new Map<string, any>()
    for (const u of authUsersList.users || []) {
      if (u.email) {
        existingAuthMap.set(u.email.toLowerCase(), u)
      }
    }

    const results = []

    for (const userDef of DEMO_USERS) {
      const email = userDef.email.toLowerCase()
      let authUser = existingAuthMap.get(email)

      if (authUser) {
        // Update password and metadata for existing auth user
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          password: userDef.password,
          email_confirm: true,
          user_metadata: {
            full_name: userDef.full_name,
            job_title: userDef.job_title,
          },
          app_metadata: {
            level: userDef.level,
            department: userDef.department,
          },
        })

        if (updateError) {
          results.push({ email, status: 'error_updating_auth', error: updateError.message })
          continue
        }
      } else {
        // Create new auth user
        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: userDef.password,
          email_confirm: true,
          user_metadata: {
            full_name: userDef.full_name,
            job_title: userDef.job_title,
          },
          app_metadata: {
            level: userDef.level,
            department: userDef.department,
          },
        })

        if (createError || !createData.user) {
          results.push({ email, status: 'error_creating_auth', error: createError?.message })
          continue
        }

        authUser = createData.user
      }

      // Check if profile exists in public.users by email or financial_code
      const { data: existingProfile } = await supabaseAdmin
        .from('users')
        .select('id')
        .or(`email.eq.${email},financial_code.eq.${userDef.financial_code}`)
        .maybeSingle()

      const profilePayload = {
        auth_id: authUser.id,
        email,
        full_name: userDef.full_name,
        job_title: userDef.job_title,
        level: userDef.level,
        department: userDef.department,
        financial_code: userDef.financial_code,
        is_active: true,
      }

      if (existingProfile) {
        const { error: profileError } = await supabaseAdmin
          .from('users')
          .update(profilePayload)
          .eq('id', existingProfile.id)

        if (profileError) {
          results.push({ email, auth_id: authUser.id, status: 'error_updating_profile', error: profileError.message })
        } else {
          results.push({ email, auth_id: authUser.id, status: 'synced_existing_profile' })
        }
      } else {
        const { error: profileError } = await supabaseAdmin
          .from('users')
          .insert(profilePayload)

        if (profileError) {
          results.push({ email, auth_id: authUser.id, status: 'error_inserting_profile', error: profileError.message })
        } else {
          results.push({ email, auth_id: authUser.id, status: 'created_new_profile' })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم تفعيل وتهيئة جميع الحسابات التجريبية في Supabase Auth بنجاح.',
      default_password: '123456',
      results,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'حدث خطأ غير متوقع' },
      { status: 500 }
    )
  }
}
