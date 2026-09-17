-- ==============================================================================
-- Script 20: Dynamic RBAC V2 Legacy User & Permissions Migration (DRAFT ONLY)
-- Phase: Phase 3B — Dynamic RBAC Database Schema DESIGN ONLY
-- Target Engine: PostgreSQL 15+ / Supabase
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- ! CRITICAL SAFETY NOTICE:                                                    !
-- ! THIS SCRIPT IS A DRAFT FOR REVIEW ONLY.                                    !
-- ! DO NOT EXECUTE AGAINST ANY DATABASE IN THIS PHASE.                         !
-- ! EXECUTION IS STRICTLY PROHIBITED UNTIL PHASE 3B.1 UPON FORMAL APPROVAL.    !
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- Purpose & Objectives:
-- 1. Transitional Assignment: Maps existing users (public.users) to default
--    V2 System Roles based on their legacy hierarchy level (org_level / level).
-- 2. Non-Permanent Linking: Level-to-role mapping is executed ONCE during migration.
--    Post-migration, changing a user's org_level will NOT alter their role.
-- 3. Legacy Page Restrictions to V2 Overrides: Translates legacy `allowed_pages`
--    from `public.user_permissions` into explicit V2 DENY overrides for omitted modules.
-- 4. Zero Destructive Operations: No tables or columns are dropped or truncated.
--    Legacy tables (user_permissions, role_permissions) remain completely intact for V1.
-- 5. Strict Foreign Key Integrity: Uses `users.organization_id` as `assignment_org_id`.
--    Never uses `organizational_units` or `org_unit_id`.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- STEP 1: Assign Default System Role to Existing Users
-- ==============================================================================
-- Mapping Reference (from src/lib/roles.ts and system design):
-- Level 0 -> system_techadmin
-- Level 1 -> system_superadmin
-- Level 2 -> sector_manager
-- Level 3 -> central_admin_manager
-- Level 4 -> general_admin_manager
-- Level 5 -> directorate_manager
-- Level 6 -> health_admin_manager
-- Level 7 (or any other) -> field_inspector
--
-- Notes on assignment_org_id:
-- - Points to public.organizations(id) via users.organization_id.
-- - If users.organization_id IS NULL, assignment_org_id is set to NULL (Global assignment).
-- - Zero references to legacy organizational_units.
-- ==============================================================================

WITH role_lookup AS (
  SELECT code, id FROM public.roles WHERE is_system = TRUE
),
user_level_map AS (
  SELECT
    u.id AS user_id,
    u.organization_id,
    u.is_active AS user_is_active,
    COALESCE(u.org_level, u.level, 7) AS effective_level,
    CASE COALESCE(u.org_level, u.level, 7)
      WHEN 0 THEN 'system_techadmin'
      WHEN 1 THEN 'system_superadmin'
      WHEN 2 THEN 'sector_manager'
      WHEN 3 THEN 'central_admin_manager'
      WHEN 4 THEN 'general_admin_manager'
      WHEN 5 THEN 'directorate_manager'
      WHEN 6 THEN 'health_admin_manager'
      ELSE 'field_inspector'
    END AS assigned_role_code
  FROM public.users u
)
INSERT INTO public.user_roles (
  user_id,
  role_id,
  assignment_org_id,
  is_active,
  valid_from,
  valid_until,
  assigned_by
)
SELECT
  ulm.user_id,
  rl.id AS role_id,
  ulm.organization_id AS assignment_org_id,
  COALESCE(ulm.user_is_active, TRUE) AS is_active,
  NOW() AS valid_from,
  NULL AS valid_until,
  NULL AS assigned_by
FROM user_level_map ulm
JOIN role_lookup rl ON rl.code = ulm.assigned_role_code
-- Idempotent assignment: prevent duplicate assignment using existing partial unique indexes
ON CONFLICT (user_id, role_id, COALESCE(assignment_org_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO UPDATE SET
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- ==============================================================================
-- STEP 2: Migrate Legacy allowed_pages Restrictions to V2 DENY Overrides
-- ==============================================================================
-- Context:
-- In V1 `public.user_permissions`, custom user restrictions were stored as an array
-- `allowed_pages TEXT[]`.
--
-- In V2, roles grant base permissions. If a user was restricted in V1 by omitting
-- pages from `allowed_pages`, we translate each omitted page module into an
-- explicit user-level DENY override.
--
-- Monitored Page-to-Permission Mapping:
-- 'facilities'        -> 'facilities.view'
-- 'organizations'     -> 'organizations.view'
-- 'missions'          -> 'missions.view'
-- 'settings'          -> 'settings.view'
-- 'users'             -> 'users.view'
-- 'violations'        -> 'violations.view'
-- 'checklists'        -> 'checklists.view'
-- 'leadership-plan'   -> 'leadership_targets.view'
-- 'targets'           -> 'targets.view'
-- 'targets-report'    -> 'targets.report'
--
-- Dashboard Special Case:
-- 'dashboard' was universally accessible in V1. To prevent inadvertent account lockouts,
-- 'dashboard.view' is excluded from automated DENY overrides during legacy migration.
-- ==============================================================================

WITH legacy_pages AS (
  SELECT * FROM (VALUES
    ('facilities',      'facilities.view'),
    ('organizations',   'organizations.view'),
    ('missions',        'missions.view'),
    ('settings',        'settings.view'),
    ('users',           'users.view'),
    ('violations',      'violations.view'),
    ('checklists',      'checklists.view'),
    ('leadership-plan', 'leadership_targets.view'),
    ('targets',         'targets.view'),
    ('targets-report',  'targets.report')
  ) AS t(page_code, permission_key)
),
active_legacy_user_restrictions AS (
  -- Only evaluate users who actually have an explicit user_permissions record
  -- with an allowed_pages array defined
  SELECT
    up.user_id,
    up.allowed_pages
  FROM public.user_permissions up
  JOIN public.users u ON u.id = up.user_id
  WHERE up.allowed_pages IS NOT NULL
    AND array_length(up.allowed_pages, 1) > 0
),
omitted_modules AS (
  SELECT
    alur.user_id,
    lp.permission_key
  FROM active_legacy_user_restrictions alur
  CROSS JOIN legacy_pages lp
  -- The page was NOT in allowed_pages, meaning it was prohibited in V1
  WHERE NOT (lp.page_code = ANY(alur.allowed_pages))
)
INSERT INTO public.user_permission_overrides (
  user_id,
  permission_key,
  effect,
  scope_type,
  reason,
  is_active,
  granted_by
)
SELECT
  om.user_id,
  om.permission_key,
  'deny' AS effect,
  NULL AS scope_type, -- Strict CHECK requirement: DENY overrides must have NULL scope_type
  'Migrated from legacy allowed_pages restriction' AS reason,
  TRUE AS is_active,
  NULL AS granted_by
FROM omitted_modules om
JOIN public.permissions p ON p.key = om.permission_key
ON CONFLICT (user_id, permission_key) DO UPDATE SET
  effect = 'deny',
  scope_type = NULL,
  reason = EXCLUDED.reason,
  is_active = TRUE,
  updated_at = NOW();

COMMIT;
