import { NextResponse } from 'next/server'
import {
  checkV2ResourceAccess,
  hasV2Permission,
} from '@/server/authorization'
import { requireV2Permission } from '@/server/authorization/http-guard'
import { loadUserAuthorizationResource } from '@/server/authorization/resources/user'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type OrganizationRow = {
  id: string
  name: string
  level: number
  sector_id: string | null
  governorate: string | null
}

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('users.edit')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const userId = typeof body.userId === 'string' ? body.userId : ''

    if (!userId) {
      return NextResponse.json(
        { error: 'معرّف الموظف مطلوب' },
        { status: 400 }
      )
    }

    const target = await loadUserAuthorizationResource(userId)
    if (!target) {
      return NextResponse.json(
        { error: 'الموظف المطلوب غير موجود بقاعدة البيانات' },
        { status: 404 }
      )
    }

    const editDecision = await checkV2ResourceAccess({
      user: gate.user,
      snapshot: gate.access,
      permissionKey: 'users.edit',
      resource: target.resource,
    })

    if (!editDecision.allowed) {
      return NextResponse.json(
        {
          error: 'لا يمكنك تعديل موظف خارج نطاقك الإداري',
          code: 'SCOPE_DENIED',
        },
        { status: 403 }
      )
    }

    const current = target.profile
    const admin = getAdminSupabaseClient()

    const requestedOrgId =
      typeof body.organization_id === 'string'
        ? body.organization_id
        : typeof body.org_unit_id === 'string'
          ? body.org_unit_id
          : current.organization_id

    let targetOrg: OrganizationRow | null = null

    if (requestedOrgId) {
      const { data: orgData, error: orgError } = await admin
        .from('organizations')
        .select('id, name, level, sector_id, governorate')
        .eq('id', requestedOrgId)
        .maybeSingle()

      if (orgError || !orgData) {
        return NextResponse.json(
          { error: 'الجهة التنظيمية المحددة غير موجودة' },
          { status: 400 }
        )
      }

      targetOrg = orgData as OrganizationRow

      const destinationDecision = await checkV2ResourceAccess({
        user: gate.user,
        snapshot: gate.access,
        permissionKey: 'users.edit',
        resource: {
          organizationId: targetOrg.id,
          sectorId:
            targetOrg.level === 2 ? targetOrg.id : targetOrg.sector_id,
          governorate: targetOrg.governorate,
        },
      })

      if (!destinationDecision.allowed) {
        return NextResponse.json(
          {
            error: 'لا يمكنك نقل الموظف إلى جهة خارج نطاقك الإداري',
            code: 'DESTINATION_SCOPE_DENIED',
          },
          { status: 403 }
        )
      }
    }

    const currentLevel = Number(current.org_level ?? current.level ?? 7)
    const requestedLevelRaw = body.level ?? body.org_level
    const finalLevel =
      requestedLevelRaw === undefined
        ? currentLevel
        : Number(requestedLevelRaw)

    if (
      !Number.isInteger(finalLevel) ||
      finalLevel < 1 ||
      finalLevel > 7
    ) {
      return NextResponse.json(
        { error: 'المستوى التنظيمي للمستخدم غير صحيح' },
        { status: 400 }
      )
    }

    if (finalLevel < gate.user.orgLevel) {
      return NextResponse.json(
        { error: 'لا يمكنك تعيين مستوى إداري أعلى من مستواك الوظيفي' },
        { status: 403 }
      )
    }

    if (targetOrg && finalLevel < targetOrg.level) {
      return NextResponse.json(
        { error: 'مستوى المستخدم لا يمكن أن يكون أعلى من مستوى الجهة التابع لها' },
        { status: 400 }
      )
    }

    const requestedActive =
      typeof body.is_active === 'boolean'
        ? body.is_active
        : current.is_active

    if (
      typeof body.is_active === 'boolean' &&
      body.is_active !== current.is_active
    ) {
      if (!hasV2Permission(gate.access, 'users.deactivate')) {
        return NextResponse.json(
          {
            error: 'ليس لديك صلاحية تغيير حالة تنشيط الحساب',
            code: 'DEACTIVATE_PERMISSION_DENIED',
          },
          { status: 403 }
        )
      }

      const deactivateDecision = await checkV2ResourceAccess({
        user: gate.user,
        snapshot: gate.access,
        permissionKey: 'users.deactivate',
        resource: target.resource,
      })

      if (!deactivateDecision.allowed) {
        return NextResponse.json(
          {
            error: 'لا يمكنك تغيير حالة مستخدم خارج نطاقك الإداري',
            code: 'DEACTIVATE_SCOPE_DENIED',
          },
          { status: 403 }
        )
      }
    }

    const normalizedEmail =
      typeof body.email === 'string' && body.email.trim()
        ? body.email.trim().toLowerCase()
        : current.email

    const resolvedSectorId = targetOrg
      ? targetOrg.level === 2
        ? targetOrg.id
        : targetOrg.sector_id
      : current.sector_id

    const updatePayload: Record<string, unknown> = {
      full_name:
        typeof body.full_name === 'string' && body.full_name.trim()
          ? body.full_name.trim()
          : current.full_name,
      job_title:
        body.job_title !== undefined
          ? typeof body.job_title === 'string' && body.job_title.trim()
            ? body.job_title.trim()
            : null
          : current.job_title,
      level: finalLevel,
      org_level: finalLevel,
      department:
        typeof body.department === 'string' && body.department.trim()
          ? body.department.trim()
          : targetOrg?.name ?? current.department ?? 'ديوان عام الوزارة',
      organization_id: requestedOrgId,
      org_unit_id: requestedOrgId,
      sector_id: resolvedSectorId,
      facility_id:
        body.facility_id !== undefined
          ? typeof body.facility_id === 'string' && body.facility_id
            ? body.facility_id
            : null
          : current.facility_id,
      email: normalizedEmail,
      phone:
        body.phone !== undefined
          ? typeof body.phone === 'string' && body.phone.trim()
            ? body.phone.trim()
            : null
          : current.phone,
      financial_code:
        body.financial_code !== undefined
          ? typeof body.financial_code === 'string' &&
            body.financial_code.trim()
            ? body.financial_code.trim()
            : null
          : current.financial_code,
      is_active: requestedActive,
    }

    const { data: updatedProfile, error: updateError } = await admin
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select(
        'id, full_name, job_title, level, org_level, department, is_active, email, phone, facility_id, financial_code, organization_id, org_unit_id, sector_id, created_at'
      )
      .single()

    if (updateError) {
      console.error('[update-user] database update failed:', updateError.message)
      return NextResponse.json(
        { error: 'فشل تحديث بيانات الموظف' },
        { status: 500 }
      )
    }

    let authSyncWarning: string | null = null

    if (current.auth_id) {
      const { data: latestAuthData, error: latestAuthError } =
        await admin.auth.admin.getUserById(current.auth_id)

      if (latestAuthError || !latestAuthData?.user) {
        authSyncWarning = 'تعذر تحميل أحدث بيانات حساب المصادقة'
      } else {
        const latestAuthUser = latestAuthData.user
        const authUpdate: {
          email?: string
          user_metadata: Record<string, unknown>
        } = {
          user_metadata: {
            ...(latestAuthUser.user_metadata || {}),
            full_name: updatePayload.full_name,
            job_title: updatePayload.job_title,
            level: finalLevel,
            org_level: finalLevel,
          },
        }

        if (
          normalizedEmail &&
          normalizedEmail !== latestAuthUser.email
        ) {
          authUpdate.email = normalizedEmail
        }

        const { error: authUpdateError } =
          await admin.auth.admin.updateUserById(current.auth_id, authUpdate)

        if (authUpdateError) {
          console.error(
            '[update-user] auth metadata update failed:',
            authUpdateError.message
          )
          authSyncWarning =
            'تم تحديث ملف الموظف ولكن تعذر مزامنة بعض بيانات حساب المصادقة'
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedProfile,
      auth_sync_warning: authSyncWarning,
      role_assignment_unchanged: true,
      message:
        'تم تحديث بيانات الموظف. تغيير المستوى أو الجهة لا يغيّر أدوار V2 تلقائيًا.',
    })
  } catch (error) {
    console.error('[update-user] unexpected error:', error)
    return NextResponse.json(
      { error: 'خطأ غير متوقع أثناء التحديث' },
      { status: 500 }
    )
  }
}
