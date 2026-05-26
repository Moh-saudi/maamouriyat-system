-- Optional mission duration and overnight planning fields.

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS expected_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS expected_nights INTEGER,
  ADD COLUMN IF NOT EXISTS requires_overnight BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_missions_requires_overnight
  ON missions(requires_overnight);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'missions_expected_duration_check'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_expected_duration_check CHECK (
        expected_duration_days IS NULL OR expected_duration_days >= 1
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'missions_expected_nights_check'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_expected_nights_check CHECK (
        expected_nights IS NULL OR expected_nights >= 0
      );
  END IF;
END;
$$;
