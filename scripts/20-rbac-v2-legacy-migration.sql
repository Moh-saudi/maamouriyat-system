-- ==============================================================================
-- Script 20: Dynamic RBAC V2 Legacy User & Permissions Migration (DRAFT ONLY)
-- Phase: Phase 3B.0.5 — RBAC SQL Safety & Migration Corrections
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
-- 1. Preflight Integrity: Fails immediately if any active scoped user (level >= 2)
--    lacks an organization_id anchor. Data cleanup is required prior to execution.
-- 2. Transitional Assignment: Maps existing users (public.users) to default
--    V2 System Roles based on their legacy hierarchy level (org_level / level)
--    and job_title inspection indicators (level 6 inspectors).
-- 3. Non-Permanent Linking: Level-to-role mapping is executed ONCE during migration.
--    Post-migration, changing a user's org_level will NOT alter their role.
-- 4. Legacy Page Restrictions to V2 Overrides: Translates legacy `allowed_pages`
--    from `public.user_permissions` into explicit V2 DENY overrides for omitted modules.
--    Empty arrays ('{}') correctly deny all mapped modules (Fail-Closed).
-- 5. Dashboard Exemption: Preserves dashboard.view accessibility for all authenticated users.
-- 6. Zero Destructive Operations: No tables or columns are dropped or truncated.
--    Legacy tables (user_permissions, role_permissions) remain completely intact for V1.
-- 7. Strict Foreign Key Integrity: Uses `users.organization_id` as `assignment_org_id`.
--    Never uses `organizational_units` or `org_unit_id`.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PREFLIGHT: Scoped Users Organization Anchor Validation
-- ==============================================================================
-- Scoped roles (sector_manager down to field_inspector) require an organization
-- anchor to evaluate data scopes safely. assignment_org_id = NULL does NOT grant
-- global or national access.
-- If any active scoped user lacks organization_id, the migration must FAIL CLOSED.
-- ==============================================================================
DO $$
DECLARE
  missing_org_users INTEGER;
  null_allowed_pages_rows INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO missing_org_users
  FROM public.users u
  WHERE (u.is_active IS TRUE)
    AND COALESCE(u.org_level, u.level, 7) >= 2
    AND u.organization_id IS NULL;

  IF missing_org_users > 0 THEN
    RAISE EXCEPTION 'Pre-migration check failed: % active scoped user(s) (level >= 2) have NULL organization_id. Data cleanup is required before migrating to V2: all scoped users must have a trusted organization anchor.', missing_org_users;
  END IF;

  -- Legacy schema declares allowed_pages NOT NULL, but historical/schema-drift data
  -- must never be interpreted as unrestricted access. Abort and clean it explicitly.
  SELECT COUNT(*)
  INTO null_allowed_pages_rows
  FROM public.user_permissions up
  WHERE up.allowed_pages IS NULL;

  IF null_allowed_pages_rows > 0 THEN
    RAISE EXCEPTION 'Pre-migration check failed: % legacy user_permissions row(s) have NULL allowed_pages. Resolve these rows explicitly before RBAC migration; NULL is never treated as unrestricted access.', null_allowed_pages_rows;
  END IF;
END $;


-- ==============================================================================
-- STEP 1: Assign Default System Role to Existing Users
-- ==============================================================================
-- Mapping Reference (from src/lib/roles.ts):
-- Level 0 -> system_techadmin
-- Level 1 -> system_superadmin
-- Level 2 -> sector_manager
-- Level 3 -> central_admin_manager
-- Level 4 -> general_admin_manager
-- Level 5 -> directorate_manager
-- Level 6 + job_title contains ('مفتش' or 'قائم بالمرور') -> field_inspector
-- Level 6 (other) -> health_admin_manager
-- Level 7 (or any other) -> field_inspector
--
-- Fail-Closed Active State:
-- user_roles.is_active is TRUE only when users.is_active IS TRUE.
-- Never fallbacks to TRUE for inactive or NULL accounts.
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
    CASE
      WHEN COALESCE(u.org_level, u.level, 7) = 0 THEN 'system_techadmin'
      WHEN COALESCE(u.org_level, u.level, 7) = 1 THEN 'system_superadmin'
      WHEN COALESCE(u.org_level, u.level, 7) = 2 THEN 'sector_manager'
      WHEN COALESCE(u.org_level, u.level, 7) = 3 THEN 'central_admin_manager'
      WHEN COALESCE(u.org_level, u.level, 7) = 4 THEN 'general_admin_manager'
      WHEN COALESCE(u.org_level, u.level, 7) = 5 THEN 'directorate_manager'
      WHEN COALESCE(u.org_level, u.level, 7) = 6 THEN
        CASE
          WHEN u.job_title ILIKE '%مفتش%' OR u.job_title ILIKE '%قائم بالمرور%' THEN 'field_inspector'
          ELSE 'health_admin_manager'
        END
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
  (ulm.user_is_active IS TRUE) AS is_active, -- Strict fail-closed: active only if user is explicitly active
  NOW() AS valid_from,
  NULL AS valid_until,
  NULL AS assigned_by
FROM user_level_map ulm
JOIN role_lookup rl ON rl.code = ulm.assigned_role_code
-- Idempotent assignment: parenthesized COALESCE expression matches unique index target
ON CONFLICT (user_id, role_id, (COALESCE(assignment_org_id, '00000000-0000-0000-0000-000000000000'::uuid)))
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
-- Empty Array Bug Fix:
-- If allowed_pages = '{}', all 10 modules above are omitted and become DENY overrides.
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
  -- Evaluate all users with an explicit record in user_permissions
  SELECT
    up.user_id,
    up.allowed_pages
  FROM public.user_permissions up
  JOIN public.users u ON u.id = up.user_id
),
omitted_modules AS (
  SELECT
    alur.user_id,
    lp.permission_key
  FROM active_legacy_user_restrictions alur
  CROSS JOIN legacy_pages lp
  -- The page was NOT in allowed_pages; an empty array correctly omits all modules
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
