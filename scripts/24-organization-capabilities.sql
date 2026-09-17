-- ==============================================================================
-- Script 24: Organization Capabilities Foundation
-- Phase: 3F — API Enforcement prerequisite
--
-- These flags describe what an ORGANIZATION is structurally allowed to do.
-- They are not employee roles and do not replace RBAC permissions.
--
-- Final authorization will require:
--   user permission AND data scope AND organization capability
-- ==============================================================================

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS can_issue_missions BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_approve_missions BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_view_all_governorate BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_view_sector_facilities BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.organizations.can_issue_missions IS
  'Organization capability only; does not grant user permission by itself.';

COMMENT ON COLUMN public.organizations.can_approve_missions IS
  'Organization capability only; does not grant user permission by itself.';

COMMENT ON COLUMN public.organizations.can_view_all_governorate IS
  'Organization capability only; does not grant user permission by itself.';

COMMENT ON COLUMN public.organizations.can_view_sector_facilities IS
  'Organization capability only; does not grant user permission by itself.';

COMMIT;
