BEGIN;

CREATE INDEX IF NOT EXISTS idx_leadership_targets_sector_head
  ON public.leadership_targets (sector_head_id);

COMMIT;
