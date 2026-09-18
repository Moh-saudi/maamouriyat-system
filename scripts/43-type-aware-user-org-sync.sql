-- ==============================================================================
-- Script 43: Make user organization sync type-aware
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_user_org_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_level INTEGER;
  v_sector_id UUID;
  v_org_name TEXT;
  v_org_type TEXT;
BEGIN
  SELECT
    organization.level,
    organization.sector_id,
    organization.name,
    organization.organization_type_code
  INTO
    v_level,
    v_sector_id,
    v_org_name,
    v_org_type
  FROM public.organizations organization
  WHERE organization.id = NEW.organization_id;

  NEW.org_level := COALESCE(v_level, NEW.level, 7);
  NEW.level := NEW.org_level;

  NEW.sector_id := CASE
    WHEN v_org_type = 'sector' THEN NEW.organization_id
    ELSE v_sector_id
  END;

  NEW.department := COALESCE(NEW.department, v_org_name);
  NEW.org_unit_id := COALESCE(NEW.org_unit_id, NEW.organization_id);

  RETURN NEW;
END;
$function$;

-- Re-run the trigger logic for all existing profiles so denormalized context
-- reflects the real organization type and hierarchy.
UPDATE public.users
SET organization_id = organization_id;

COMMIT;
