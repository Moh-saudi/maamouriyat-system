-- ==============================================================================
-- Script 21: RBAC V2 Pre-Apply Read-Only Preflight
-- Phase: 3B.1 — Database Reality Check
-- Target: PostgreSQL / Supabase
--
-- READ ONLY:
--   This script does not create, update, delete, truncate, or alter data/schema.
--   Run it BEFORE scripts 17-20.
--
-- Purpose:
--   Verify the real legacy database is safe to migrate and surface every known
--   blocker before any RBAC V2 DDL/DML is executed.
-- ==============================================================================

BEGIN TRANSACTION READ ONLY;

-- ------------------------------------------------------------------------------
-- A. Expected prerequisite objects
-- ------------------------------------------------------------------------------
SELECT
  'A01_required_legacy_tables' AS check_name,
  required.table_name,
  (to_regclass('public.' || required.table_name) IS NOT NULL) AS exists
FROM (VALUES
  ('users'),
  ('organizations'),
  ('user_permissions')
) AS required(table_name)
ORDER BY required.table_name;

-- V2 tables must NOT exist before first application of script 17.
SELECT
  'A02_v2_tables_must_not_preexist' AS check_name,
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
-- B. User hierarchy and organization anchors
-- ------------------------------------------------------------------------------
SELECT
  'B01_active_scoped_users_without_organization' AS check_name,
  COUNT(*) AS blocker_count
FROM public.users u
WHERE u.is_active IS TRUE
  AND COALESCE(u.org_level, u.level, 7) >= 2
  AND u.organization_id IS NULL;

SELECT
  'B02_active_scoped_users_without_organization_details' AS check_name,
  u.id,
  u.email,
  u.full_name,
  u.job_title,
  u.org_level,
  u.level,
  u.organization_id
FROM public.users u
WHERE u.is_active IS TRUE
  AND COALESCE(u.org_level, u.level, 7) >= 2
  AND u.organization_id IS NULL
ORDER BY COALESCE(u.org_level, u.level, 7), u.full_name NULLS LAST, u.email NULLS LAST;

-- Rows where both hierarchy columns are missing are currently migrated as level 7.
-- They are not an automatic blocker, but must be reviewed explicitly.
SELECT
  'B03_users_with_no_hierarchy_level' AS check_name,
  COUNT(*) AS review_count
FROM public.users u
WHERE u.org_level IS NULL
  AND u.level IS NULL;

SELECT
  'B04_conflicting_level_columns' AS check_name,
  COUNT(*) AS review_count
FROM public.users u
WHERE u.org_level IS NOT NULL
  AND u.level IS NOT NULL
  AND u.org_level <> u.level;

SELECT
  'B05_out_of_range_effective_levels' AS check_name,
  COUNT(*) AS blocker_count
FROM public.users u
WHERE COALESCE(u.org_level, u.level) IS NOT NULL
  AND COALESCE(u.org_level, u.level) NOT BETWEEN 0 AND 7;

-- organization_id should resolve to organizations for every populated value.
SELECT
  'B06_dangling_organization_references' AS check_name,
  COUNT(*) AS blocker_count
FROM public.users u
LEFT JOIN public.organizations o ON o.id = u.organization_id
WHERE u.organization_id IS NOT NULL
  AND o.id IS NULL;

-- Level 6 migration split visibility.
SELECT
  'B07_level6_role_split_preview' AS check_name,
  CASE
    WHEN u.job_title ILIKE '%مفتش%'
      OR u.job_title ILIKE '%قائم بالمرور%'
      THEN 'field_inspector'
    ELSE 'health_admin_manager'
  END AS target_role,
  COUNT(*) AS users_count
FROM public.users u
WHERE COALESCE(u.org_level, u.level, 7) = 6
GROUP BY 2
ORDER BY 2;

-- ------------------------------------------------------------------------------
-- C. Authentication/profile quality checks
-- ------------------------------------------------------------------------------
SELECT
  'C01_profiles_without_auth_id' AS check_name,
  COUNT(*) AS review_count
FROM public.users u
WHERE u.auth_id IS NULL;

SELECT
  'C02_duplicate_auth_ids' AS check_name,
  COUNT(*) AS blocker_groups
FROM (
  SELECT auth_id
  FROM public.users
  WHERE auth_id IS NOT NULL
  GROUP BY auth_id
  HAVING COUNT(*) > 1
) duplicates;

-- ------------------------------------------------------------------------------
-- D. Legacy page restriction integrity
-- ------------------------------------------------------------------------------
SELECT
  'D01_null_allowed_pages' AS check_name,
  COUNT(*) AS blocker_count
FROM public.user_permissions up
WHERE up.allowed_pages IS NULL;

SELECT
  'D02_empty_allowed_pages' AS check_name,
  COUNT(*) AS review_count
FROM public.user_permissions up
WHERE up.allowed_pages = '{}'::text[];

-- Unknown legacy page keys do not map automatically. Review them before migration.
WITH known_pages(page_code) AS (
  VALUES
    ('dashboard'),
    ('facilities'),
    ('organizations'),
    ('missions'),
    ('settings'),
    ('users'),
    ('violations'),
    ('checklists'),
    ('leadership-plan'),
    ('targets'),
    ('targets-report')
),
expanded AS (
  SELECT up.user_id, unnest(up.allowed_pages) AS page_code
  FROM public.user_permissions up
  WHERE up.allowed_pages IS NOT NULL
)
SELECT
  'D03_unknown_allowed_page_keys' AS check_name,
  e.page_code,
  COUNT(*) AS occurrences
FROM expanded e
LEFT JOIN known_pages k ON k.page_code = e.page_code
WHERE k.page_code IS NULL
GROUP BY e.page_code
ORDER BY e.page_code;

-- Preview how many users carry explicit legacy restrictions.
SELECT
  'D04_legacy_restriction_rows' AS check_name,
  COUNT(*) AS rows_count
FROM public.user_permissions;

-- ------------------------------------------------------------------------------
-- E. Migration volume preview
-- ------------------------------------------------------------------------------
SELECT
  'E01_users_by_effective_level' AS check_name,
  COALESCE(u.org_level, u.level, 7) AS effective_level,
  COUNT(*) AS users_count,
  COUNT(*) FILTER (WHERE u.is_active IS TRUE) AS active_users
FROM public.users u
GROUP BY COALESCE(u.org_level, u.level, 7)
ORDER BY effective_level;

SELECT
  'E02_total_users' AS check_name,
  COUNT(*) AS users_count,
  COUNT(*) FILTER (WHERE is_active IS TRUE) AS active_users,
  COUNT(*) FILTER (WHERE is_active IS NOT TRUE) AS inactive_or_unverified_users
FROM public.users;

-- ------------------------------------------------------------------------------
-- PASS / BLOCKER interpretation
-- ------------------------------------------------------------------------------
-- BLOCK execution if any of these are non-zero / unexpected:
--   A01: any required table exists = FALSE
--   A02: any V2 target table exists = TRUE
--   B01 > 0
--   B05 > 0
--   B06 > 0
--   C02 > 0
--   D01 > 0
--
-- REVIEW before execution:
--   B03, B04, C01, D02, D03
--
-- Do not execute scripts 17-20 until the external reviewer explicitly accepts
-- the result set.

ROLLBACK;
