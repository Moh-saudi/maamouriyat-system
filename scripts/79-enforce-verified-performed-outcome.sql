-- Prevent a performed facility visit from reaching a terminal state without
-- verified field coordinates and start/end timestamps.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_verified_performed_outcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF COALESCE(NEW.status, '') IN (
       'completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'
     )
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.execution_outcome IS DISTINCT FROM NEW.execution_outcome
     )
     AND NEW.execution_outcome = 'performed'
  THEN
    IF NEW.checkin_time IS NULL
       OR NEW.checkout_time IS NULL
       OR NEW.checkin_lat IS NULL
       OR NEW.checkin_lng IS NULL
       OR NEW.checkout_lat IS NULL
       OR NEW.checkout_lng IS NULL
    THEN
      RAISE EXCEPTION
        'MISSION_FIELD_EVIDENCE_REQUIRED: performed outcome requires field coordinates and timestamps';
    END IF;

    IF COALESCE(NEW.gps_verified, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION
        'MISSION_GPS_VERIFICATION_REQUIRED: performed outcome must be verified within the facility range';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_verified_performed_outcome
  ON public.missions;

CREATE TRIGGER trg_guard_verified_performed_outcome
BEFORE UPDATE ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.guard_verified_performed_outcome();

REVOKE ALL ON FUNCTION public.guard_verified_performed_outcome()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_verified_performed_outcome()
  TO service_role;

COMMIT;
