-- ==============================================================================
-- Script 27: Atomic Mission Target Facility Replacement
-- Phase: 3F — transactional helper for server-only target administration
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.replace_mission_target_facilities(
  p_target_id UUID,
  p_facility_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.mission_targets
    WHERE id = p_target_id
  ) THEN
    RAISE EXCEPTION 'Mission target not found';
  END IF;

  DELETE FROM public.mission_target_facilities
  WHERE target_id = p_target_id;

  IF p_facility_ids IS NOT NULL AND cardinality(p_facility_ids) > 0 THEN
    INSERT INTO public.mission_target_facilities (target_id, facility_id)
    SELECT p_target_id, facility_id
    FROM unnest(p_facility_ids) AS facility_id
    ON CONFLICT (target_id, facility_id) DO NOTHING;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_mission_target_facilities(UUID, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_mission_target_facilities(UUID, UUID[]) FROM anon;
REVOKE ALL ON FUNCTION public.replace_mission_target_facilities(UUID, UUID[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_mission_target_facilities(UUID, UUID[]) TO service_role;

COMMIT;
