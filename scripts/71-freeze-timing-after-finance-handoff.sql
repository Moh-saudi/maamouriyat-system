-- ==============================================================================
-- Script 71: Freeze grouped assignment timing after finance handoff
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_submitted_assignment_financial_basis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD.report_submitted_to_finance_at IS NOT NULL
     AND (
       OLD.actual_start_date IS DISTINCT FROM NEW.actual_start_date
       OR OLD.actual_end_date IS DISTINCT FROM NEW.actual_end_date
       OR OLD.actual_overnight_nights IS DISTINCT FROM NEW.actual_overnight_nights
       OR OLD.completion_disposition IS DISTINCT FROM NEW.completion_disposition
       OR OLD.timing_adjustment_reason IS DISTINCT FROM NEW.timing_adjustment_reason
       OR OLD.report_submitted_to_finance_at IS DISTINCT FROM NEW.report_submitted_to_finance_at
       OR OLD.report_submitted_to_finance_by IS DISTINCT FROM NEW.report_submitted_to_finance_by
     ) THEN
    RAISE EXCEPTION
      'MISSION_BATCH_FINANCE_ALREADY_STARTED: actual timing is frozen after the signed report is submitted to finance';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_submitted_assignment_financial_basis
  ON public.mission_assignment_batches;

CREATE TRIGGER trg_guard_submitted_assignment_financial_basis
BEFORE UPDATE OF
  actual_start_date,
  actual_end_date,
  actual_overnight_nights,
  completion_disposition,
  timing_adjustment_reason,
  report_submitted_to_finance_at,
  report_submitted_to_finance_by
ON public.mission_assignment_batches
FOR EACH ROW
EXECUTE FUNCTION public.guard_submitted_assignment_financial_basis();

REVOKE ALL ON FUNCTION public.guard_submitted_assignment_financial_basis()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_submitted_assignment_financial_basis()
  TO service_role;

COMMIT;
