-- ==============================================================================
-- Script 33: Facility management foundation
-- - Information Center system role
-- - Facility deactivate/audit permissions
-- - Immutable-style facility change audit store (server-only)
-- - Facility completed-visit statistics view
-- ==============================================================================

BEGIN;

INSERT INTO public.permissions (
  key, module, action, display_name_ar, description_ar,
  is_sensitive, is_active, sort_order
)
VALUES
  (
    'facilities.deactivate',
    'facilities',
    'deactivate',
    'إيقاف وإعادة تفعيل المنشأة',
    'السماح بإيقاف المنشأة أو إعادة تفعيلها مع الاحتفاظ بكامل تاريخها ومأمورياتها',
    TRUE,
    TRUE,
    530
  ),
  (
    'facilities.audit',
    'facilities',
    'audit',
    'عرض سجل تعديلات المنشأة',
    'السماح بالاطلاع على تاريخ تصحيح وتعديل بيانات المنشأة ومن قام بالتغيير',
    TRUE,
    TRUE,
    540
  )
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  display_name_ar = EXCLUDED.display_name_ar,
  description_ar = EXCLUDED.description_ar,
  is_sensitive = EXCLUDED.is_sensitive,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO public.roles (
  code,
  name_ar,
  description_ar,
  owner_organization_id,
  is_system,
  is_active,
  priority
)
VALUES (
  'information_center',
  'مسؤول مركز معلومات',
  'إدارة الحسابات والدعم التشغيلي وتصحيح بيانات المنشآت داخل النطاق الإداري المسموح.',
  NULL,
  TRUE,
  TRUE,
  65
)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  description_ar = EXCLUDED.description_ar,
  is_system = TRUE,
  is_active = TRUE,
  priority = EXCLUDED.priority,
  updated_at = NOW();

INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  grants.permission_key,
  grants.scope_type
FROM public.roles r
CROSS JOIN (
  VALUES
    ('dashboard.view', 'organization_tree'),
    ('organizations.view', 'organization_tree'),
    ('users.view', 'organization_tree'),
    ('users.create', 'organization_tree'),
    ('users.edit', 'organization_tree'),
    ('users.deactivate', 'organization_tree'),
    ('users.reset_password', 'organization_tree'),
    ('users.assign_role', 'organization_tree'),
    ('facilities.view', 'national'),
    ('facilities.create', 'organization_tree'),
    ('facilities.edit', 'organization_tree'),
    ('facilities.deactivate', 'organization_tree'),
    ('facilities.audit', 'organization_tree')
) AS grants(permission_key, scope_type)
WHERE r.code = 'information_center'
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

CREATE TABLE IF NOT EXISTS public.facility_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  actor_organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT NULL,
  before_data JSONB NULL,
  after_data JSONB NULL,
  changed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_facility_change_audit_action
    CHECK (action IN ('create', 'update', 'deactivate', 'reactivate', 'merge'))
);

CREATE INDEX IF NOT EXISTS idx_facility_change_audit_facility_created
  ON public.facility_change_audit (facility_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_facility_change_audit_actor_created
  ON public.facility_change_audit (actor_user_id, created_at DESC);

ALTER TABLE public.facility_change_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.facility_change_audit FROM PUBLIC;
REVOKE ALL ON TABLE public.facility_change_audit FROM anon;
REVOKE ALL ON TABLE public.facility_change_audit FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.facility_change_audit TO service_role;

CREATE OR REPLACE VIEW public.facility_visit_stats
WITH (security_invoker = true)
AS
SELECT
  f.id AS facility_id,
  COUNT(m.id) FILTER (
    WHERE m.status IN ('completed', 'closed', 'done', 'منفذة')
  )::BIGINT AS completed_visits,
  MAX(COALESCE(m.completed_at, m.scheduled_date::timestamptz)) FILTER (
    WHERE m.status IN ('completed', 'closed', 'done', 'منفذة')
  ) AS last_completed_visit_at
FROM public.facilities f
LEFT JOIN public.missions m
  ON COALESCE(m.target_facility_id, m.facility_id) = f.id
GROUP BY f.id;

REVOKE ALL ON TABLE public.facility_visit_stats FROM PUBLIC;
REVOKE ALL ON TABLE public.facility_visit_stats FROM anon;
REVOKE ALL ON TABLE public.facility_visit_stats FROM authenticated;
GRANT SELECT ON TABLE public.facility_visit_stats TO service_role;

COMMIT;
