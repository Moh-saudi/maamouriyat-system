-- ==============================================================================
-- Script 70: Signed report gate before grouped assignment reaches finance
-- ==============================================================================

BEGIN;

ALTER TABLE public.mission_assignment_batches
  ADD COLUMN IF NOT EXISTS report_submitted_to_finance_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_submitted_to_finance_by UUID
    REFERENCES public.users(id);

-- Finalizing field execution records the real duration and opens the report.
-- It must NOT create finance rows yet.
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
    status = 'completed',
    report_submitted_to_finance_at = NULL,
    report_submitted_to_finance_by = NULL
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
    'تم إنهاء التنفيذ الميداني للتكليف المجمع وتثبيت مدته الفعلية. التقرير جاهز للمراجعة والطباعة والتوقيع قبل إرساله للمالية.',
    jsonb_build_object(
      'assignment_batch_id', p_batch_id,
      'actual_start_date', p_actual_start_date,
      'actual_end_date', p_actual_end_date,
      'actual_duration_days', v_duration,
      'actual_overnight_nights', p_actual_overnight_nights,
      'completion_disposition', p_completion_disposition,
      'timing_adjustment_reason', v_reason,
      'finance_pending_signed_report', TRUE
    )
  FROM public.missions m
  WHERE m.assignment_batch_id = p_batch_id;

  RETURN QUERY
  SELECT
    p_batch_id,
    v_duration,
    0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_mission_assignment_report_to_finance(
  p_batch_id UUID,
  p_actor_user_id UUID
)
RETURNS TABLE(
  batch_id UUID,
  settlement_count INTEGER,
  submitted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_batch public.mission_assignment_batches%ROWTYPE;
  v_total INTEGER;
  v_completed INTEGER;
  v_settlements INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO v_batch
  FROM public.mission_assignment_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MISSION_BATCH_NOT_FOUND';
  END IF;

  IF v_batch.status NOT IN ('completed', 'closed')
     OR v_batch.actual_start_date IS NULL
     OR v_batch.actual_end_date IS NULL
     OR v_batch.actual_duration_days IS NULL
     OR v_batch.actual_overnight_nights IS NULL THEN
    RAISE EXCEPTION 'MISSION_BATCH_REPORT_NOT_READY';
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

  IF v_batch.report_submitted_to_finance_at IS NOT NULL THEN
    RETURN QUERY
    SELECT
      p_batch_id,
      (
        SELECT COUNT(*)::INTEGER
        FROM public.mission_financial_settlements s
        WHERE s.assignment_batch_id = p_batch_id
      ),
      v_batch.report_submitted_to_finance_at;
    RETURN;
  END IF;

  v_settlements :=
    public.ensure_assignment_batch_financial_settlements(p_batch_id);

  UPDATE public.mission_assignment_batches
  SET
    report_submitted_to_finance_at = v_now,
    report_submitted_to_finance_by = p_actor_user_id
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
    'signed_report_submitted_to_finance',
    'تم تأكيد مراجعة وتوقيع تقرير التكليف وإرساله إلى الشئون المالية.',
    jsonb_build_object(
      'assignment_batch_id', p_batch_id,
      'settlement_count', v_settlements,
      'submitted_at', v_now
    )
  FROM public.missions m
  WHERE m.assignment_batch_id = p_batch_id;

  RETURN QUERY
  SELECT p_batch_id, v_settlements, v_now;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_mission_assignment_batch(
  UUID, UUID, DATE, DATE, INTEGER, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_mission_assignment_batch(
  UUID, UUID, DATE, DATE, INTEGER, TEXT, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.submit_mission_assignment_report_to_finance(
  UUID, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_mission_assignment_report_to_finance(
  UUID, UUID
) TO service_role;

COMMIT;
