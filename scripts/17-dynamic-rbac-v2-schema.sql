-- ==============================================================================
-- Script 17: Dynamic Role-Based Access Control (RBAC) V2 Core Schema Design
-- Phase: Phase 3B — Dynamic RBAC Database Schema DESIGN ONLY
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
-- 3. Zero destructive operations: NO DROP TABLE, NO DROP COLUMN, NO TRUNCATE.
-- 4. Multi-role assignment per user supported with clean validity date ranges.
-- 5. Explicit DENY user-level overrides take absolute precedence over grants.
-- 6. Row Level Security (RLS) enabled on all tables with Default-Deny posture.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Helper Function: Timestamp Automation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rbac_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. Table: public.permissions
-- Central registry of discrete, machine-stable system capabilities.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
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

  -- Ensure uniqueness of module and action combinations
  CONSTRAINT uq_permissions_module_action
    UNIQUE (module, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_module_action
  ON public.permissions (module, action);

CREATE INDEX IF NOT EXISTS idx_permissions_active_sort
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
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  description_ar TEXT,
  owner_organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 100,
  created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Format constraint: snake_case alphanumeric codes (e.g. sector_manager)
  CONSTRAINT chk_roles_code_format
    CHECK (code ~ '^[a-z][a-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS idx_roles_owner_org
  ON public.roles (owner_organization_id);

CREATE INDEX IF NOT EXISTS idx_roles_active_priority
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
CREATE TABLE IF NOT EXISTS public.role_permission_grants (
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

CREATE INDEX IF NOT EXISTS idx_role_perm_grants_role
  ON public.role_permission_grants (role_id);

CREATE INDEX IF NOT EXISTS idx_role_perm_grants_perm
  ON public.role_permission_grants (permission_key);

-- ------------------------------------------------------------------------------
-- 5. Table: public.user_roles
-- Multi-role assignment of users to roles, bound to an optional organizational assignment.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assignment_org_id UUID NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
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

-- Prevent duplicate active assignment of the same role to the same user in the same organization.
-- Uses a PostgreSQL-compatible COALESCE expression unique index to safely handle NULL assignment_org_id values.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_user_role_org
  ON public.user_roles (user_id, role_id, COALESCE(assignment_org_id, '00000000-0000-0000-0000-000000000000'::uuid));


CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON public.user_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON public.user_roles (role_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_org
  ON public.user_roles (assignment_org_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_active_dates
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
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
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

CREATE INDEX IF NOT EXISTS idx_user_perm_overrides_user
  ON public.user_permission_overrides (user_id);

CREATE INDEX IF NOT EXISTS idx_user_perm_overrides_perm
  ON public.user_permission_overrides (permission_key);

CREATE INDEX IF NOT EXISTS idx_user_perm_overrides_active
  ON public.user_permission_overrides (is_active);

DROP TRIGGER IF EXISTS trg_user_perm_overrides_updated_at ON public.user_permission_overrides;
CREATE TRIGGER trg_user_perm_overrides_updated_at
  BEFORE UPDATE ON public.user_permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.rbac_set_updated_at();

-- ------------------------------------------------------------------------------
-- 7. Table: public.access_admin_audit
-- Immutable append-only audit trail for administrative RBAC mutations.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  target_role_id UUID NULL REFERENCES public.roles(id) ON DELETE SET NULL,
  target_permission_key TEXT NULL REFERENCES public.permissions(key) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_audit_actor
  ON public.access_admin_audit (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_access_audit_target_user
  ON public.access_admin_audit (target_user_id);

CREATE INDEX IF NOT EXISTS idx_access_audit_target_role
  ON public.access_admin_audit (target_role_id);

CREATE INDEX IF NOT EXISTS idx_access_audit_created
  ON public.access_admin_audit (created_at DESC);

-- ------------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Posture: Default-Deny
-- Enable RLS across all six RBAC tables.
-- Public/authenticated client access is denied by default until Phase 3C.
-- Backend queries using Supabase Service Role bypass RLS securely.
-- ------------------------------------------------------------------------------
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_admin_audit ENABLE ROW LEVEL SECURITY;

COMMIT;
