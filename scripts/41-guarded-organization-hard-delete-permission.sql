-- ==============================================================================
-- Script 41: Clarify guarded organization hard-delete permission
-- ==============================================================================

BEGIN;

UPDATE public.permissions
SET
  display_name_ar = 'حذف جهة غير مستخدمة نهائيًا',
  description_ar = 'حذف نهائي لجهة أضيفت بالخطأ بشرط عدم وجود أي سجلات أو روابط تاريخية مرتبطة بها',
  is_sensitive = TRUE,
  updated_at = NOW()
WHERE key = 'organizations.delete';

INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  'organizations.delete',
  'national'
FROM public.roles r
WHERE r.code = 'system_superadmin'
  AND r.is_active IS TRUE
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

COMMIT;
