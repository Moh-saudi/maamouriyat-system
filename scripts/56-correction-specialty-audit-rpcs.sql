-- ==============================================================================
-- Script 56: Atomic correction-specialty management with audit
-- ==============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.organization_correction_specialty_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  specialty_id UUID NOT NULL REFERENCES public.correction_specialties(id) ON DELETE RESTRICT,
  service_scope_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  action_code TEXT NOT NULL,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (action_code IN ('create', 'update', 'deactivate'))
);

CREATE INDEX IF NOT EXISTS idx_org_correction_specialty_audit_org
  ON public.organization_correction_specialty_audit(
    organization_id,
    created_at DESC
  );

ALTER TABLE public.organization_correction_specialty_audit
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_correction_specialty_audit_select_authenticated
  ON public.organization_correction_specialty_audit;

CREATE POLICY organization_correction_specialty_audit_select_authenticated
  ON public.organization_correction_specialty_audit
  FOR SELECT
  TO authenticated
  USING (TRUE);

REVOKE INSERT, UPDATE, DELETE
  ON public.organization_correction_specialty_audit
  FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_organization_correction_specialty(
  p_actor_user_id UUID,
  p_organization_id UUID,
  p_specialty_id UUID,
  p_service_scope_org_id UUID,
  p_is_primary BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_action TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = p_organization_id
      AND is_active IS TRUE
      AND lifecycle_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Correction organization not found or inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = p_service_scope_org_id
      AND is_active IS TRUE
      AND lifecycle_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Service scope organization not found or inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.correction_specialties
    WHERE id = p_specialty_id
      AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Correction specialty not found or inactive';
  END IF;

  SELECT to_jsonb(mapping)
  INTO v_before
  FROM public.organization_correction_specialties mapping
  WHERE mapping.organization_id = p_organization_id
    AND mapping.specialty_id = p_specialty_id
    AND mapping.service_scope_org_id = p_service_scope_org_id
  FOR UPDATE;

  v_action := CASE WHEN v_before IS NULL THEN 'create' ELSE 'update' END;

  IF COALESCE(p_is_primary, TRUE) IS TRUE THEN
    UPDATE public.organization_correction_specialties
    SET
      is_primary = FALSE,
      updated_at = NOW()
    WHERE specialty_id = p_specialty_id
      AND service_scope_org_id = p_service_scope_org_id
      AND is_active IS TRUE
      AND is_primary IS TRUE
      AND NOT (
        organization_id = p_organization_id
        AND specialty_id = p_specialty_id
        AND service_scope_org_id = p_service_scope_org_id
      );
  END IF;

  INSERT INTO public.organization_correction_specialties (
    organization_id,
    specialty_id,
    service_scope_org_id,
    is_primary,
    is_active,
    created_by_user_id,
    updated_at
  )
  VALUES (
    p_organization_id,
    p_specialty_id,
    p_service_scope_org_id,
    COALESCE(p_is_primary, TRUE),
    TRUE,
    p_actor_user_id,
    NOW()
  )
  ON CONFLICT (
    organization_id,
    specialty_id,
    service_scope_org_id
  ) DO UPDATE
  SET
    is_primary = EXCLUDED.is_primary,
    is_active = TRUE,
    updated_at = NOW();

  SELECT to_jsonb(mapping)
  INTO v_after
  FROM public.organization_correction_specialties mapping
  WHERE mapping.organization_id = p_organization_id
    AND mapping.specialty_id = p_specialty_id
    AND mapping.service_scope_org_id = p_service_scope_org_id;

  INSERT INTO public.organization_correction_specialty_audit (
    organization_id,
    specialty_id,
    service_scope_org_id,
    action_code,
    actor_user_id,
    before_data,
    after_data
  )
  VALUES (
    p_organization_id,
    p_specialty_id,
    p_service_scope_org_id,
    v_action,
    p_actor_user_id,
    v_before,
    v_after
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.deactivate_organization_correction_specialty(
  p_actor_user_id UUID,
  p_organization_id UUID,
  p_specialty_id UUID,
  p_service_scope_org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_before JSONB;
  v_after JSONB;
BEGIN
  SELECT to_jsonb(mapping)
  INTO v_before
  FROM public.organization_correction_specialties mapping
  WHERE mapping.organization_id = p_organization_id
    AND mapping.specialty_id = p_specialty_id
    AND mapping.service_scope_org_id = p_service_scope_org_id
    AND mapping.is_active IS TRUE
  FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Active correction specialty mapping not found';
  END IF;

  UPDATE public.organization_correction_specialties
  SET
    is_active = FALSE,
    is_primary = FALSE,
    updated_at = NOW()
  WHERE organization_id = p_organization_id
    AND specialty_id = p_specialty_id
    AND service_scope_org_id = p_service_scope_org_id;

  SELECT to_jsonb(mapping)
  INTO v_after
  FROM public.organization_correction_specialties mapping
  WHERE mapping.organization_id = p_organization_id
    AND mapping.specialty_id = p_specialty_id
    AND mapping.service_scope_org_id = p_service_scope_org_id;

  INSERT INTO public.organization_correction_specialty_audit (
    organization_id,
    specialty_id,
    service_scope_org_id,
    action_code,
    actor_user_id,
    before_data,
    after_data
  )
  VALUES (
    p_organization_id,
    p_specialty_id,
    p_service_scope_org_id,
    'deactivate',
    p_actor_user_id,
    v_before,
    v_after
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_organization_correction_specialty(
  UUID, UUID, UUID, UUID, BOOLEAN
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_organization_correction_specialty(
  UUID, UUID, UUID, UUID, BOOLEAN
) FROM anon;
REVOKE ALL ON FUNCTION public.save_organization_correction_specialty(
  UUID, UUID, UUID, UUID, BOOLEAN
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_organization_correction_specialty(
  UUID, UUID, UUID, UUID, BOOLEAN
) TO service_role;

REVOKE ALL ON FUNCTION public.deactivate_organization_correction_specialty(
  UUID, UUID, UUID, UUID
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_organization_correction_specialty(
  UUID, UUID, UUID, UUID
) FROM anon;
REVOKE ALL ON FUNCTION public.deactivate_organization_correction_specialty(
  UUID, UUID, UUID, UUID
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_organization_correction_specialty(
  UUID, UUID, UUID, UUID
) TO service_role;

COMMIT;
