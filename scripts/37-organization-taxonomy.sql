-- ==============================================================================
-- Script 37: Organization taxonomy independent from hierarchy depth
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.organization_types (
  code TEXT PRIMARY KEY,
  display_name_ar TEXT NOT NULL,
  description_ar TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_type_relations (
  parent_type_code TEXT NOT NULL
    REFERENCES public.organization_types(code) ON DELETE CASCADE,
  child_type_code TEXT NOT NULL
    REFERENCES public.organization_types(code) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parent_type_code, child_type_code),
  CONSTRAINT chk_org_type_relation_not_self
    CHECK (parent_type_code <> child_type_code)
);

INSERT INTO public.organization_types (
  code, display_name_ar, description_ar, sort_order
)
VALUES
  ('ministry', 'الوزارة', 'ديوان وزارة الصحة والسكان', 10),
  ('sector', 'قطاع', 'قطاع مركزي بديوان الوزارة', 20),
  ('central_administration', 'إدارة مركزية', 'إدارة مركزية بالديوان', 30),
  ('general_administration', 'إدارة عامة', 'إدارة عامة داخل الديوان أو المديرية', 40),
  ('administration', 'إدارة', 'إدارة إدارية أو فنية', 50),
  ('department', 'قسم', 'قسم إداري أو فني', 60),
  ('section', 'وحدة تنظيمية / شعبة', 'وحدة تنظيمية أصغر داخل الإدارة أو القسم', 70),
  ('health_directorate', 'مديرية الشؤون الصحية', 'ديوان مديرية الشؤون الصحية بالمحافظة', 80),
  ('health_administration', 'إدارة صحية', 'الإدارة الصحية الجغرافية التابعة للمديرية', 90)
ON CONFLICT (code) DO UPDATE SET
  display_name_ar = EXCLUDED.display_name_ar,
  description_ar = EXCLUDED.description_ar,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO public.organization_type_relations (
  parent_type_code, child_type_code
)
VALUES
  ('ministry', 'sector'),
  ('ministry', 'central_administration'),
  ('ministry', 'general_administration'),
  ('ministry', 'health_directorate'),

  ('sector', 'central_administration'),
  ('sector', 'general_administration'),
  ('sector', 'administration'),

  ('central_administration', 'general_administration'),
  ('central_administration', 'administration'),

  ('general_administration', 'administration'),
  ('general_administration', 'department'),
  ('general_administration', 'section'),

  ('administration', 'department'),
  ('administration', 'section'),

  ('department', 'section'),

  ('health_directorate', 'general_administration'),
  ('health_directorate', 'administration'),
  ('health_directorate', 'department'),
  ('health_directorate', 'section'),
  ('health_directorate', 'health_administration'),

  ('health_administration', 'administration'),
  ('health_administration', 'department'),
  ('health_administration', 'section')
ON CONFLICT (parent_type_code, child_type_code) DO UPDATE
SET is_active = TRUE;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS organization_type_code TEXT NULL;

UPDATE public.organizations
SET organization_type_code = CASE
  WHEN level_label = 'ministry' THEN 'ministry'
  WHEN level_label = 'sector' THEN 'sector'
  WHEN level_label = 'central_admin' THEN 'central_administration'
  WHEN level_label = 'general_admin' THEN 'general_administration'
  WHEN level_label = 'directorate' THEN 'health_directorate'
  WHEN level_label = 'health_admin'
       AND (
         NULLIF(BTRIM(health_admin), '') IS NOT NULL
         OR name LIKE 'الإدارة الصحية%'
         OR name LIKE 'ادارة صحية%'
         OR name LIKE 'إدارة صحية%'
       )
    THEN 'health_administration'
  WHEN level_label = 'health_admin' THEN 'administration'
  ELSE 'administration'
END
WHERE organization_type_code IS NULL;

ALTER TABLE public.organizations
  ALTER COLUMN organization_type_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_organization_type_code_fkey'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_organization_type_code_fkey
      FOREIGN KEY (organization_type_code)
      REFERENCES public.organization_types(code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_type_code
  ON public.organizations (organization_type_code);

CREATE OR REPLACE FUNCTION public.validate_organization_type_relation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_parent_type TEXT;
BEGIN
  IF NEW.organization_type_code = 'ministry' THEN
    IF NEW.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Ministry organization cannot have a parent';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.parent_id IS NULL THEN
    RAISE EXCEPTION 'Non-ministry organization requires a parent';
  END IF;

  SELECT organization_type_code
  INTO v_parent_type
  FROM public.organizations
  WHERE id = NEW.parent_id
    AND is_active IS TRUE;

  IF v_parent_type IS NULL THEN
    RAISE EXCEPTION 'Parent organization not found or inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_type_relations relation
    WHERE relation.parent_type_code = v_parent_type
      AND relation.child_type_code = NEW.organization_type_code
      AND relation.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION
      'Organization type % is not allowed under parent type %',
      NEW.organization_type_code,
      v_parent_type;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_organization_type_relation
  ON public.organizations;

CREATE TRIGGER trg_validate_organization_type_relation
BEFORE INSERT OR UPDATE OF parent_id, organization_type_code
ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.validate_organization_type_relation();

ALTER TABLE public.organization_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_type_relations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.organization_types FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.organization_type_relations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.organization_types TO service_role;
GRANT SELECT ON TABLE public.organization_type_relations TO service_role;

COMMIT;
