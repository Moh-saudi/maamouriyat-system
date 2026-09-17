-- ==============================================================================
-- Script 17: Dynamic Role-Based Access Control (RBAC) V2 Core Schema Design
-- Phase: Phase 3B.0.5 — RBAC SQL Safety & Migration Corrections
-- Target Engine: PostgreSQL 15+ / Supabase
--
-- IMPORTANT SAFETY NOTICE:
-- This script defines the V2 Dynamic RBAC data model.
-- It is designed for offline review and MUST NOT be executed against the production
-- database until authorized in Phase 3B.1.
--
-- Principles Enforced:
-- 1. Decoupled Organizational Hierarchy (levels 1-7) from Functional RBAC Roles.
-- 2. Organizations foreign keys strictly reference public.organizations(id).
-- 3. Fail-Fast Execution: Aborts if any of the 6 tables pre-exist in unknown states.
-- 4. Fail-Closed Foreign Keys: ON DELETE RESTRICT on organization and audit references.
-- 5. Multi-role assignment per user supported with clean validity date ranges.
-- 6. Explicit DENY user-level overrides take absolute precedence over grants.
-- 7. Append-Only Audit Immutability enforced at DB level via trigger.
-- 8. Row Level Security (RLS) enabled on all tables with Default-Deny posture.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. Preflight Integrity Check: Fail-Fast on Pre-existing Schema Conflict
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  preexisting_tables TEXT[];
BEGIN
  SELECT array_agg(table_name::text)
  INTO preexisting_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'permissions',
      'roles',
      'role_permission_grants',
      'user_roles',
      'user_permission_overrides',
      'access_admin_audit'
    );

  IF preexisting_tables IS NOT NULL AND array_length(preexisting_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Preflight check failed: Pre-existing RBAC V2 table(s) detected: %. Schema migration must fail-fast on unknown schema state.', array_to_string(preexisting_tables, ', ');
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. Helper Functions: Timestamp Automation & Audit Immutability
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rbac_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.rbac_prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'access_admin_audit is append-only: % operations are strictly prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. Table: public.permissions
-- Central registry of discrete, machine-stable system capabilities.
-- ------------------------------------------------------------------------------
CREATE TABLE public.permissions (
  key TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  display_name_ar TEXT NOT NULL,
  description_ar TEXT,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Format constraint: lowercase words separated by dots (e.g. missions.approve)
  CONSTRAINT chk_permissions_key_format
    CHECK (key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),

  -- Key integrity constraint: key must strictly match module.action
  CONSTRAINT chk_permissions_key_module_action
    CHECK (key = (module || '.' || action)),

  -- Ensure uniqueness of module and action combinations
  CONSTRAINT uq_permissions_module_action
    UNIQUE (module, action)
);

-- Note: uq_permissions_module_action already creates an index covering (module, action).
-- We create an index on active state and sort order for administrative UI listings:
CREATE INDEX idx_permissions_active_sort
  ON public.permissions (is_active, sort_order);

DROP TRIGGER IF EXISTS trg_permissions_updated_at ON public.permissions;
CREATE TRIGGER trg_permissions_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.rbac_set_updated_at();

-- ------------------------------------------------------------------------------
-- 3. Table: public.roles
-- Definable roles. May be system-wide or scoped to an organization owner.
-- ------------------------------------------------------------------------------
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  description_ar TEXT,
  -- Fail-closed: deleting an organization must NOT convert a local role into a global role.
  owner_organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 100,
  created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Format constraint: snake_case alphanumeric codes (e.g. sector_manager)
  CONSTRAINT chk_roles_code_format
    CHECK (code ~ '^[a-z][a-z0-9_]*$'),

  -- System roles are globally defined; they must not have an owner organization.
  CONSTRAINT chk_roles_system_owner
    CHECK (is_system IS FALSE OR owner_organization_id IS NULL)
);

CREATE INDEX idx_roles_owner_org
  ON public.roles (owner_organization_id);

CREATE INDEX idx_roles_active_priority
  ON public.roles (is_active, priority);

DROP TRIGGER IF EXISTS trg_roles_updated_at ON public.roles;
CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.rbac_set_updated_at();

-- ------------------------------------------------------------------------------
-- 4. Table: public.role_permission_grants
-- Associates permissions with roles along with an authorized maximum scope ceiling.
-- ------------------------------------------------------------------------------
CREATE TABLE public.role_permission_grants (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  scope_type TEXT NOT NULL,
  created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (role_id, permission_key),

  -- Scope domain validation: self, assigned, organization, organization_tree, governorate, sector, national
  CONSTRAINT chk_role_grants_scope_type
    CHECK (scope_type IN ('self', 'assigned', 'organization', 'organization_tree', 'governorate', 'sector', 'national'))
);

-- Note: PRIMARY KEY (role_id, permission_key) already indexes the role_id leading column.
-- We index permission_key to support reverse queries (which roles hold a permission):
CREATE INDEX idx_role_perm_grants_perm
  ON public.role_permission_grants (permission_key);

-- ------------------------------------------------------------------------------
-- 5. Table: public.user_roles
-- Multi-role assignment of users to roles, bound to an optional organizational assignment.
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  -- Fail-closed: deleting an organization must NOT convert an org-scoped assignment into a global assignment.
  -- Must explicitly resolve assignments before deleting an organization.
  assignment_org_id UUID NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ NULL,
  assigned_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Validity chronology check
  CONSTRAINT chk_user_roles_validity_dates
    CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Enforce exactly one assignment record per (user_id, role_id, assignment_org_id) across the board.
-- Notes on assignment_org_id = NULL:
-- - NULL does NOT mean Global Access or National Scope.
-- - NULL means "No explicit assignment organization override".
-- - Scope evaluation in Phase 3D uses the trusted organizational context of the user. If an organization
--   anchor cannot be resolved for a scoped permission: DENY. NULL never broadens permissions.
CREATE UNIQUE INDEX idx_uq_user_roles_user_role_org
  ON public.user_roles (user_id, role_id, (COALESCE(assignment_org_id, '00000000-0000-0000-0000-000000000000'::uuid)));

-- idx_uq_user_roles_user_role_org already has user_id as its leading column and
-- supports the primary "roles for one user" lookup path.

CREATE INDEX idx_user_roles_role
  ON public.user_roles (role_id);

CREATE INDEX idx_user_roles_org
  ON public.user_roles (assignment_org_id);

CREATE INDEX idx_user_roles_active_dates
  ON public.user_roles (is_active, valid_from, valid_until);

DROP TRIGGER IF EXISTS trg_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER trg_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.rbac_set_updated_at();

-- ------------------------------------------------------------------------------
-- 6. Table: public.user_permission_overrides
-- User-specific permission adjustments: explicit ALLOW with scope, or explicit DENY.
-- RULE: Explicit DENY takes absolute precedence over any granted role permission.
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  effect TEXT NOT NULL,
  scope_type TEXT NULL,
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- At most one override record per user per permission key
  CONSTRAINT uq_user_perm_overrides_user_perm
    UNIQUE (user_id, permission_key),

  -- Effect must be allow or deny
  CONSTRAINT chk_user_perm_overrides_effect
    CHECK (effect IN ('allow', 'deny')),

  -- Scope type value domain check
  CONSTRAINT chk_user_perm_overrides_scope_domain
    CHECK (scope_type IS NULL OR scope_type IN ('self', 'assigned', 'organization', 'organization_tree', 'governorate', 'sector', 'national')),

  -- Semantics: ALLOW requires an explicit scope_type; DENY must have NULL scope_type (total revocation)
  CONSTRAINT chk_user_perm_overrides_scope_semantics
    CHECK (
      (effect = 'allow' AND scope_type IS NOT NULL)
      OR
      (effect = 'deny' AND scope_type IS NULL)
    )
);

-- Note: uq_user_perm_overrides_user_perm already indexes (user_id, permission_key) with user_id as leading column.
-- We index permission_key to support reverse queries (which users have overrides on a specific permission):
CREATE INDEX idx_user_perm_overrides_perm
  ON public.user_permission_overrides (permission_key);

CREATE INDEX idx_user_perm_overrides_active
  ON public.user_permission_overrides (is_active);

DROP TRIGGER IF EXISTS trg_user_perm_overrides_updated_at ON public.user_permission_overrides;
CREATE TRIGGER trg_user_perm_overrides_updated_at
  BEFORE UPDATE ON public.user_permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.rbac_set_updated_at();

-- ------------------------------------------------------------------------------
-- 7. Table: public.access_admin_audit
-- Immutable append-only audit trail for administrative RBAC mutations.
-- Fail-closed: Foreign keys use ON DELETE RESTRICT to preserve referential evidence.
-- Audited entities (users, roles, permissions) must be deactivated (is_active = FALSE),
-- not hard-deleted.
-- ------------------------------------------------------------------------------
CREATE TABLE public.access_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_user_id UUID NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  target_role_id UUID NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  target_permission_key TEXT NULL REFERENCES public.permissions(key) ON DELETE RESTRICT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_audit_actor
  ON public.access_admin_audit (actor_user_id);

CREATE INDEX idx_access_audit_target_user
  ON public.access_admin_audit (target_user_id);

CREATE INDEX idx_access_audit_target_role
  ON public.access_admin_audit (target_role_id);

CREATE INDEX idx_access_audit_created
  ON public.access_admin_audit (created_at DESC);

-- Enforce DB-level Immutability: Block UPDATE and DELETE on access_admin_audit
DROP TRIGGER IF EXISTS trg_access_admin_audit_immutable ON public.access_admin_audit;
CREATE TRIGGER trg_access_admin_audit_immutable
  BEFORE UPDATE OR DELETE ON public.access_admin_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.rbac_prevent_audit_mutation();

-- ------------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Posture: Default-Deny
-- Enable RLS across all six RBAC tables.
-- Public/authenticated client access is denied by default.
-- In V2 architecture:
-- Browser -> Next.js Server (Auth Context) -> Central Authorization Service ->
-- Server-only Service Role access to RBAC tables.
-- Zero direct client SELECT policies are granted.
-- ------------------------------------------------------------------------------
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_admin_audit ENABLE ROW LEVEL SECURITY;

COMMIT;
