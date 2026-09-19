-- ==============================================================================
-- Script 49: Complete facility-management grants for system administrators
-- - Keeps privilege-escalation protection intact
-- - Allows the two highest system roles to delegate the Information Center role
-- - Grants facility deactivate/audit nationally to those administrators
-- ==============================================================================

BEGIN;

INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  grants.permission_key,
  'national'
FROM public.roles r
CROSS JOIN (
  VALUES
    ('facilities.deactivate'),
    ('facilities.audit')
) AS grants(permission_key)
WHERE r.code IN ('system_techadmin', 'system_superadmin')
  AND r.is_active IS TRUE
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

COMMIT;
