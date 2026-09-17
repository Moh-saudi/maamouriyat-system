-- ==============================================================================
-- Script 23: RBAC V2 Post-Apply Hardening
-- Phase: 3B.1 — Advisor-driven hardening after successful RBAC apply
--
-- Purpose:
-- 1. Pin search_path on RBAC helper functions flagged by Supabase security advisor.
-- 2. Add covering indexes for RBAC foreign keys flagged by performance advisor.
-- 3. Preserve intentional RLS default-deny posture (no browser policies added).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- A. Pin function search_path
-- ------------------------------------------------------------------------------
ALTER FUNCTION public.rbac_set_updated_at()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.rbac_prevent_audit_mutation()
  SET search_path = pg_catalog, public;

-- ------------------------------------------------------------------------------
-- B. Cover remaining RBAC foreign keys
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_roles_created_by
  ON public.roles (created_by);

CREATE INDEX IF NOT EXISTS idx_role_permission_grants_created_by
  ON public.role_permission_grants (created_by);

CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by
  ON public.user_roles (assigned_by);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_granted_by
  ON public.user_permission_overrides (granted_by);

CREATE INDEX IF NOT EXISTS idx_access_admin_audit_target_permission
  ON public.access_admin_audit (target_permission_key);

COMMIT;
