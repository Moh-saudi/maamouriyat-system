-- ==============================================================================
-- Script 68: Enforce one governorate per official mission assignment batch
-- ==============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure(
    'public.create_v2_mission_assignment_batch_internal(uuid,uuid,uuid[],uuid,uuid[],uuid,date,date,text,text,text,boolean,boolean,text,uuid,uuid,text)'
  ) IS NULL THEN
    ALTER FUNCTION public.create_v2_mission_assignment_batch(
      uuid, uuid, uuid[], uuid, uuid[], uuid, date, date, text, text,
      text, boolean, boolean, text, uuid, uuid, text
    )
    RENAME TO create_v2_mission_assignment_batch_internal;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.create_v2_mission_assignment_batch(
  p_actor_user_id UUID,
  p_actor_org_id UUID,
  p_team_user_ids UUID[],
  p_primary_user_id UUID,
  p_facility_ids UUID[],
  p_template_id UUID,
  p_scheduled_date DATE,
  p_expected_end_date DATE,
  p_priority TEXT,
  p_visit_purpose TEXT,
  p_notes TEXT DEFAULT NULL,
  p_requires_overnight BOOLEAN DEFAULT FALSE,
  p_requires_hotel_booking BOOLEAN DEFAULT FALSE,
  p_status TEXT DEFAULT 'pending_approval',
  p_source_target_id UUID DEFAULT NULL,
  p_source_program_id UUID DEFAULT NULL,
  p_selection_source TEXT DEFAULT 'manual'
)
RETURNS TABLE(
  batch_id UUID,
  mission_id UUID,
  serial_number TEXT,
  facility_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_facility_ids UUID[];
  v_governorate_count INTEGER;
  v_missing_governorate_count INTEGER;
BEGIN
  v_facility_ids := ARRAY(
    SELECT DISTINCT value
    FROM unnest(COALESCE(p_facility_ids, ARRAY[]::UUID[])) AS value
    WHERE value IS NOT NULL
  );

  IF cardinality(v_facility_ids) = 0 THEN
    RAISE EXCEPTION 'At least one facility is required';
  END IF;

  SELECT
    COUNT(DISTINCT NULLIF(BTRIM(f.governorate), '')),
    COUNT(*) FILTER (
      WHERE NULLIF(BTRIM(f.governorate), '') IS NULL
    )
  INTO
    v_governorate_count,
    v_missing_governorate_count
  FROM public.facilities f
  WHERE f.id = ANY(v_facility_ids);

  IF v_missing_governorate_count > 0 THEN
    RAISE EXCEPTION
      'MISSION_GOVERNORATE_REQUIRED: every facility must have a governorate before assignment';
  END IF;

  IF v_governorate_count > 1 THEN
    RAISE EXCEPTION
      'MISSION_MULTI_GOVERNORATE_DENIED: one official assignment batch cannot include facilities from more than one governorate';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.create_v2_mission_assignment_batch_internal(
    p_actor_user_id,
    p_actor_org_id,
    p_team_user_ids,
    p_primary_user_id,
    v_facility_ids,
    p_template_id,
    p_scheduled_date,
    p_expected_end_date,
    p_priority,
    p_visit_purpose,
    p_notes,
    p_requires_overnight,
    p_requires_hotel_booking,
    p_status,
    p_source_target_id,
    p_source_program_id,
    p_selection_source
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_v2_mission_assignment_batch_internal(
  UUID, UUID, UUID[], UUID, UUID[], UUID, DATE, DATE, TEXT, TEXT,
  TEXT, BOOLEAN, BOOLEAN, TEXT, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_v2_mission_assignment_batch(
  UUID, UUID, UUID[], UUID, UUID[], UUID, DATE, DATE, TEXT, TEXT,
  TEXT, BOOLEAN, BOOLEAN, TEXT, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_v2_mission_assignment_batch(
  UUID, UUID, UUID[], UUID, UUID[], UUID, DATE, DATE, TEXT, TEXT,
  TEXT, BOOLEAN, BOOLEAN, TEXT, UUID, UUID, TEXT
) TO service_role;

COMMIT;
