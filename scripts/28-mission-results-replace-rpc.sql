-- ==============================================================================
-- Script 28: Atomic Mission Results Replacement
-- Phase: 3F — eliminate delete/insert partial-failure risk
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.replace_mission_results(
  p_mission_id UUID,
  p_results JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RAISE EXCEPTION 'p_results must be a JSON array';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.missions WHERE id = p_mission_id
  ) THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  DELETE FROM public.mission_results
  WHERE mission_id = p_mission_id;

  INSERT INTO public.mission_results (
    mission_id,
    checklist_item_id,
    answer,
    notes,
    photo_url
  )
  SELECT
    p_mission_id,
    NULLIF(item->>'checklist_item_id', '')::UUID,
    NULLIF(item->>'answer', ''),
    NULLIF(item->>'notes', ''),
    NULLIF(item->>'photo_url', '')
  FROM jsonb_array_elements(p_results) AS item;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_mission_results(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_mission_results(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.replace_mission_results(UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_mission_results(UUID, JSONB) TO service_role;

COMMIT;
