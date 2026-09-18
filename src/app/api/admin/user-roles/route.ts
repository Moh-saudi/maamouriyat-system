import { NextResponse } from 'next/server'
import { checkV2ResourceAccess } from '@/server/authorization'
import { canDelegateV2RoleGrants } from '@/server/authorization/delegation'
import { requireV2Permission } from '@/server/authorization/http-guard'
import {
  isOrganizationWithinTree,
  loadV2OrganizationFacts,
} from '@/server/authorization/organization-scope-repository'
import { loadUserAuthorizationResource } from '@/server/authorization/resources/user'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type { V2AuthorizationSnapshot } from '@/server/authorization/types'

type RoleRow = {
  id: string
  code: string
  name_ar: string
  description_ar: string | null
  owner_organization_id: string | null
  is_system: boolean
  is_active: boolean
  priority: number
}

type GrantRow = {
  role_id: string
  permission_key: string
  scope_type: string
}

function callerRoleCodes(
  access: V2AuthorizationSnapshot
): Set<string> {
  return new Set(access.roles.map((role) => role.roleCode))
}

async function loadOrganizationResource(organizationId: string) {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('organizations')
    .select('id, level, sector_id, governorate')
    .eq('id', organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load assignment organization: ${error.message}`)
  }

  if (!data) return null

  return {
    organizationId: String(data.id),
    sectorId:
      Number(data.level) === 2
        ? String(data.id)
        : data.sector_id
          ? String(data.sector_id)
          : null,
    governorate:
      typeof data.governorate === 'string' ? data.governorate : null,
  }
}

export async function GET(request: Request) {
  try {
    const gate = await requireV2Permission('users.assign_role')
    if (!gate.ok) return gate.response

    const userId = new URL(request.url).searchParams.get('user_id')
    if (!userId) {
      return NextResponse.json(
        { error: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    const target = await loadUserAuthorizationResource(userId)
    if (!target) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    const decision = await checkV2ResourceAccess({
      user: gate.user,
      snapshot: gate.access,
      permissionKey: 'users.assign_role',
      resource: target.resource,
    })

    if (!decision.allowed) {
      return NextResponse.json(
        { error: 'لا يمكنك إدارة أدوار مستخدم خارج نطاقك', code: 'SCOPE_DENIED' },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()

    const [{ data: roleRows, error: rolesError }, { data: assignments, error: assignmentsError }] =
      await Promise.all([
        admin
          .from('roles')
          .select('id, code, name_ar, description_ar, owner_organization_id, is_system, is_active, priority')
          .eq('is_active', true)
          .order('priority'),
        admin
          .from('user_roles')
          .select('id, role_id, assignment_org_id, is_active, valid_from, valid_until, assigned_by')
          .eq('user_id', userId)
          .order('created_at'),
      ])

    if (rolesError || assignmentsError) {
      console.error(
        '[user-roles:GET] query failed:',
        rolesError?.message || assignmentsError?.message
      )
      return NextResponse.json(
        { error: 'تعذر تحميل الأدوار' },
        { status: 500 }
      )
    }

    const callerRoles = callerRoleCodes(gate.access)
    const roles = ((roleRows ?? []) as RoleRow[]).filter((role) => {
      if (role.code === 'system_techadmin') {
        return callerRoles.has('system_techadmin')
      }
      return true
    })

    return NextResponse.json({
      user: {
        id: target.profile.id,
        full_name: target.profile.full_name,
        organization_id: target.profile.organization_id,
        org_level: target.profile.org_level ?? target.profile.level,
      },
      roles,
      assignments: assignments ?? [],
    })
  } catch (error) {
    console.error('[user-roles:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('users.assign_role')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const userId = typeof body.user_id === 'string' ? body.user_id : ''
    const roleId = typeof body.role_id === 'string' ? body.role_id : ''

    if (!userId || !roleId) {
      return NextResponse.json(
        { error: 'المستخدم والدور مطلوبان' },
        { status: 400 }
      )
    }

    const target = await loadUserAuthorizationResource(userId)
    if (!target) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    const targetDecision = await checkV2ResourceAccess({
      user: gate.user,
      snapshot: gate.access,
      permissionKey: 'users.assign_role',
      resource: target.resource,
    })

    if (!targetDecision.allowed) {
      return NextResponse.json(
        { error: 'لا يمكنك إدارة أدوار مستخدم خارج نطاقك', code: 'SCOPE_DENIED' },
        { status: 403 }
      )
    }

    const admin = getAdminSupabaseClient()
    const { data: roleData, error: roleError } = await admin
      .from('roles')
      .select('id, code, name_ar, description_ar, owner_organization_id, is_system, is_active, priority')
      .eq('id', roleId)
      .maybeSingle()

    if (roleError || !roleData || roleData.is_active !== true) {
      return NextResponse.json(
        { error: 'الدور غير موجود أو غير نشط' },
        { status: 400 }
      )
    }

    const role = roleData as RoleRow
    const callerRoles = callerRoleCodes(gate.access)

    if (
      role.code === 'system_techadmin' &&
      !callerRoles.has('system_techadmin')
    ) {
      return NextResponse.json(
        { error: 'إسناد دور المدير التقني يتطلب مديرًا تقنيًا حاليًا' },
        { status: 403 }
      )
    }

    const { data: grants, error: grantsError } = await admin
      .from('role_permission_grants')
      .select('role_id, permission_key, scope_type')
      .eq('role_id', role.id)

    if (grantsError) {
      return NextResponse.json(
        { error: 'تعذر التحقق من صلاحيات الدور' },
        { status: 500 }
      )
    }

    const grantRows = (grants ?? []) as GrantRow[]
    if (grantRows.length === 0) {
      return NextResponse.json(
        { error: 'لا يمكن إسناد دور بدون صلاحيات معرفة' },
        { status: 409 }
      )
    }

    if (
      !canDelegateV2RoleGrants({
        snapshot: gate.access,
        grants: grantRows.map((grant) => ({
          permissionKey: grant.permission_key,
          scopeType: grant.scope_type as import('@/server/authorization/types').V2ScopeType,
        })),
      })
    ) {
      return NextResponse.json(
        {
          error: 'لا يمكنك إسناد دور يحتوي صلاحيات أو نطاقات أوسع من صلاحياتك',
          code: 'PRIVILEGE_ESCALATION_BLOCKED',
        },
        { status: 403 }
      )
    }

    if (
      !role.is_system &&
      role.owner_organization_id &&
      target.profile.organization_id
    ) {
      try {
        const facts = await loadV2OrganizationFacts([
          role.owner_organization_id,
          target.profile.organization_id,
        ])

        const insideOwnerTree = isOrganizationWithinTree({
          resourceOrganizationId: target.profile.organization_id,
          anchorOrganizationId: role.owner_organization_id,
          facts,
        })

        if (!insideOwnerTree) {
          return NextResponse.json(
            {
              error: 'المستخدم المستهدف خارج نطاق الجهة المالكة للدور المخصص',
              code: 'ROLE_OWNER_SCOPE_DENIED',
            },
            { status: 403 }
          )
        }
      } catch (scopeError) {
        console.error('[user-roles:POST] custom role owner scope failed:', scopeError)
        return NextResponse.json(
          { error: 'تعذر التحقق من نطاق الدور المخصص' },
          { status: 500 }
        )
      }
    }

    const allNational = grantRows.every(
      (grant) => grant.scope_type === 'national'
    )

    let assignmentOrganizationId: string | null = null

    if (!allNational) {
      assignmentOrganizationId =
        typeof body.assignment_org_id === 'string'
          ? body.assignment_org_id
          : target.profile.organization_id

      if (!assignmentOrganizationId) {
        return NextResponse.json(
          { error: 'الدور المقيد يحتاج جهة إسناد واضحة' },
          { status: 400 }
        )
      }

      if (
        target.profile.organization_id &&
        assignmentOrganizationId !== target.profile.organization_id
      ) {
        return NextResponse.json(
          {
            error:
              'في المرحلة الحالية يجب أن تطابق جهة إسناد الدور الجهة الأساسية للمستخدم',
          },
          { status: 400 }
        )
      }

      const organizationResource =
        await loadOrganizationResource(assignmentOrganizationId)

      if (!organizationResource) {
        return NextResponse.json(
          { error: 'جهة إسناد الدور غير موجودة' },
          { status: 400 }
        )
      }

      const organizationDecision = await checkV2ResourceAccess({
        user: gate.user,
        snapshot: gate.access,
        permissionKey: 'users.assign_role',
        resource: organizationResource,
      })

      if (!organizationDecision.allowed) {
        return NextResponse.json(
          { error: 'جهة إسناد الدور خارج نطاقك', code: 'SCOPE_DENIED' },
          { status: 403 }
        )
      }
    }

    const validUntil =
      typeof body.valid_until === 'string' && body.valid_until
        ? body.valid_until
        : null

    if (validUntil && Number.isNaN(Date.parse(validUntil))) {
      return NextResponse.json(
        { error: 'تاريخ انتهاء الدور غير صحيح' },
        { status: 400 }
      )
    }

    if (validUntil && new Date(validUntil).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'تاريخ انتهاء الدور يجب أن يكون في المستقبل' },
        { status: 400 }
      )
    }

    const { data: assignmentId, error: assignError } = await admin.rpc(
      'assign_v2_user_role',
      {
        p_actor_user_id: gate.user.profileId,
        p_target_user_id: target.profile.id,
        p_role_id: role.id,
        p_assignment_org_id: assignmentOrganizationId,
        p_valid_until: validUntil,
      }
    )

    if (assignError) {
      console.error('[user-roles:POST] assignment failed:', assignError.message)
      return NextResponse.json(
        { error: 'تعذر إسناد الدور' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      assignment_id: assignmentId,
      role: {
        id: role.id,
        code: role.code,
        name_ar: role.name_ar,
      },
    })
  } catch (error) {
    console.error('[user-roles:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء إسناد الدور' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const gate = await requireV2Permission('users.assign_role')
    if (!gate.ok) return gate.response

    const assignmentId =
      new URL(request.url).searchParams.get('assignment_id')

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'معرف إسناد الدور مطلوب' },
        { status: 400 }
      )
    }

    const admin = getAdminSupabaseClient()
    const { data: assignment, error } = await admin
      .from('user_roles')
      .select('id, user_id, role_id, assignment_org_id, is_active')
      .eq('id', assignmentId)
      .maybeSingle()

    if (error || !assignment || assignment.is_active !== true) {
      return NextResponse.json(
        { error: 'إسناد الدور غير موجود أو غير نشط' },
        { status: 404 }
      )
    }

    const target = await loadUserAuthorizationResource(String(assignment.user_id))
    if (!target) {
      return NextResponse.json(
        { error: 'المستخدم المستهدف غير موجود' },
        { status: 404 }
      )
    }

    const decision = await checkV2ResourceAccess({
      user: gate.user,
      snapshot: gate.access,
      permissionKey: 'users.assign_role',
      resource: target.resource,
    })

    if (!decision.allowed) {
      return NextResponse.json(
        { error: 'لا يمكنك إدارة أدوار مستخدم خارج نطاقك', code: 'SCOPE_DENIED' },
        { status: 403 }
      )
    }

    const { data: role } = await admin
      .from('roles')
      .select('code')
      .eq('id', assignment.role_id)
      .maybeSingle()

    const callerRoles = callerRoleCodes(gate.access)

    if (
      role?.code === 'system_techadmin' &&
      !callerRoles.has('system_techadmin')
    ) {
      return NextResponse.json(
        { error: 'إلغاء دور المدير التقني يتطلب مديرًا تقنيًا حاليًا' },
        { status: 403 }
      )
    }

    if (target.profile.id === gate.user.profileId) {
      const { count } = await admin
        .from('user_roles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', gate.user.profileId)
        .eq('is_active', true)

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: 'لا يمكنك إزالة آخر دور نشط من حسابك' },
          { status: 409 }
        )
      }
    }

    const { error: revokeError } = await admin.rpc('revoke_v2_user_role', {
      p_actor_user_id: gate.user.profileId,
      p_assignment_id: assignmentId,
    })

    if (revokeError) {
      console.error('[user-roles:DELETE] revoke failed:', revokeError.message)
      return NextResponse.json(
        { error: 'تعذر إلغاء إسناد الدور' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[user-roles:DELETE] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء إلغاء الدور' },
      { status: 500 }
    )
  }
}
