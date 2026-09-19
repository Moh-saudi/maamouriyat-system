-- ==============================================================================
-- Script 50: Regional facilities may exist outside the central sector hierarchy
-- - Geographic health administrations can legitimately have sector_id = NULL
-- - Facility ownership remains anchored by organization_id + governorate
-- ==============================================================================

BEGIN;

ALTER TABLE public.facilities
  ALTER COLUMN sector_id DROP NOT NULL;

COMMENT ON COLUMN public.facilities.sector_id IS
  'Optional central-sector affiliation. Regional health hierarchy may legitimately use NULL.';

COMMIT;
