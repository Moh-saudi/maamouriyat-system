-- ==============================================================================
-- Script 69: Batch-level actual timing and financial settlement
-- One official grouped assignment => one settlement per team member.
-- ==============================================================================

BEGIN;

ALTER TABLE public.mission_assignment_batches
  ADD COLUMN IF NOT EXISTS actual_start_date DATE,
  ADD COLUMN IF NOT EXISTS actual_end_date DATE,
  ADD COLUMN IF NOT EXISTS actual_overnight_nights INTEGER,
  ADD COLUMN IF NOT EXISTS completion_disposition TEXT,
  ADD COLUMN IF NOT EXISTS timing_adjustment_reason TEXT,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.mission_assignment_batches
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
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mission_assignment_batches_actual_dates_check'
      AND conrelid = 'public.mission_assignment_batches'::regclass
  ) THEN
    ALTER TABLE public.mission_assignment_batches
      ADD CONSTRAINT mission_assignment_batches_actual_dates_check
      CHECK (
        actual_end_date IS NULL
        OR (
          actual_start_date IS NOT NULL
          AND actual_end_date >= actual_start_date
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mission_assignment_batches_actual_nights_check'
      AND conrelid = 'public.mission_assignment_batches'::regclass
  ) THEN
    ALTER TABLE public.mission_assignment_batches
      ADD CONSTRAINT mission_assignment_batches_actual_nights_check
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
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mission_assignment_batches_completion_disposition_check'
      AND conrelid = 'public.mission_assignment_batches'::regclass
  ) THEN
    ALTER TABLE public.mission_assignment_batches
      ADD CONSTRAINT mission_assignment_batches_completion_disposition_check
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

CREATE INDEX IF NOT EXISTS idx_mission_assignment_batches_actual_timing
  ON public.mission_assignment_batches(actual_start_date, actual_end_date, status);

ALTER TABLE public.mission_financial_settlements
  ADD COLUMN IF NOT EXISTS assignment_batch_id UUID
  REFERENCES public.mission_assignment_batches(id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mission_financial_settlements_batch_user
  ON public.mission_financial_settlements(assignment_batch_id, user_id)
  WHERE assignment_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mission_financial_settlements_batch
  ON public.mission_financial_settlements(assignment_batch_id, status);

CREATE OR REPLACE FUNCTION public.guard_assignment_batch_actual_timing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_governorate TEXT;
  v_governorate_count INTEGER;
  v_conflict RECORD;
BEGIN
  IF NEW.actual_start_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.actual_end_date IS NOT NULL
     AND NEW.actual_end_date < NEW.actual_start_date THEN
    RAISE EXCEPTION 'Actual assignment end date cannot precede start date';
  END IF;

  SELECT
    COUNT(DISTINCT NULLIF(BTRIM(f.governorate), '')),
    MIN(NULLIF(BTRIM(f.governorate), ''))
  INTO v_governorate_count, v_governorate
  FROM public.missions m
  JOIN public.facilities f ON f.id = m.facility_id
  WHERE m.assignment_batch_id = NEW.id;

  IF v_governorate_count <> 1 OR v_governorate IS NULL THEN
    RAISE EXCEPTION
      'MISSION_BATCH_GOVERNORATE_INVALID: grouped assignment must belong to one governorate before actual timing can be confirmed';
  END IF;

  SELECT
    other.id,
    ofac.governorate
  INTO v_conflict
  FROM public.mission_assignment_batches other
  JOIN public.missions om ON om.assignment_batch_id = other.id
  JOIN public.facilities ofac ON ofac.id = om.facility_id
  WHERE other.id <> NEW.id
    AND other.actual_start_date IS NOT NULL
    AND other.status NOT IN ('cancelled', 'rejected')
    AND NULLIF(BTRIM(ofac.governorate), '') IS NOT NULL
    AND BTRIM(ofac.governorate) <> v_governorate
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
        JOIN public.missions m ON m.id = mt.mission_id
        WHERE m.assignment_batch_id = NEW.id

        UNION

        SELECT m.primary_inspector_id
        FROM public.missions m
        WHERE m.assignment_batch_id = NEW.id
      ) current_team
      WHERE current_team.user_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM (
            SELECT omt.user_id
            FROM public.mission_team omt
            JOIN public.missions om2 ON om2.id = omt.mission_id
            WHERE om2.assignment_batch_id = other.id

            UNION

            SELECT om3.primary_inspector_id
            FROM public.missions om3
            WHERE om3.assignment_batch_id = other.id
          ) other_team
          WHERE other_team.user_id = current_team.user_id
        )
    )
  ORDER BY other.actual_start_date
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'MISSION_BATCH_ACTUAL_TIMING_OVERLAP: same team member has overlapping actual assignment in governorate %',
      v_conflict.governorate;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_assignment_batch_actual_timing
  ON public.mission_assignment_batches;

CREATE TRIGGER trg_guard_assignment_batch_actual_timing
BEFORE UPDATE OF
  actual_start_date,
  actual_end_date,
  status
ON public.mission_assignment_batches
FOR EACH ROW
EXECUTE FUNCTION public.guard_assignment_batch_actual_timing();

CREATE OR REPLACE FUNCTION public.ensure_assignment_batch_financial_settlements(
  p_batch_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_batch RECORD;
  v_anchor_mission_id UUID;
  v_scope_org_id UUID;
  v_user_id UUID;
  v_inserted INTEGER := 0;
BEGIN
  SELECT
    b.id,
    b.status,
    b.created_by_org,
    b.actual_start_date,
    b.actual_end_date,
    b.actual_duration_days,
    b.actual_overnight_nights
  INTO v_batch
  FROM public.mission_assignment_batches b
  WHERE b.id = p_batch_id;

  IF NOT FOUND
     OR v_batch.status NOT IN ('completed', 'closed')
     OR v_batch.actual_start_date IS NULL
     OR v_batch.actual_end_date IS NULL
     OR v_batch.actual_duration_days IS NULL
     OR v_batch.actual_overnight_nights IS NULL THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.missions m
    WHERE m.assignment_batch_id = p_batch_id
      AND m.status NOT IN (
        'completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'
      )
  ) THEN
    RETURN 0;
  END IF;

  SELECT
    m.id,
    COALESCE(v_batch.created_by_org, f.organization_id)
  INTO v_anchor_mission_id, v_scope_org_id
  FROM public.missions m
  JOIN public.facilities f ON f.id = m.facility_id
  WHERE m.assignment_batch_id = p_batch_id
  ORDER BY m.scheduled_date, m.created_at, m.id
  LIMIT 1;

  IF v_anchor_mission_id IS NULL OR v_scope_org_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_user_id IN
    SELECT DISTINCT team_user_id
    FROM (
      SELECT mt.user_id AS team_user_id
      FROM public.mission_team mt
      JOIN public.missions m ON m.id = mt.mission_id
      WHERE m.assignment_batch_id = p_batch_id

      UNION ALL

      SELECT m.primary_inspector_id
      FROM public.missions m
      WHERE m.assignment_batch_id = p_batch_id
    ) team_users
    WHERE team_user_id IS NOT NULL
  LOOP
    INSERT INTO public.mission_financial_settlements (
      mission_id,
      assignment_batch_id,
      user_id,
      scope_org_id,
      mission_days,
      overnight_nights
    )
    VALUES (
      v_anchor_mission_id,
      p_batch_id,
      v_user_id,
      v_scope_org_id,
      GREATEST(v_batch.actual_duration_days, 1),
      GREATEST(v_batch.actual_overnight_nights, 0)
    )
    ON CONFLICT (assignment_batch_id, user_id)
      WHERE assignment_batch_id IS NOT NULL
    DO UPDATE
    SET
      mission_id = EXCLUDED.mission_id,
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
    m.assignment_batch_id,
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

  -- Grouped assignments are financially settled once per batch, not once per
  -- child facility mission.
  IF v_mission.assignment_batch_id IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.finalize_mission_assignment_batch(
  p_batch_id UUID,
  p_actor_user_id UUID,
  p_actual_start_date DATE,
  p_actual_end_date DATE,
  p_actual_overnight_nights INTEGER,
  p_completion_disposition TEXT,
  p_timing_adjustment_reason TEXT DEFAULT NULL
)
RETURNS TABLE(
  batch_id UUID,
  actual_duration_days INTEGER,
  settlement_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_batch public.mission_assignment_batches%ROWTYPE;
  v_total INTEGER;
  v_completed INTEGER;
  v_duration INTEGER;
  v_settlements INTEGER;
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_timing_adjustment_reason, '')), '');
BEGIN
  SELECT *
  INTO v_batch
  FROM public.mission_assignment_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MISSION_BATCH_NOT_FOUND';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE status IN (
        'completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'
      )
    )
  INTO v_total, v_completed
  FROM public.missions
  WHERE assignment_batch_id = p_batch_id;

  IF v_total = 0 OR v_completed <> v_total THEN
    RAISE EXCEPTION 'MISSION_BATCH_NOT_FULLY_EXECUTED';
  END IF;

  IF p_actual_start_date IS NULL
     OR p_actual_end_date IS NULL
     OR p_actual_end_date < p_actual_start_date THEN
    RAISE EXCEPTION 'MISSION_BATCH_ACTUAL_DATES_INVALID';
  END IF;

  v_duration := (p_actual_end_date - p_actual_start_date) + 1;

  IF p_actual_overnight_nights IS NULL
     OR p_actual_overnight_nights < 0
     OR p_actual_overnight_nights > GREATEST(v_duration - 1, 0) THEN
    RAISE EXCEPTION 'MISSION_BATCH_ACTUAL_NIGHTS_INVALID';
  END IF;

  IF p_completion_disposition NOT IN (
    'return_to_base',
    'next_mission',
    'other'
  ) THEN
    RAISE EXCEPTION 'MISSION_BATCH_DISPOSITION_INVALID';
  END IF;

  IF (
       p_actual_start_date <> v_batch.scheduled_date
       OR p_actual_end_date <> v_batch.expected_end_date
     )
     AND v_reason IS NULL THEN
    RAISE EXCEPTION 'MISSION_BATCH_TIMING_REASON_REQUIRED';
  END IF;

  UPDATE public.mission_assignment_batches
  SET
    actual_start_date = p_actual_start_date,
    actual_end_date = p_actual_end_date,
    actual_overnight_nights = p_actual_overnight_nights,
    completion_disposition = p_completion_disposition,
    timing_adjustment_reason = v_reason,
    completed_by = p_actor_user_id,
    completed_at = NOW(),
    status = 'completed'
  WHERE id = p_batch_id;

  INSERT INTO public.mission_events (
    mission_id,
    user_id,
    event_type,
    description,
    metadata
  )
  SELECT
    m.id,
    p_actor_user_id,
    'assignment_batch_completed',
    'تم إنهاء التكليف المجمع وتثبيت مدته الفعلية بعد اكتمال جميع المنشآت.',
    jsonb_build_object(
      'assignment_batch_id', p_batch_id,
      'actual_start_date', p_actual_start_date,
      'actual_end_date', p_actual_end_date,
      'actual_duration_days', v_duration,
      'actual_overnight_nights', p_actual_overnight_nights,
      'completion_disposition', p_completion_disposition,
      'timing_adjustment_reason', v_reason
    )
  FROM public.missions m
  WHERE m.assignment_batch_id = p_batch_id;

  v_settlements :=
    public.ensure_assignment_batch_financial_settlements(p_batch_id);

  RETURN QUERY
  SELECT
    p_batch_id,
    v_duration,
    v_settlements;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_mission_financial_settlement_paid(
  p_settlement_id UUID,
  p_actor_user_id UUID,
  p_payment_reference TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_row public.mission_financial_settlements%ROWTYPE;
  v_reference TEXT := NULLIF(BTRIM(COALESCE(p_payment_reference, '')), '');
BEGIN
  IF v_reference IS NULL THEN
    RAISE EXCEPTION 'Payment reference is required';
  END IF;

  SELECT *
  INTO v_row
  FROM public.mission_financial_settlements
  WHERE id = p_settlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial settlement not found';
  END IF;

  IF v_row.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved settlement can be marked paid';
  END IF;

  UPDATE public.mission_financial_settlements
  SET
    status = 'paid',
    paid_by = p_actor_user_id,
    paid_at = NOW(),
    payment_reference = v_reference,
    updated_at = NOW()
  WHERE id = p_settlement_id;

  INSERT INTO public.mission_financial_events (
    settlement_id,
    mission_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    metadata
  )
  VALUES (
    p_settlement_id,
    v_row.mission_id,
    p_actor_user_id,
    'paid',
    v_row.status,
    'paid',
    jsonb_build_object(
      'total_amount', v_row.total_amount,
      'payment_reference', v_reference,
      'assignment_batch_id', v_row.assignment_batch_id
    )
  );

  IF v_row.assignment_batch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.mission_financial_settlements s
      WHERE s.assignment_batch_id = v_row.assignment_batch_id
        AND s.status <> 'paid'
    ) THEN
      UPDATE public.mission_assignment_batches
      SET status = 'closed'
      WHERE id = v_row.assignment_batch_id
        AND status = 'completed';

      UPDATE public.missions
      SET
        status = 'closed',
        updated_at = NOW()
      WHERE assignment_batch_id = v_row.assignment_batch_id
        AND status IN ('completed', 'done', 'منفذة', 'مكتملة');

      INSERT INTO public.mission_events (
        mission_id,
        user_id,
        event_type,
        description,
        metadata
      )
      SELECT
        m.id,
        p_actor_user_id,
        'mission_closed_financially',
        'تم إغلاق التكليف المجمع بعد صرف جميع الاستحقاقات المالية لأعضاء الفريق.',
        jsonb_build_object(
          'assignment_batch_id', v_row.assignment_batch_id,
          'closed_after_all_settlements_paid', TRUE
        )
      FROM public.missions m
      WHERE m.assignment_batch_id = v_row.assignment_batch_id;
    END IF;

    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.mission_financial_settlements s
    WHERE s.mission_id = v_row.mission_id
      AND s.assignment_batch_id IS NULL
      AND s.status <> 'paid'
  ) THEN
    UPDATE public.missions
    SET
      status = 'closed',
      updated_at = NOW()
    WHERE id = v_row.mission_id
      AND status IN ('completed', 'done', 'منفذة', 'مكتملة');

    IF FOUND THEN
      INSERT INTO public.mission_events (
        mission_id,
        user_id,
        event_type,
        description,
        metadata
      )
      VALUES (
        v_row.mission_id,
        p_actor_user_id,
        'mission_closed_financially',
        'تم إغلاق المأمورية بعد صرف جميع الاستحقاقات المالية لأعضاء الفريق.',
        jsonb_build_object(
          'closed_after_all_settlements_paid', TRUE
        )
      );
    END IF;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_assignment_batch_actual_timing()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_assignment_batch_actual_timing()
  TO service_role;

REVOKE ALL ON FUNCTION public.ensure_assignment_batch_financial_settlements(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_assignment_batch_financial_settlements(UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.finalize_mission_assignment_batch(
  UUID, UUID, DATE, DATE, INTEGER, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_mission_assignment_batch(
  UUID, UUID, DATE, DATE, INTEGER, TEXT, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.ensure_mission_financial_settlements(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_mission_financial_settlements(UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.mark_mission_financial_settlement_paid(
  UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_mission_financial_settlement_paid(
  UUID, UUID, TEXT
) TO service_role;

COMMIT;
