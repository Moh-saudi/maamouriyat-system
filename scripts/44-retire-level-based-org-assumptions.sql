-- ==============================================================================
-- Script 44: Retire remaining level-based organization assumptions
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_user_org_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_org public.organizations%ROWTYPE;
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    SELECT *
    INTO v_org
    FROM public.organizations
    WHERE id = NEW.organization_id;

    IF FOUND THEN
      NEW.sector_id := CASE
        WHEN v_org.organization_type_code = 'sector' THEN v_org.id
        ELSE v_org.sector_id
      END;

      NEW.level := COALESCE(v_org.level, NEW.level, 7);
      NEW.org_level := NEW.level;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.reparent_v2_organization(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
