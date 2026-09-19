-- ==============================================================================
-- Script 64: Complete assigned mission-team read/execute permission bundle
-- ==============================================================================
BEGIN;

INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  p.permission_key,
  'assigned'
FROM public.roles r
CROSS JOIN (
  VALUES
    ('missions.view'),
    ('mission_results.view'),
    ('checklists.view')
) AS p(permission_key)
WHERE r.code IN (
  'system_superadmin',
  'sector_manager',
  'central_admin_manager',
  'general_admin_manager',
  'directorate_manager',
  'health_admin_manager',
  'information_center',
  'field_inspector'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  'checklists.library',
  'national'
FROM public.roles r
WHERE r.code = 'system_techadmin'
ON CONFLICT (role_id, permission_key) DO NOTHING;

COMMIT;
