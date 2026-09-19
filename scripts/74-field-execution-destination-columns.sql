-- ==============================================================================
-- Script 74: Add explicit field execution destination tracking
-- ==============================================================================

BEGIN;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS actual_facility_id UUID
    REFERENCES public.facilities(id),
  ADD COLUMN IF NOT EXISTS actual_governorate_id TEXT,
  ADD COLUMN IF NOT EXISTS destination_changed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS change_reason TEXT,
  ADD COLUMN IF NOT EXISTS execution_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_missions_actual_facility
  ON public.missions(actual_facility_id);

COMMENT ON COLUMN public.missions.actual_facility_id IS
  'Actual facility visited when the field destination differs from the assignment target.';

COMMENT ON COLUMN public.missions.actual_governorate_id IS
  'Actual governorate code/name captured by the execution UI when destination_type is governorate.';

COMMENT ON COLUMN public.missions.destination_changed IS
  'True when the actual field destination differs from the original assignment destination.';

COMMENT ON COLUMN public.missions.change_reason IS
  'Required audit reason when the field destination is changed during execution.';

COMMENT ON COLUMN public.missions.execution_notes IS
  'Field execution narrative and approved recommendations captured during the visit.';

COMMIT;
