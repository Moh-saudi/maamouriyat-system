-- One terminal field record per facility: performed or not performed.
BEGIN;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS execution_outcome TEXT,
  ADD COLUMN IF NOT EXISTS non_execution_reason TEXT,
  ADD COLUMN IF NOT EXISTS outcome_recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outcome_recorded_at TIMESTAMPTZ;

ALTER TABLE public.missions
  DROP CONSTRAINT IF EXISTS missions_execution_outcome_check;

ALTER TABLE public.missions
  ADD CONSTRAINT missions_execution_outcome_check
  CHECK (execution_outcome IS NULL OR execution_outcome IN ('performed', 'not_performed'));

ALTER TABLE public.missions
  DROP CONSTRAINT IF EXISTS missions_non_execution_reason_check;

ALTER TABLE public.missions
  ADD CONSTRAINT missions_non_execution_reason_check
  CHECK (
    execution_outcome <> 'not_performed'
    OR length(btrim(COALESCE(non_execution_reason, ''))) >= 5
  );

CREATE INDEX IF NOT EXISTS idx_missions_execution_outcome
  ON public.missions(assignment_batch_id, execution_outcome);

COMMENT ON COLUMN public.missions.execution_outcome IS
  'Terminal facility outcome: performed or not_performed.';
COMMENT ON COLUMN public.missions.non_execution_reason IS
  'Mandatory reason when the assigned facility visit was not performed.';
COMMENT ON COLUMN public.missions.outcome_recorded_at IS
  'Server timestamp of the latest field outcome record.';

COMMIT;
