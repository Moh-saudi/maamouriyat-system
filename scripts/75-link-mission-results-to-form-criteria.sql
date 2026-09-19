-- ==============================================================================
-- Script 75: Link V2 mission results directly to form criteria
-- Keeps legacy checklist_item_id compatibility while removing the notes-id hack.
-- ==============================================================================

BEGIN;

ALTER TABLE public.mission_results
  ADD COLUMN IF NOT EXISTS form_criterion_id UUID
    REFERENCES public.form_criteria(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mission_results_form_criterion
  ON public.mission_results(form_criterion_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mission_results_run_form_criterion
  ON public.mission_results(
    mission_id,
    checklist_run_id,
    form_criterion_id
  )
  WHERE form_criterion_id IS NOT NULL;

-- Backfill V2 rows previously encoded as:
-- __item_id__:<form_criteria.uuid>||<real notes>
UPDATE public.mission_results mr
SET
  form_criterion_id = fc.id,
  notes = NULLIF(
    regexp_replace(
      COALESCE(mr.notes, ''),
      '^__item_id__:[0-9a-fA-F-]{36}\|\|',
      ''
    ),
    ''
  )
FROM public.form_criteria fc
WHERE mr.form_criterion_id IS NULL
  AND COALESCE(mr.notes, '') ~
      '^__item_id__:[0-9a-fA-F-]{36}\|\|'
  AND fc.id::TEXT = substring(
    mr.notes
    FROM '^__item_id__:([0-9a-fA-F-]{36})\|\|'
  );

CREATE OR REPLACE FUNCTION public.replace_mission_results(
  p_mission_id UUID,
  p_results JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_run_id UUID;
BEGIN
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RAISE EXCEPTION 'p_results must be a JSON array';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.missions
    WHERE id = p_mission_id
  ) THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  v_run_id := public.ensure_active_mission_checklist_run(
    p_mission_id,
    NULL
  );

  IF v_run_id IS NOT NULL THEN
    DELETE FROM public.mission_results
    WHERE mission_id = p_mission_id
      AND checklist_run_id = v_run_id;
  ELSE
    DELETE FROM public.mission_results
    WHERE mission_id = p_mission_id
      AND checklist_run_id IS NULL;
  END IF;

  INSERT INTO public.mission_results (
    mission_id,
    checklist_run_id,
    checklist_item_id,
    form_criterion_id,
    answer,
    notes,
    photo_url
  )
  SELECT
    p_mission_id,
    v_run_id,
    NULLIF(item->>'checklist_item_id', '')::UUID,
    NULLIF(item->>'form_criterion_id', '')::UUID,
    NULLIF(item->>'answer', ''),
    NULLIF(item->>'notes', ''),
    NULLIF(item->>'photo_url', '')
  FROM jsonb_array_elements(p_results) AS item;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_mission_results(UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_mission_results(UUID, JSONB)
  TO service_role;

COMMIT;
