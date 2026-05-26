-- Optional expected end date for mission planning.

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS expected_end_date DATE;

CREATE INDEX IF NOT EXISTS idx_missions_expected_end_date
  ON missions(expected_end_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'missions_expected_end_date_check'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_expected_end_date_check CHECK (
        expected_end_date IS NULL OR expected_end_date >= scheduled_date
      );
  END IF;
END;
$$;
