-- ==============================================================================
-- Script 22: RBAC V2 Post-Apply Read-Only Verification
-- Phase: 3B.1 — Verification after scripts 17-20
--
-- READ ONLY:
--   Run only AFTER scripts 17, 18, 19 and 20 have completed successfully.
-- ==============================================================================

BEGIN TRANSACTION READ ONLY;

-- ------------------------------------------------------------------------------
-- A. Schema existence
-- ------------------------------------------------------------------------------
SELECT
  'A01_v2_tables_exist' AS check_name,
  target.table_name,
  (to_regclass('public.' || target.table_name) IS NOT NULL) AS exists
FROM (VALUES
  ('permissions'),
  ('roles'),
  ('role_permission_grants'),
  ('user_roles'),
  ('user_permission_overrides'),
  ('access_admin_audit')
) AS target(table_name)
ORDER BY target.table_name;

-- ------------------------------------------------------------------------------
-- B. Canonical seed integrity
-- ------------------------------------------------------------------------------
SELECT
  'B01_permission_registry' AS check_name,
  COUNT(*) AS total_permissions,
  COUNT(*) FILTER (WHERE is_active IS TRUE) AS active_permissions
FROM public.permissions;

SELECT
  'B02_system_roles' AS check_name,
  COUNT(*) AS total_system_roles,
  COUNT(*) FILTER (WHERE is_active IS TRUE) AS active_system_roles
FROM public.roles
WHERE is_system IS TRUE;

SELECT
  'B03_role_grants' AS check_name,
  COUNT(*) AS total_grants
FROM public.role_permission_grants;

SELECT
  'B04_expected_system_role_codes' AS check_name,
  expected.code,
  (r.id IS NOT NULL) AS exists,
  r.is_active
FROM (VALUES
  ('system_techadmin'),
  ('system_superadmin'),
  ('sector_manager'),
  ('central_admin_manager'),
  ('general_admin_manager'),
  ('directorate_manager'),
  ('health_admin_manager'),
  ('field_inspector')
) AS expected(code)
LEFT JOIN public.roles r
  ON r.code = expected.code
 AND r.is_system IS TRUE
ORDER BY expected.code;

-- ------------------------------------------------------------------------------
-- C. Assignment integrity
-- ------------------------------------------------------------------------------
SELECT
  'C01_active_profiles_without_active_role' AS check_name,
  COUNT(*) AS blocker_count
FROM public.users u
WHERE u.is_active IS TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = u.id
      AND ur.is_active IS TRUE
      AND ur.valid_from <= NOW()
      AND (ur.valid_until IS NULL OR ur.valid_until > NOW())
  );

SELECT
  'C02_inactive_profiles_with_active_role' AS check_name,
  COUNT(*) AS blocker_count
FROM public.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.is_active IS NOT TRUE
  AND ur.is_active IS TRUE
  AND ur.valid_from <= NOW()
  AND (ur.valid_until IS NULL OR ur.valid_until > NOW());

-- Scoped canonical roles require an organization anchor.
SELECT
  'C03_active_scoped_assignments_without_anchor' AS check_name,
  COUNT(*) AS blocker_count
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
JOIN public.users u ON u.id = ur.user_id
WHERE ur.is_active IS TRUE
  AND r.code IN (
    'sector_manager',
    'central_admin_manager',
    'general_admin_manager',
    'directorate_manager',
    'health_admin_manager',
    'field_inspector'
  )
  AND COALESCE(ur.assignment_org_id, u.organization_id) IS NULL;

-- ------------------------------------------------------------------------------
-- D. Legacy restriction migration verification
-- ------------------------------------------------------------------------------
-- A page omitted in legacy allowed_pages must not leave an active ALLOW override.
SELECT
  'D01_deny_overrides_created' AS check_name,
  COUNT(*) AS deny_override_count
FROM public.user_permission_overrides
WHERE effect = 'deny'
  AND is_active IS TRUE
  AND reason = 'Migrated from legacy allowed_pages restriction';

-- Any DENY with a non-null scope would violate the intended semantics.
SELECT
  'D02_invalid_deny_scopes' AS check_name,
  COUNT(*) AS blocker_count
FROM public.user_permission_overrides
WHERE effect = 'deny'
  AND scope_type IS NOT NULL;

-- Any ALLOW without scope is invalid.
SELECT
  'D03_invalid_allow_scopes' AS check_name,
  COUNT(*) AS blocker_count
FROM public.user_permission_overrides
WHERE effect = 'allow'
  AND scope_type IS NULL;

-- ------------------------------------------------------------------------------
-- E. RLS / direct-client posture
-- ------------------------------------------------------------------------------
SELECT
  'E01_rls_enabled' AS check_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'permissions',
    'roles',
    'role_permission_grants',
    'user_roles',
    'user_permission_overrides',
    'access_admin_audit'
  )
ORDER BY c.relname;

SELECT
  'E02_browser_facing_policies' AS check_name,
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'permissions',
    'roles',
    'role_permission_grants',
    'user_roles',
    'user_permission_overrides',
    'access_admin_audit'
  )
ORDER BY tablename, policyname;

-- ------------------------------------------------------------------------------
-- F. Audit immutability trigger
-- ------------------------------------------------------------------------------
SELECT
  'F01_audit_immutability_trigger' AS check_name,
  tg.tgname AS trigger_name,
  NOT tg.tgisinternal AS user_defined
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'access_admin_audit'
  AND tg.tgname = 'trg_access_admin_audit_immutable';

-- Expected canonical counts for the currently reviewed seed:
-- permissions: 52
-- system roles: 8
-- role_permission_grants: 197
--
-- BLOCK application rollout if:
-- - any V2 table is missing
-- - active permissions != 52
-- - active system roles != 8
-- - role grants != 197
-- - C01/C02/C03/D02/D03 > 0
-- - RLS is not enabled on any table
-- - any unexpected browser-facing policy exists
-- - audit immutability trigger is missing

ROLLBACK;
