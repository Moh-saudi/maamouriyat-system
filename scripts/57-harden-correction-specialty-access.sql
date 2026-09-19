-- ==============================================================================
-- Script 57: Harden correction-specialty tables behind V2 authorization APIs
-- ==============================================================================
BEGIN;

DROP POLICY IF EXISTS correction_specialties_select_authenticated
  ON public.correction_specialties;
DROP POLICY IF EXISTS organization_correction_specialties_select_authenticated
  ON public.organization_correction_specialties;
DROP POLICY IF EXISTS organization_correction_specialty_audit_select_authenticated
  ON public.organization_correction_specialty_audit;

REVOKE ALL ON TABLE public.correction_specialties
  FROM anon, authenticated;
REVOKE ALL ON TABLE public.organization_correction_specialties
  FROM anon, authenticated;
REVOKE ALL ON TABLE public.organization_correction_specialty_audit
  FROM anon, authenticated;

GRANT ALL ON TABLE public.correction_specialties TO service_role;
GRANT ALL ON TABLE public.organization_correction_specialties TO service_role;
GRANT ALL ON TABLE public.organization_correction_specialty_audit TO service_role;

COMMIT;
