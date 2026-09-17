-- ==============================================================================
-- Script 19: Dynamic RBAC V2 System Roles and Explicit Grants Seed
-- Phase: Phase 3B — Dynamic RBAC Database Schema DESIGN ONLY
-- Target Engine: PostgreSQL 15+ / Supabase
--
-- IMPORTANT SAFETY NOTICE:
-- This script seeds foundational System Roles and their explicit permission grants.
-- It is designed for offline review and MUST NOT be executed against the production
-- database until authorized in Phase 3B.1.
--
-- Core Principles Enforced:
-- 1. Explicit Grants Only: No magic roles, no wildcard bypass. Even superadmin
--    has explicitly enumerated rows in public.role_permission_grants.
-- 2. Scope Ceilings: Every grant specifies an explicit maximum scope_type:
--    ('self', 'assigned', 'organization', 'organization_tree', 'governorate', 'sector', 'national').
-- 3. High Fidelity to V1 Behavior: Accurately replicates src/lib/roles.ts logic.
-- 4. No Hierarchy/Level in Role Rows: Levels (0-7) do NOT exist on public.roles.
-- 5. Idempotent: Uses ON CONFLICT DO UPDATE / DO NOTHING.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Seed System Roles (public.roles)
-- ------------------------------------------------------------------------------
INSERT INTO public.roles (
  code,
  name_ar,
  description_ar,
  owner_organization_id,
  is_system,
  is_active,
  priority
)
VALUES
  (
    'system_techadmin',
    'مسؤول الدعم الفني والتقني',
    'إدارة البنية التقنية، إعدادات المنظومة، قاموس الصلاحيات، سجلات التدقيق، وإدارة المستخدمين الشاملة على المستوى القومي بدون تنفيذ مأموريات ميدانية',
    NULL,
    TRUE,
    TRUE,
    10
  ),
  (
    'system_superadmin',
    'المدير العام للمنظومة بالوزارة',
    'إشراف قيادي وسيادي شامل على كافة قطاعات الوزارة، المأموريات، المستهدفات، والجهات على المستوى القومي',
    NULL,
    TRUE,
    TRUE,
    20
  ),
  (
    'sector_manager',
    'رئيس قطاع / وكيل وزارة',
    'إشراف كامل على مأموريات وخطط ومستهدفات ومخالفات الإدارات والمديريات التابعة للقطاع',
    NULL,
    TRUE,
    TRUE,
    30
  ),
  (
    'central_admin_manager',
    'رئيس إدارة مركزية',
    'إدارة وتكليف واعتماد مأموريات ومستهدفات الإدارات العامة التابعة للإدارة المركزية',
    NULL,
    TRUE,
    TRUE,
    40
  ),
  (
    'general_admin_manager',
    'مدير عام إدارة عامة',
    'إدارة تشغيلية وتكليف ومتابعة مأموريات المرور ومستهدفات الإدارة العامة',
    NULL,
    TRUE,
    TRUE,
    50
  ),
  (
    'directorate_manager',
    'مدير مديرية الشؤون الصحية',
    'سلطة الإشراف والاعتماد وتوزيع المأموريات والمستهدفات على مستوى المحافظة بالكامل',
    NULL,
    TRUE,
    TRUE,
    60
  ),
  (
    'health_admin_manager',
    'مدير إدارة صحية',
    'إدارة وتنسيق مأموريات المرور ومتابعة تلافي السلبيات بالمنشآت التابعة للإدارة الصحية',
    NULL,
    TRUE,
    TRUE,
    70
  ),
  (
    'field_inspector',
    'مفتش / عضو فريق مرور ميداني',
    'تنفيذ الزيارات الميدانية المكلف بها، تسجيل نتائج بطاقات التقييم، ورصد المخالفات الميدانية',
    NULL,
    TRUE,
    TRUE,
    80
  )
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  description_ar = EXCLUDED.description_ar,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active,
  priority = EXCLUDED.priority,
  updated_at = NOW();


-- ------------------------------------------------------------------------------
-- 2. Seed System Role Permission Grants (public.role_permission_grants)
-- ------------------------------------------------------------------------------

-- Helper CTE to reference role IDs cleanly by code
WITH role_ids AS (
  SELECT code, id FROM public.roles WHERE is_system = TRUE
)
INSERT INTO public.role_permission_grants (role_id, permission_key, scope_type)
VALUES
  -- ============================================================================
  -- 1. system_techadmin (Technical Administrator)
  -- Scope: national for configuration/admin modules; no field operations
  -- ============================================================================
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'dashboard.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'users.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'users.create', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'users.edit', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'users.deactivate', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'users.reset_password', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'users.assign_role', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'facilities.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'facilities.create', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'facilities.edit', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'facilities.delete', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'organizations.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'organizations.create', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'organizations.edit', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'organizations.delete', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'organizations.manage_capabilities', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'checklists.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'checklists.design', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'checklists.publish', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'settings.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'settings.manage_roles', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'settings.manage_permissions', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_techadmin'), 'audit.view', 'national'),

  -- ============================================================================
  -- 2. system_superadmin (Ministry General Administrator)
  -- Scope: national across all operational and administrative domains
  -- ============================================================================
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'dashboard.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'missions.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'missions.create', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'missions.edit', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'missions.delete', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'missions.assign', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'missions.review', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'missions.approve', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'missions.close', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'mission_results.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'mission_results.edit', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'violations.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'violations.create', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'violations.assign', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'violations.verify', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'violations.close', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'facilities.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'facilities.create', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'facilities.edit', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'facilities.delete', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'organizations.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'organizations.create', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'organizations.edit', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'organizations.manage_capabilities', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'users.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'users.create', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'users.edit', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'users.deactivate', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'users.reset_password', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'users.assign_role', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'checklists.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'checklists.design', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'checklists.publish', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'targets.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'targets.create', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'targets.edit', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'targets.delete', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'targets.approve', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'targets.report', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'leadership_targets.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'leadership_targets.create', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'leadership_targets.edit', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'leadership_targets.delete', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'settings.view', 'national'),
  ((SELECT id FROM role_ids WHERE code = 'system_superadmin'), 'audit.view', 'national'),

  -- ============================================================================
  -- 3. sector_manager (Sector Head / Undersecretary)
  -- Scope: sector for all operational oversight
  -- ============================================================================
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'dashboard.view', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'missions.view', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'missions.create', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'missions.edit', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'missions.assign', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'missions.review', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'missions.approve', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'missions.close', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'mission_results.view', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'violations.view', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'violations.create', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'violations.assign', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'violations.verify', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'violations.close', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'facilities.view', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'organizations.view', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'users.view', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'users.create', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'users.edit', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'users.deactivate', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'checklists.view', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'targets.view', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'targets.create', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'targets.edit', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'targets.approve', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'targets.report', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'leadership_targets.view', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'leadership_targets.create', 'sector'),
  ((SELECT id FROM role_ids WHERE code = 'sector_manager'), 'leadership_targets.edit', 'sector'),

  -- ============================================================================
  -- 4. central_admin_manager (Central Administration Head)
  -- Scope: organization_tree
  -- ============================================================================
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'dashboard.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'missions.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'missions.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'missions.edit', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'missions.assign', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'missions.review', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'missions.approve', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'missions.close', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'mission_results.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'violations.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'violations.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'violations.assign', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'violations.verify', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'violations.close', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'facilities.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'organizations.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'users.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'users.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'users.edit', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'checklists.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'targets.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'targets.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'targets.edit', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'targets.approve', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'targets.report', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'leadership_targets.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'leadership_targets.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'central_admin_manager'), 'leadership_targets.edit', 'organization_tree'),

  -- ============================================================================
  -- 5. general_admin_manager (General Administration Manager)
  -- Scope: organization_tree
  -- ============================================================================
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'dashboard.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'missions.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'missions.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'missions.edit', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'missions.assign', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'missions.review', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'missions.approve', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'missions.close', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'mission_results.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'violations.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'violations.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'violations.assign', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'violations.verify', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'violations.close', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'facilities.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'organizations.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'users.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'users.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'users.edit', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'checklists.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'targets.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'targets.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'targets.edit', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'targets.report', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'leadership_targets.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'leadership_targets.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'general_admin_manager'), 'leadership_targets.edit', 'organization_tree'),

  -- ============================================================================
  -- 6. directorate_manager (Health Directorate Manager)
  -- Scope: governorate
  -- ============================================================================
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'dashboard.view', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'missions.view', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'missions.create', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'missions.edit', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'missions.assign', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'missions.review', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'missions.approve', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'missions.close', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'mission_results.view', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'violations.view', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'violations.create', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'violations.assign', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'violations.verify', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'violations.close', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'facilities.view', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'organizations.view', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'users.view', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'users.create', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'users.edit', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'users.deactivate', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'checklists.view', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'targets.view', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'targets.create', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'targets.edit', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'targets.approve', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'targets.report', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'leadership_targets.view', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'leadership_targets.create', 'governorate'),
  ((SELECT id FROM role_ids WHERE code = 'directorate_manager'), 'leadership_targets.edit', 'governorate'),

  -- ============================================================================
  -- 7. health_admin_manager (Health Administration Manager)
  -- Scope: organization_tree
  -- ============================================================================
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'dashboard.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'missions.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'missions.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'missions.edit', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'missions.assign', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'missions.review', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'missions.close', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'mission_results.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'violations.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'violations.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'violations.correct', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'violations.verify', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'facilities.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'organizations.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'users.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'checklists.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'targets.view', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'targets.create', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'targets.edit', 'organization_tree'),
  ((SELECT id FROM role_ids WHERE code = 'health_admin_manager'), 'targets.report', 'organization_tree'),

  -- ============================================================================
  -- 8. field_inspector (Field Inspector / Team Member)
  -- Scope: assigned / self
  -- ============================================================================
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'dashboard.view', 'self'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'missions.view', 'assigned'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'missions.execute', 'assigned'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'missions.review', 'assigned'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'mission_results.view', 'assigned'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'mission_results.record', 'assigned'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'mission_results.edit', 'assigned'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'violations.view', 'assigned'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'violations.create', 'assigned'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'violations.correct', 'assigned'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'facilities.view', 'assigned'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'checklists.view', 'assigned'),
  ((SELECT id FROM role_ids WHERE code = 'field_inspector'), 'checklists.execute', 'assigned')

ON CONFLICT (role_id, permission_key) DO UPDATE SET
  scope_type = EXCLUDED.scope_type;

COMMIT;
