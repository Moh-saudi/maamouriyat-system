-- ==============================================================================
-- Script 55: Correction specialties and generic correction-unit roles
-- ==============================================================================
BEGIN;

-- 1) Canonical correction-specialty catalog.
CREATE TABLE IF NOT EXISTS public.correction_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL UNIQUE,
  description_ar TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT correction_specialties_code_format
    CHECK (code ~ '^[a-z][a-z0-9_]*$')
);

INSERT INTO public.correction_specialties (
  code,
  name_ar,
  description_ar,
  sort_order
)
VALUES
  (
    'technology_information_systems',
    'تقنية المعلومات والحاسب والشبكات',
    'أجهزة الحاسب والطابعات والشبكات والاتصال والأنظمة والتطبيقات والدعم التقني.',
    10
  ),
  (
    'infection_control',
    'مكافحة العدوى',
    'الملاحظات المتعلقة بسياسات وإجراءات مكافحة العدوى داخل المنشآت الصحية.',
    20
  ),
  (
    'pharmacy_supplies',
    'الصيدلة والمستلزمات',
    'الأدوية والمستلزمات الطبية والتخزين والصرف وما يرتبط بها.',
    30
  ),
  (
    'medical_equipment_maintenance',
    'صيانة الأجهزة الطبية',
    'أعطال وصيانة ومعايرة الأجهزة والمعدات الطبية.',
    40
  ),
  (
    'engineering_maintenance',
    'الصيانة الهندسية والمرافق',
    'المباني والكهرباء والمياه والتكييف والمرافق والأعمال الهندسية.',
    50
  ),
  (
    'quality',
    'الجودة',
    'متطلبات الجودة والتحسين المستمر وسياسات جودة الخدمة.',
    60
  ),
  (
    'occupational_safety',
    'السلامة والصحة المهنية',
    'السلامة المهنية ومخاطر بيئة العمل وإجراءات الوقاية.',
    70
  ),
  (
    'licensing',
    'التراخيص',
    'التراخيص والاشتراطات التنظيمية المرتبطة بتشغيل المنشأة أو الخدمة.',
    80
  ),
  (
    'human_resources_attendance',
    'الموارد البشرية والحضور والانصراف',
    'الحضور والانصراف والغياب وشؤون العاملين ذات الصلة.',
    90
  ),
  (
    'administrative_affairs',
    'الشؤون الإدارية',
    'الإجراءات والشؤون الإدارية والخدمات الإدارية داخل الجهة.',
    100
  ),
  (
    'financial_affairs',
    'الشؤون المالية',
    'الملاحظات المالية والإجراءات ذات الصلة بالعمل المالي.',
    110
  ),
  (
    'legal_affairs',
    'الشؤون القانونية',
    'الملاحظات التي تستلزم مراجعة أو إجراء قانونيًا.',
    120
  ),
  (
    'security_safety',
    'الأمن والسلامة',
    'الأمن الداخلي وإجراءات السلامة والحماية غير الطبية.',
    130
  ),
  (
    'nutrition',
    'التغذية',
    'التغذية والخدمات الغذائية والاشتراطات المرتبطة بها.',
    140
  ),
  (
    'medical_waste',
    'النفايات الطبية',
    'فرز وتداول وتخزين والتخلص من النفايات الطبية.',
    150
  )
ON CONFLICT (code) DO UPDATE
SET
  name_ar = EXCLUDED.name_ar,
  description_ar = EXCLUDED.description_ar,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

ALTER TABLE public.correction_specialties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS correction_specialties_select_authenticated
  ON public.correction_specialties;

CREATE POLICY correction_specialties_select_authenticated
  ON public.correction_specialties
  FOR SELECT
  TO authenticated
  USING (is_active IS TRUE);

REVOKE INSERT, UPDATE, DELETE
  ON public.correction_specialties
  FROM anon, authenticated;

-- 2) Link a real organization to one or more correction specialties and define
-- the organizational scope that this unit serves.
CREATE TABLE IF NOT EXISTS public.organization_correction_specialties (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  specialty_id UUID NOT NULL REFERENCES public.correction_specialties(id) ON DELETE RESTRICT,
  service_scope_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, specialty_id, service_scope_org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_correction_specialties_org
  ON public.organization_correction_specialties(organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_correction_specialties_scope
  ON public.organization_correction_specialties(
    service_scope_org_id,
    specialty_id,
    is_active
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_primary_correction_unit_per_scope_specialty
  ON public.organization_correction_specialties(
    service_scope_org_id,
    specialty_id
  )
  WHERE is_active IS TRUE AND is_primary IS TRUE;

ALTER TABLE public.organization_correction_specialties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_correction_specialties_select_authenticated
  ON public.organization_correction_specialties;

CREATE POLICY organization_correction_specialties_select_authenticated
  ON public.organization_correction_specialties
  FOR SELECT
  TO authenticated
  USING (is_active IS TRUE);

REVOKE INSERT, UPDATE, DELETE
  ON public.organization_correction_specialties
  FROM anon, authenticated;

-- A correction unit must sit inside the organizational scope that it serves.
CREATE OR REPLACE FUNCTION public.validate_correction_specialty_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_valid BOOLEAN := FALSE;
BEGIN
  WITH RECURSIVE ancestry AS (
    SELECT
      o.id,
      o.parent_id,
      0 AS depth,
      ARRAY[o.id]::UUID[] AS path
    FROM public.organizations o
    WHERE o.id = NEW.organization_id

    UNION ALL

    SELECT
      parent.id,
      parent.parent_id,
      ancestry.depth + 1,
      ancestry.path || parent.id
    FROM ancestry
    JOIN public.organizations parent
      ON parent.id = ancestry.parent_id
    WHERE ancestry.depth < 30
      AND NOT parent.id = ANY(ancestry.path)
  )
  SELECT EXISTS (
    SELECT 1
    FROM ancestry
    WHERE id = NEW.service_scope_org_id
  )
  INTO v_valid;

  IF v_valid IS NOT TRUE THEN
    RAISE EXCEPTION
      'Correction unit must belong to the organization scope that it serves';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_correction_specialty_scope
  ON public.organization_correction_specialties;

CREATE TRIGGER trg_validate_correction_specialty_scope
BEFORE INSERT OR UPDATE OF organization_id, service_scope_org_id
ON public.organization_correction_specialties
FOR EACH ROW
EXECUTE FUNCTION public.validate_correction_specialty_scope();

-- 3) Routing rules now resolve by specialty + service scope rather than by
-- hard-coded department names or a role name.
ALTER TABLE public.correction_routing_rules
  ADD COLUMN IF NOT EXISTS specialty_id UUID
    REFERENCES public.correction_specialties(id) ON DELETE RESTRICT;

ALTER TABLE public.correction_routing_rules
  DROP CONSTRAINT IF EXISTS correction_routing_rules_resolution_strategy_check;

ALTER TABLE public.correction_routing_rules
  ADD CONSTRAINT correction_routing_rules_resolution_strategy_check
  CHECK (
    resolution_strategy IN (
      'specialty_scope',
      'nearest_role_assignment',
      'explicit_organization',
      'manual'
    )
  );

INSERT INTO public.correction_routing_rules (
  category_code,
  category_name_ar,
  specialty_id,
  target_role_code,
  target_organization_id,
  resolution_strategy,
  sort_order
)
SELECT
  s.code,
  s.name_ar,
  s.id,
  NULL,
  NULL,
  'specialty_scope',
  s.sort_order
FROM public.correction_specialties s
WHERE s.is_active IS TRUE
ON CONFLICT (category_code) DO UPDATE
SET
  category_name_ar = EXCLUDED.category_name_ar,
  specialty_id = EXCLUDED.specialty_id,
  target_role_code = NULL,
  resolution_strategy = 'specialty_scope',
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- 4) Resolve the nearest correction unit for a facility/category.
-- "Nearest" refers to the narrowest service scope containing the facility.
CREATE OR REPLACE FUNCTION public.resolve_correction_route(
  p_facility_id UUID,
  p_category_code TEXT
)
RETURNS TABLE (
  organization_id UUID,
  service_scope_org_id UUID,
  specialty_id UUID,
  specialty_code TEXT,
  resolution_strategy TEXT,
  matched_scope_depth INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  WITH RECURSIVE
  rule AS (
    SELECT
      r.specialty_id,
      r.target_organization_id,
      r.resolution_strategy
    FROM public.correction_routing_rules r
    WHERE r.category_code = p_category_code
      AND r.is_active IS TRUE
    LIMIT 1
  ),
  facility_org AS (
    SELECT f.organization_id
    FROM public.facilities f
    WHERE f.id = p_facility_id
      AND f.is_active IS TRUE
  ),
  ancestors AS (
    SELECT
      o.id,
      o.parent_id,
      0 AS depth,
      ARRAY[o.id]::UUID[] AS path
    FROM public.organizations o
    JOIN facility_org f
      ON f.organization_id = o.id

    UNION ALL

    SELECT
      parent.id,
      parent.parent_id,
      ancestors.depth + 1,
      ancestors.path || parent.id
    FROM ancestors
    JOIN public.organizations parent
      ON parent.id = ancestors.parent_id
    WHERE ancestors.depth < 30
      AND NOT parent.id = ANY(ancestors.path)
  ),
  specialty_match AS (
    SELECT
      mapping.organization_id,
      mapping.service_scope_org_id,
      mapping.specialty_id,
      specialty.code AS specialty_code,
      rule.resolution_strategy,
      ancestors.depth AS matched_scope_depth,
      mapping.is_primary
    FROM rule
    JOIN ancestors
      ON rule.resolution_strategy = 'specialty_scope'
    JOIN public.organization_correction_specialties mapping
      ON mapping.service_scope_org_id = ancestors.id
     AND mapping.specialty_id = rule.specialty_id
     AND mapping.is_active IS TRUE
    JOIN public.correction_specialties specialty
      ON specialty.id = mapping.specialty_id
     AND specialty.is_active IS TRUE
    JOIN public.organizations correction_org
      ON correction_org.id = mapping.organization_id
     AND correction_org.is_active IS TRUE
     AND correction_org.lifecycle_status = 'active'
    ORDER BY
      ancestors.depth ASC,
      mapping.is_primary DESC,
      correction_org.name ASC
    LIMIT 1
  ),
  explicit_match AS (
    SELECT
      rule.target_organization_id AS organization_id,
      rule.target_organization_id AS service_scope_org_id,
      rule.specialty_id,
      specialty.code AS specialty_code,
      rule.resolution_strategy,
      0 AS matched_scope_depth,
      TRUE AS is_primary
    FROM rule
    LEFT JOIN public.correction_specialties specialty
      ON specialty.id = rule.specialty_id
    JOIN public.organizations correction_org
      ON correction_org.id = rule.target_organization_id
     AND correction_org.is_active IS TRUE
     AND correction_org.lifecycle_status = 'active'
    WHERE rule.resolution_strategy = 'explicit_organization'
  )
  SELECT
    result.organization_id,
    result.service_scope_org_id,
    result.specialty_id,
    result.specialty_code,
    result.resolution_strategy,
    result.matched_scope_depth
  FROM (
    SELECT * FROM specialty_match
    UNION ALL
    SELECT * FROM explicit_match
  ) result
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.resolve_correction_route(UUID, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_correction_route(UUID, TEXT)
  FROM anon;
REVOKE ALL ON FUNCTION public.resolve_correction_route(UUID, TEXT)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_correction_route(UUID, TEXT)
  TO service_role;

-- 5) Generic correction-unit roles. The specialty comes from the organization,
-- not from the role name.
INSERT INTO public.roles (
  code,
  name_ar,
  description_ar,
  owner_organization_id,
  is_system,
  is_active,
  priority
)
VALUES
  (
    'correction_unit_manager',
    'مسؤول جهة تصحيح',
    'إدارة الملاحظات الموجهة إلى الجهة وتوزيعها داخليًا ومتابعة تنفيذ التصحيح دون اعتماد التحقق النهائي.',
    NULL,
    TRUE,
    TRUE,
    72
  ),
  (
    'correction_unit_member',
    'عضو جهة تصحيح',
    'استلام الملاحظات الموجهة إلى الجهة وتنفيذ التصحيح وتوثيق ما تم دون صلاحية التحقق النهائي أو الإغلاق.',
    NULL,
    TRUE,
    TRUE,
    75
  )
ON CONFLICT (code) DO UPDATE
SET
  name_ar = EXCLUDED.name_ar,
  description_ar = EXCLUDED.description_ar,
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
  grant_row.permission_key,
  grant_row.scope_type
FROM public.roles r
CROSS JOIN (
  VALUES
    ('dashboard.view', 'organization'),
    ('violations.view', 'organization'),
    ('violations.correct', 'organization')
) AS grant_row(permission_key, scope_type)
WHERE r.code IN ('correction_unit_manager', 'correction_unit_member')
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  'violations.assign',
  'organization'
FROM public.roles r
WHERE r.code = 'correction_unit_manager'
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

-- Explicitly ensure correction roles cannot verify/close/cancel by stale grants.
DELETE FROM public.role_permission_grants g
USING public.roles r
WHERE g.role_id = r.id
  AND r.code IN ('correction_unit_manager', 'correction_unit_member')
  AND g.permission_key IN (
    'violations.verify',
    'violations.close',
    'violations.cancel'
  );

-- 6) Management permissions for specialty mappings.
INSERT INTO public.permissions (
  key,
  module,
  action,
  display_name_ar,
  description_ar,
  is_sensitive,
  is_active,
  sort_order
)
VALUES
  (
    'organizations.view_correction_specialties',
    'organizations',
    'view_correction_specialties',
    'عرض اختصاصات جهات التصحيح',
    'عرض اختصاصات التصحيح ونطاق الخدمة المرتبط بكل جهة تنظيمية.',
    FALSE,
    TRUE,
    75
  ),
  (
    'organizations.manage_correction_specialties',
    'organizations',
    'manage_correction_specialties',
    'إدارة اختصاصات جهات التصحيح',
    'ربط جهة تنظيمية باختصاص تصحيح وتحديد النطاق التنظيمي الذي تخدمه.',
    TRUE,
    TRUE,
    76
  )
ON CONFLICT (key) DO UPDATE
SET
  display_name_ar = EXCLUDED.display_name_ar,
  description_ar = EXCLUDED.description_ar,
  is_sensitive = EXCLUDED.is_sensitive,
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  grant_row.permission_key,
  CASE r.code
    WHEN 'system_superadmin' THEN 'national'
    WHEN 'system_techadmin' THEN 'national'
    WHEN 'directorate_manager' THEN 'governorate'
    WHEN 'health_admin_manager' THEN 'organization_tree'
  END
FROM public.roles r
CROSS JOIN (
  VALUES
    ('organizations.view_correction_specialties'),
    ('organizations.manage_correction_specialties')
) AS grant_row(permission_key)
WHERE r.code IN (
  'system_superadmin',
  'system_techadmin',
  'directorate_manager',
  'health_admin_manager'
)
  AND r.is_active IS TRUE
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

-- Information Center may view specialty configuration in its management scope
-- but does not define regulatory specialties by itself.
INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  'organizations.view_correction_specialties',
  'organization_tree'
FROM public.roles r
WHERE r.code = 'information_center'
  AND r.is_active IS TRUE
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

-- 7) Backfill existing Information Center organizations as technology
-- correction units. Service scope resolves to the nearest health
-- administration/directorate/ministry ancestor.
WITH RECURSIVE
info_assignments AS (
  SELECT DISTINCT
    COALESCE(ur.assignment_org_id, u.organization_id) AS correction_org_id
  FROM public.user_roles ur
  JOIN public.roles r
    ON r.id = ur.role_id
   AND r.code = 'information_center'
  JOIN public.users u
    ON u.id = ur.user_id
  WHERE ur.is_active IS TRUE
    AND (ur.valid_until IS NULL OR ur.valid_until > NOW())
    AND COALESCE(ur.assignment_org_id, u.organization_id) IS NOT NULL
),
ancestry AS (
  SELECT
    ia.correction_org_id,
    o.id,
    o.parent_id,
    o.organization_type_code,
    0 AS depth,
    ARRAY[o.id]::UUID[] AS path
  FROM info_assignments ia
  JOIN public.organizations o
    ON o.id = ia.correction_org_id

  UNION ALL

  SELECT
    ancestry.correction_org_id,
    parent.id,
    parent.parent_id,
    parent.organization_type_code,
    ancestry.depth + 1,
    ancestry.path || parent.id
  FROM ancestry
  JOIN public.organizations parent
    ON parent.id = ancestry.parent_id
  WHERE ancestry.depth < 30
    AND NOT parent.id = ANY(ancestry.path)
),
resolved_scope AS (
  SELECT DISTINCT ON (correction_org_id)
    correction_org_id,
    id AS service_scope_org_id
  FROM ancestry
  WHERE organization_type_code IN (
    'health_administration',
    'health_directorate',
    'ministry'
  )
  ORDER BY correction_org_id, depth ASC
),
tech_specialty AS (
  SELECT id
  FROM public.correction_specialties
  WHERE code = 'technology_information_systems'
)
INSERT INTO public.organization_correction_specialties (
  organization_id,
  specialty_id,
  service_scope_org_id,
  is_primary,
  is_active
)
SELECT
  resolved_scope.correction_org_id,
  tech_specialty.id,
  resolved_scope.service_scope_org_id,
  TRUE,
  TRUE
FROM resolved_scope
CROSS JOIN tech_specialty
ON CONFLICT (
  organization_id,
  specialty_id,
  service_scope_org_id
) DO UPDATE
SET
  is_primary = TRUE,
  is_active = TRUE,
  updated_at = NOW();

COMMIT;
