-- ==============================================================================
-- Script 66: Flexible actual mission timing and finance-ready duration
-- ==============================================================================
BEGIN;

-- Keep the original assignment dates intact. These fields record what actually
-- happened in the field and are the source of truth for financial day counts.
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS actual_start_date DATE,
  ADD COLUMN IF NOT EXISTS actual_end_date DATE,
  ADD COLUMN IF NOT EXISTS actual_overnight_nights INTEGER,
  ADD COLUMN IF NOT EXISTS completion_disposition TEXT,
  ADD COLUMN IF NOT EXISTS timing_adjustment_reason TEXT,
  ADD COLUMN IF NOT EXISTS actual_timing_confirmed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS actual_timing_confirmed_at TIMESTAMPTZ;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS actual_duration_days INTEGER
  GENERATED ALWAYS AS (
    CASE
      WHEN actual_start_date IS NOT NULL AND actual_end_date IS NOT NULL
        THEN (actual_end_date - actual_start_date) + 1
      ELSE NULL
    END
  ) STORED;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'missions_actual_dates_check'
      AND conrelid = 'public.missions'::regclass
  ) THEN
    ALTER TABLE public.missions
      ADD CONSTRAINT missions_actual_dates_check
      CHECK (
        actual_end_date IS NULL
        OR (
          actual_start_date IS NOT NULL
          AND actual_end_date >= actual_start_date
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'missions_actual_overnight_nights_check'
      AND conrelid = 'public.missions'::regclass
  ) THEN
    ALTER TABLE public.missions
      ADD CONSTRAINT missions_actual_overnight_nights_check
      CHECK (
        actual_overnight_nights IS NULL
        OR (
          actual_overnight_nights >= 0
          AND (
            actual_duration_days IS NULL
            OR actual_overnight_nights <= GREATEST(actual_duration_days - 1, 0)
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'missions_completion_disposition_check'
      AND conrelid = 'public.missions'::regclass
  ) THEN
    ALTER TABLE public.missions
      ADD CONSTRAINT missions_completion_disposition_check
      CHECK (
        completion_disposition IS NULL
        OR completion_disposition IN (
          'return_to_base',
          'next_mission',
          'other'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_missions_actual_timing
  ON public.missions(actual_start_date, actual_end_date, status);

-- Existing in-progress/completed rows get a conservative actual start fallback.
-- We deliberately do not rewrite approved/upcoming assignments.
UPDATE public.missions
SET
  actual_start_date = COALESCE(
    actual_start_date,
    checkin_time::DATE,
    scheduled_date
  ),
  actual_timing_confirmed_at = COALESCE(
    actual_timing_confirmed_at,
    checkin_time,
    updated_at,
    NOW()
  )
WHERE status IN ('in_progress', 'executing')
  AND actual_start_date IS NULL;

UPDATE public.missions
SET
  actual_start_date = COALESCE(
    actual_start_date,
    checkin_time::DATE,
    scheduled_date
  ),
  actual_end_date = COALESCE(
    actual_end_date,
    checkout_time::DATE,
    completed_at::DATE,
    expected_end_date,
    scheduled_date
  ),
  actual_overnight_nights = COALESCE(
    actual_overnight_nights,
    LEAST(
      COALESCE(expected_nights, 0),
      GREATEST(
        (
          COALESCE(
            checkout_time::DATE,
            completed_at::DATE,
            expected_end_date,
            scheduled_date
          )
          -
          COALESCE(checkin_time::DATE, scheduled_date)
        ),
        0
      )
    )
  ),
  completion_disposition = COALESCE(completion_disposition, 'other'),
  timing_adjustment_reason = COALESCE(
    timing_adjustment_reason,
    'ترحيل تلقائي لسجل مأمورية منفذة قبل تفعيل توثيق المدة الفعلية.'
  ),
  actual_timing_confirmed_at = COALESCE(
    actual_timing_confirmed_at,
    completed_at,
    checkout_time,
    updated_at,
    NOW()
  )
WHERE status IN ('completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة')
  AND (actual_start_date IS NULL OR actual_end_date IS NULL);

-- A team may execute multiple facilities in the same governorate during one
-- assignment, but the same person must not hold overlapping actual date ranges
-- across different governorates.
CREATE OR REPLACE FUNCTION public.guard_mission_actual_timing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_governorate TEXT;
  v_conflict RECORD;
BEGIN
  IF NEW.actual_start_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.actual_end_date IS NOT NULL
     AND NEW.actual_end_date < NEW.actual_start_date THEN
    RAISE EXCEPTION 'Actual mission end date cannot precede start date';
  END IF;

  SELECT f.governorate
  INTO v_governorate
  FROM public.facilities f
  WHERE f.id = NEW.facility_id;

  IF v_governorate IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    other.id,
    other.serial_number,
    other.actual_start_date,
    other.actual_end_date,
    ofac.governorate
  INTO v_conflict
  FROM public.missions other
  JOIN public.facilities ofac ON ofac.id = other.facility_id
  WHERE other.id <> NEW.id
    AND other.actual_start_date IS NOT NULL
    AND other.status NOT IN ('cancelled', 'rejected', 'ملغاة', 'مرفوضة')
    AND ofac.governorate IS NOT NULL
    AND ofac.governorate <> v_governorate
    AND daterange(
      other.actual_start_date,
      COALESCE(other.actual_end_date, 'infinity'::DATE),
      '[]'
    ) && daterange(
      NEW.actual_start_date,
      COALESCE(NEW.actual_end_date, 'infinity'::DATE),
      '[]'
    )
    AND EXISTS (
      SELECT 1
      FROM (
        SELECT mt.user_id
        FROM public.mission_team mt
        WHERE mt.mission_id = NEW.id

        UNION

        SELECT NEW.primary_inspector_id
      ) current_team
      WHERE current_team.user_id IS NOT NULL
        AND (
          current_team.user_id = other.primary_inspector_id
          OR EXISTS (
            SELECT 1
            FROM public.mission_team omt
            WHERE omt.mission_id = other.id
              AND omt.user_id = current_team.user_id
          )
        )
    )
  ORDER BY other.actual_start_date
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Mission actual timing overlaps mission % in governorate %',
      COALESCE(v_conflict.serial_number, v_conflict.id::TEXT),
      v_conflict.governorate;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_mission_actual_timing
  ON public.missions;

CREATE TRIGGER trg_guard_mission_actual_timing
BEFORE INSERT OR UPDATE OF
  actual_start_date,
  actual_end_date,
  status
ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.guard_mission_actual_timing();

CREATE OR REPLACE FUNCTION public.audit_mission_actual_timing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD.actual_start_date IS DISTINCT FROM NEW.actual_start_date
     AND NEW.actual_start_date IS NOT NULL THEN
    INSERT INTO public.mission_events (
      mission_id,
      user_id,
      event_type,
      description,
      metadata
    )
    VALUES (
      NEW.id,
      NEW.actual_timing_confirmed_by,
      'actual_timing_started',
      'تم تثبيت تاريخ البداية الفعلية للمأمورية.',
      jsonb_build_object(
        'planned_start_date', NEW.scheduled_date,
        'actual_start_date', NEW.actual_start_date
      )
    );
  END IF;

  IF (
       OLD.actual_end_date IS DISTINCT FROM NEW.actual_end_date
       OR OLD.completion_disposition IS DISTINCT FROM NEW.completion_disposition
     )
     AND NEW.actual_end_date IS NOT NULL THEN
    INSERT INTO public.mission_events (
      mission_id,
      user_id,
      event_type,
      description,
      metadata
    )
    VALUES (
      NEW.id,
      NEW.actual_timing_confirmed_by,
      'actual_timing_completed',
      'تم تثبيت المدة الفعلية للمأمورية عند الإنهاء.',
      jsonb_build_object(
        'planned_start_date', NEW.scheduled_date,
        'planned_end_date', COALESCE(NEW.expected_end_date, NEW.scheduled_date),
        'actual_start_date', NEW.actual_start_date,
        'actual_end_date', NEW.actual_end_date,
        'actual_duration_days', NEW.actual_duration_days,
        'actual_overnight_nights', NEW.actual_overnight_nights,
        'completion_disposition', NEW.completion_disposition,
        'timing_adjustment_reason', NEW.timing_adjustment_reason
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_mission_actual_timing
  ON public.missions;

CREATE TRIGGER trg_audit_mission_actual_timing
AFTER UPDATE OF
  actual_start_date,
  actual_end_date,
  actual_overnight_nights,
  completion_disposition,
  timing_adjustment_reason
ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.audit_mission_actual_timing();

-- Finance must use the actual approved field duration, with legacy fallbacks.
CREATE OR REPLACE FUNCTION public.ensure_mission_financial_settlements(
  p_mission_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_mission RECORD;
  v_user_id UUID;
  v_inserted INTEGER := 0;
  v_days INTEGER;
  v_nights INTEGER;
BEGIN
  SELECT
    m.id,
    m.status,
    m.facility_id,
    m.primary_inspector_id,
    m.scheduled_date,
    COALESCE(m.expected_end_date, m.scheduled_date) AS planned_end_date,
    m.actual_start_date,
    m.actual_end_date,
    m.actual_duration_days,
    m.actual_overnight_nights,
    m.checkin_time,
    m.checkout_time,
    m.completed_at,
    COALESCE(m.expected_nights, 0) AS expected_nights,
    f.organization_id AS scope_org_id
  INTO v_mission
  FROM public.missions m
  JOIN public.facilities f ON f.id = m.facility_id
  WHERE m.id = p_mission_id;

  IF NOT FOUND OR v_mission.status NOT IN (
    'completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'
  ) THEN
    RETURN 0;
  END IF;

  v_days := COALESCE(
    v_mission.actual_duration_days,
    CASE
      WHEN v_mission.checkin_time IS NOT NULL
       AND COALESCE(v_mission.checkout_time, v_mission.completed_at) IS NOT NULL
      THEN GREATEST(
        (
          COALESCE(v_mission.checkout_time, v_mission.completed_at)::DATE
          - v_mission.checkin_time::DATE
        ) + 1,
        1
      )
      ELSE GREATEST(
        (v_mission.planned_end_date - v_mission.scheduled_date) + 1,
        1
      )
    END
  );

  v_nights := COALESCE(
    v_mission.actual_overnight_nights,
    LEAST(
      v_mission.expected_nights,
      GREATEST(v_days - 1, 0)
    )
  );

  FOR v_user_id IN
    SELECT DISTINCT team_user_id
    FROM (
      SELECT mt.user_id AS team_user_id
      FROM public.mission_team mt
      WHERE mt.mission_id = p_mission_id

      UNION ALL

      SELECT v_mission.primary_inspector_id
    ) users_for_settlement
    WHERE team_user_id IS NOT NULL
  LOOP
    INSERT INTO public.mission_financial_settlements (
      mission_id,
      user_id,
      scope_org_id,
      mission_days,
      overnight_nights
    )
    VALUES (
      p_mission_id,
      v_user_id,
      v_mission.scope_org_id,
      GREATEST(v_days, 1),
      GREATEST(v_nights, 0)
    )
    ON CONFLICT (mission_id, user_id) DO UPDATE
    SET
      scope_org_id = EXCLUDED.scope_org_id,
      mission_days = EXCLUDED.mission_days,
      overnight_nights = EXCLUDED.overnight_nights,
      updated_at = NOW()
    WHERE public.mission_financial_settlements.status IN (
      'pending_review',
      'rejected'
    );

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_create_mission_financial_settlements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.status IN (
       'completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'
     )
     AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.actual_start_date IS DISTINCT FROM NEW.actual_start_date
       OR OLD.actual_end_date IS DISTINCT FROM NEW.actual_end_date
       OR OLD.actual_overnight_nights IS DISTINCT FROM NEW.actual_overnight_nights
     ) THEN
    PERFORM public.ensure_mission_financial_settlements(NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_create_mission_financial_settlements
  ON public.missions;

CREATE TRIGGER trg_create_mission_financial_settlements
AFTER INSERT OR UPDATE OF
  status,
  actual_start_date,
  actual_end_date,
  actual_overnight_nights
ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.trg_create_mission_financial_settlements();

REVOKE ALL ON FUNCTION public.guard_mission_actual_timing()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_mission_actual_timing()
  TO service_role;

REVOKE ALL ON FUNCTION public.audit_mission_actual_timing()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_mission_actual_timing()
  TO service_role;

REVOKE ALL ON FUNCTION public.ensure_mission_financial_settlements(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_mission_financial_settlements(UUID)
  TO service_role;

COMMIT;
