-- ==============================================================================
-- Script 62: Atomic facility-program membership replacement
-- ==============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.replace_facility_program_facilities(
  p_program_id UUID,
  p_facility_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.facility_programs
    WHERE id = p_program_id
  ) THEN
    RAISE EXCEPTION 'Facility program not found';
  END IF;

  DELETE FROM public.facility_program_facilities
  WHERE program_id = p_program_id;

  IF p_facility_ids IS NOT NULL AND cardinality(p_facility_ids) > 0 THEN
    INSERT INTO public.facility_program_facilities (
      program_id,
      facility_id
    )
    SELECT p_program_id, facility_id
    FROM unnest(p_facility_ids) AS facility_id
    JOIN public.facilities f ON f.id = facility_id
    WHERE f.is_active IS TRUE
    ON CONFLICT (program_id, facility_id) DO NOTHING;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_facility_program_facilities(UUID, UUID[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_facility_program_facilities(UUID, UUID[])
  TO service_role;

COMMIT;
