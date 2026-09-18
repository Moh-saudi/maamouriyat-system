import { NextResponse } from 'next/server'
import {
  checkV2ResourceAccess,
  evaluateV2ResourceScope,
} from '@/server/authorization'
import { canDelegateV2RoleGrants } from '@/server/authorization/delegation'
import { requireV2Permission } from '@/server/authorization/http-guard'
import {
  V2_SCOPE_TYPES,
  type V2AuthorizationSnapshot,
  type V2ScopeType,
} from '@/server/authorization/types'
import type { V2AuthenticatedUser } from '@/server/auth/types'
import type { V2OrganizationFact } from '@/server/authorization/scope-types'
import { getAdminSupabaseClient } from '@/server/supabase/admin'

type RoleRow = {
  id: string
  code: string
  name_ar: string
  description_ar: string | null
  owner_organization_id: string | null
  is_system: boolean
  is_active: boolean
  priority: number
  created_by: string | null
  created_at: string
  updated_at: string
}

type GrantInput = {
  permissionKey: string
  scopeType: V2ScopeType
}

function isScopeType(value: unknown): value is V2ScopeType {
  return (
    typeof value === 'string' &&
    (V2_SCOPE_TYPES as readonly string[]).includes(value)
  )
}

function hasNationalManageRoleScope(
  access: V2AuthorizationSnapshot
): boolean {
  const permission = access.permissions['settings.manage_roles']
  return (
    permission?.granted === true &&
    permission.sources.some((source) => source.scopeType === 'national')
  )
}

async function authorizeRoleOwner(input: {
  ownerOrganizationId: string | null
  user: V2AuthenticatedUser
  access: V2AuthorizationSnapshot
}): Promise<boolean> {
  if (!input.ownerOrganizationId) {
    return hasNationalManageRoleScope(input.access)
  }

  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('organizations')
    .select('id, level, sector_id, governorate')
    .eq('id', input.ownerOrganizationId)
    .maybeSingle()

  if (error || !data) return false

  const decision = await checkV2ResourceAccess({
    user: input.user,
    snapshot: input.access,
    permissionKey: 'settings.manage_roles',
    resource: {
      organizationId: String(data.id),
      sectorId:
        Number(data.level) === 2
          ? String(data.id)
          : data.sector_id
            ? String(data.sector_id)
            : null,
      governorate:
        typeof data.governorate === 'string' ? data.governorate : null,
    },
  })

  return decision.allowed
}

function normalizeGrants(value: unknown): GrantInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    return null
  }

  const grants: GrantInput[] = []
  const seen = new Set<string>()

  for (const item of value) {
    if (!item || typeof item !== 'object') return null

    const permissionKey =
      'permission_key' in item && typeof item.permission_key === 'string'
        ? item.permission_key
        : ''
    const scopeType =
      'scope_type' in item && isScopeType(item.scope_type)
        ? item.scope_type
        : null

    if (!permissionKey || !scopeType || seen.has(permissionKey)) {
      return null
    }

    seen.add(permissionKey)
    grants.push({ permissionKey, scopeType })
  }

  return grants
}

export async function GET() {
  try {
    const gate = await requireV2Permission('settings.view')
    if (!gate.ok) return gate.response

    const admin = getAdminSupabaseClient()

    const [
      { data: roles, error: rolesError },
      { data: grants, error: grantsError },
      { data: permissions, error: permissionsError },
    ] = await Promise.all([
      admin
        .from('roles')
        .select(
          'id, code, name_ar, description_ar, owner_organization_id, is_system, is_active, priority, created_by, created_at, updated_at'
        )
        .order('priority')
        .order('name_ar'),
      admin
        .from('role_permission_grants')
        .select('role_id, permission_key, scope_type'),
      admin
        .from('permissions')
        .select(
          'key, module, action, display_name_ar, description_ar, is_sensitive, is_active, sort_order'
        )
        .eq('is_active', true)
        .order('module')
        .order('sort_order'),
    ])

    if (rolesError || grantsError || permissionsError) {
      console.error(
        '[roles:GET] query failed:',
        rolesError?.message ||
          grantsError?.message ||
          permissionsError?.message
      )
      return NextResponse.json(
        { error: 'تعذر تحميل إعدادات الأدوار والصلاحيات' },
        { status: 500 }
      )
    }

    const canManageRoles =
      gate.access.permissions['settings.manage_roles']?.granted === true
    const canCreateGlobalRoles = hasNationalManageRoleScope(gate.access)

    let manageableOrganizations: Array<{
      id: string
      name: string
      code: string | null
      level: number
      level_label: string
      parent_id: string | null
      sector_id: string | null
      governorate: string | null
    }> = []

    if (canManageRoles) {
      const { data: organizationRows, error: organizationsError } = await admin
        .from('organizations')
        .select(
          'id, name, code, level, level_label, parent_id, sector_id, governorate'
        )
        .eq('is_active', true)
        .order('level')
        .order('name')

      if (organizationsError) {
        console.error(
          '[roles:GET] organizations query failed:',
          organizationsError.message
        )
        return NextResponse.json(
          { error: 'تعذر تحميل الشجرة التنظيمية المتاحة للأدوار' },
          { status: 500 }
        )
      }

      const orgRows = organizationRows ?? []
      const organizationFacts = new Map<string, V2OrganizationFact>(
        orgRows.map((organization) => [
          String(organization.id),
          {
            id: String(organization.id),
            parentId: organization.parent_id
              ? String(organization.parent_id)
              : null,
            sectorId: organization.sector_id
              ? String(organization.sector_id)
              : null,
            governorate:
              typeof organization.governorate === 'string'
                ? organization.governorate
                : null,
            level: Number(organization.level),
          },
        ])
      )

      manageableOrganizations = orgRows
        .filter((organization) =>
          evaluateV2ResourceScope({
            user: gate.user,
            snapshot: gate.access,
            permissionKey: 'settings.manage_roles',
            resource: {
              organizationId: String(organization.id),
              sectorId:
                Number(organization.level) === 2
                  ? String(organization.id)
                  : organization.sector_id
                    ? String(organization.sector_id)
                    : null,
              governorate:
                typeof organization.governorate === 'string'
                  ? organization.governorate
                  : null,
            },
            organizationFacts,
          }).allowed
        )
        .map((organization) => ({
          id: String(organization.id),
          name: String(organization.name),
          code: organization.code ? String(organization.code) : null,
          level: Number(organization.level),
          level_label: String(organization.level_label),
          parent_id: organization.parent_id
            ? String(organization.parent_id)
            : null,
          sector_id: organization.sector_id
            ? String(organization.sector_id)
            : null,
          governorate:
            typeof organization.governorate === 'string'
              ? organization.governorate
              : null,
        }))
    }

    const delegationScopes: Record<string, V2ScopeType[]> = {}

    for (const permissionRow of permissions ?? []) {
      const permissionKey = String(permissionRow.key)
      const effective = gate.access.permissions[permissionKey]

      if (!effective?.granted || effective.deniedByUserOverride) {
        delegationScopes[permissionKey] = []
        continue
      }

      if (effective.sources.some((source) => source.scopeType === 'national')) {
        delegationScopes[permissionKey] = [...V2_SCOPE_TYPES]
        continue
      }

      delegationScopes[permissionKey] = [
        ...new Set(effective.sources.map((source) => source.scopeType)),
      ]
    }

    return NextResponse.json({
      roles: roles ?? [],
      grants: grants ?? [],
      permissions: permissions ?? [],
      delegationScopes,
      organizations: manageableOrganizations,
      capabilities: {
        canManageRoles,
        canCreateGlobalRoles,
        canManagePermissionRegistry:
          gate.access.permissions['settings.manage_permissions']?.granted ===
          true,
      },
    })
  } catch (error) {
    console.error('[roles:GET] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireV2Permission('settings.manage_roles')
    if (!gate.ok) return gate.response

    const body = (await request.json()) as Record<string, unknown>
    const roleId =
      typeof body.role_id === 'string' && body.role_id ? body.role_id : null
    const code =
      typeof body.code === 'string' ? body.code.trim().toLowerCase() : ''
    const nameAr =
      typeof body.name_ar === 'string' ? body.name_ar.trim() : ''
    const descriptionAr =
      typeof body.description_ar === 'string'
        ? body.description_ar.trim() || null
        : null
    const ownerOrganizationId =
      typeof body.owner_organization_id === 'string' &&
      body.owner_organization_id
        ? body.owner_organization_id
        : null
    const grants = normalizeGrants(body.grants)

    if (!/^[a-z][a-z0-9_]*$/.test(code) || code.startsWith('system_')) {
      return NextResponse.json(
        { error: 'كود الدور غير صحيح أو محجوز للنظام' },
        { status: 400 }
      )
    }

    if (!nameAr || !grants) {
      return NextResponse.json(
        { error: 'اسم الدور وقائمة الصلاحيات الصحيحة مطلوبان' },
        { status: 400 }
      )
    }

    const admin = getAdminSupabaseClient()

    if (roleId) {
      const { data: existingRole, error: existingError } = await admin
        .from('roles')
        .select('id, is_system, owner_organization_id')
        .eq('id', roleId)
        .maybeSingle()

      if (existingError || !existingRole) {
        return NextResponse.json(
          { error: 'الدور المطلوب غير موجود' },
          { status: 404 }
        )
      }

      if (existingRole.is_system === true) {
        return NextResponse.json(
          { error: 'الأدوار النظامية لا يمكن تعديلها من هذه الواجهة' },
          { status: 403 }
        )
      }

      const canEditCurrentOwner = await authorizeRoleOwner({
        ownerOrganizationId: existingRole.owner_organization_id
          ? String(existingRole.owner_organization_id)
          : null,
        user: gate.user,
        access: gate.access,
      })

      if (!canEditCurrentOwner) {
        return NextResponse.json(
          { error: 'هذا الدور خارج نطاق إدارتك', code: 'ROLE_SCOPE_DENIED' },
          { status: 403 }
        )
      }
    }

    const canUseOwner = await authorizeRoleOwner({
      ownerOrganizationId,
      user: gate.user,
      access: gate.access,
    })

    if (!canUseOwner) {
      return NextResponse.json(
        { error: 'جهة ملكية الدور خارج نطاق إدارتك', code: 'OWNER_SCOPE_DENIED' },
        { status: 403 }
      )
    }

    const permissionKeys = grants.map((grant) => grant.permissionKey)
    const { data: permissionRows, error: permissionError } = await admin
      .from('permissions')
      .select('key')
      .in('key', permissionKeys)
      .eq('is_active', true)

    if (
      permissionError ||
      (permissionRows ?? []).length !== permissionKeys.length
    ) {
      return NextResponse.json(
        { error: 'توجد صلاحية غير موجودة أو غير نشطة' },
        { status: 400 }
      )
    }

    if (
      !canDelegateV2RoleGrants({
        snapshot: gate.access,
        grants,
      })
    ) {
      return NextResponse.json(
        {
          error:
            'لا يمكنك منح دور صلاحية أو نطاقًا لا تملكه أنت',
          code: 'PRIVILEGE_ESCALATION_BLOCKED',
        },
        { status: 403 }
      )
    }

    const { data: savedRoleId, error: saveError } = await admin.rpc(
      'save_v2_custom_role',
      {
        p_actor_user_id: gate.user.profileId,
        p_role_id: roleId,
        p_code: code,
        p_name_ar: nameAr,
        p_description_ar: descriptionAr,
        p_owner_organization_id: ownerOrganizationId,
        p_grants: grants.map((grant) => ({
          permission_key: grant.permissionKey,
          scope_type: grant.scopeType,
        })),
      }
    )

    if (saveError) {
      console.error('[roles:POST] save failed:', saveError.message)
      const conflict =
        saveError.message.includes('duplicate') ||
        saveError.message.includes('unique')
      return NextResponse.json(
        {
          error: conflict
            ? 'كود الدور مستخدم بالفعل'
            : 'تعذر حفظ الدور',
        },
        { status: conflict ? 409 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      role_id: savedRoleId,
    })
  } catch (error) {
    console.error('[roles:POST] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء حفظ الدور' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const gate = await requireV2Permission('settings.manage_roles')
    if (!gate.ok) return gate.response

    const roleId = new URL(request.url).searchParams.get('role_id')
    if (!roleId) {
      return NextResponse.json(
        { error: 'معرف الدور مطلوب' },
        { status: 400 }
      )
    }

    const admin = getAdminSupabaseClient()
    const { data: roleData, error } = await admin
      .from('roles')
      .select('id, is_system, owner_organization_id')
      .eq('id', roleId)
      .maybeSingle()

    if (error || !roleData) {
      return NextResponse.json(
        { error: 'الدور غير موجود' },
        { status: 404 }
      )
    }

    if (roleData.is_system === true) {
      return NextResponse.json(
        { error: 'الأدوار النظامية لا يمكن تعطيلها' },
        { status: 403 }
      )
    }

    const canManage = await authorizeRoleOwner({
      ownerOrganizationId: roleData.owner_organization_id
        ? String(roleData.owner_organization_id)
        : null,
      user: gate.user,
      access: gate.access,
    })

    if (!canManage) {
      return NextResponse.json(
        { error: 'هذا الدور خارج نطاق إدارتك', code: 'ROLE_SCOPE_DENIED' },
        { status: 403 }
      )
    }

    const { error: disableError } = await admin.rpc(
      'disable_v2_custom_role',
      {
        p_actor_user_id: gate.user.profileId,
        p_role_id: roleId,
      }
    )

    if (disableError) {
      console.error('[roles:DELETE] disable failed:', disableError.message)
      return NextResponse.json(
        { error: 'تعذر تعطيل الدور' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[roles:DELETE] unexpected error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء تعطيل الدور' },
      { status: 500 }
    )
  }
}
