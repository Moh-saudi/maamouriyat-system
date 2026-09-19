-- ==============================================================================
-- Script 51: Parent-controlled child organization creation
-- - Capability belongs to the PARENT organization, not to a user role
-- - User still needs organizations.create and must be inside RBAC scope
-- - Information Center receives scoped create permission, but creation remains
--   impossible unless the selected parent explicitly enables the capability
-- ==============================================================================

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS can_create_child_organizations BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.organizations.can_create_child_organizations IS
  'Parent capability only. Allows in-scope users who already hold organizations.create to create direct child organizations.';

INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  'organizations.create',
  'organization_tree'
FROM public.roles r
WHERE r.code = 'information_center'
  AND r.is_active IS TRUE
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

COMMIT;
