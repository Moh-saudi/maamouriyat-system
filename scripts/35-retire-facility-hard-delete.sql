-- ==============================================================================
-- Script 35: Retire destructive facility deletion
-- Facility history must be preserved. Use facilities.deactivate instead.
-- ==============================================================================

BEGIN;

UPDATE public.permissions
SET
  is_active = FALSE,
  display_name_ar = 'حذف منشأة نهائيًا — غير مستخدم',
  description_ar = 'صلاحية قديمة موقوفة. تُحفظ المنشآت تاريخيًا ويُستخدم الإيقاف وإعادة التفعيل بدل الحذف النهائي.',
  updated_at = NOW()
WHERE key = 'facilities.delete';

DELETE FROM public.role_permission_grants
WHERE permission_key = 'facilities.delete';

COMMIT;
