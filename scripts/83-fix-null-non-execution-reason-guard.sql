-- Treat a NULL reason category as invalid when a mission is marked not performed.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_verified_terminal_mission_outcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_becoming_terminal BOOLEAN;
BEGIN
  v_becoming_terminal :=
    COALESCE(NEW.status, '') IN (
      'completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'
    )
    AND COALESCE(OLD.status, '') NOT IN (
      'completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'
    );

  IF NOT v_becoming_terminal THEN
    RETURN NEW;
  END IF;

  IF NEW.execution_outcome NOT IN ('performed', 'not_performed')
     OR NEW.outcome_recorded_by IS NULL
     OR NEW.outcome_recorded_at IS NULL
     OR NEW.checkin_time IS NULL
     OR NEW.checkout_time IS NULL
     OR NEW.checkin_lat IS NULL
     OR NEW.checkin_lng IS NULL
     OR NEW.checkout_lat IS NULL
     OR NEW.checkout_lng IS NULL THEN
    RAISE EXCEPTION
      'MISSION_FIELD_OUTCOME_REQUIRED: terminal mission requires outcome, actor, coordinates and timestamps';
  END IF;

  IF NEW.execution_outcome = 'performed'
     AND COALESCE(NEW.gps_verified, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION
      'MISSION_GPS_VERIFICATION_REQUIRED: performed outcome must be verified within the facility range';
  END IF;

  IF NEW.execution_outcome = 'not_performed'
     AND (
       COALESCE(NEW.non_execution_reason_code, '') NOT IN (
         'facility_closed',
         'access_blocked',
         'reception_refused',
         'wrong_address',
         'facility_changed',
         'team_emergency',
         'other'
       )
       OR length(BTRIM(COALESCE(NEW.non_execution_reason, ''))) < 5
     ) THEN
    RAISE EXCEPTION
      'MISSION_NON_EXECUTION_REASON_REQUIRED: non-performed outcome requires a reason category and details';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_verified_terminal_mission_outcome()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_verified_terminal_mission_outcome()
  TO service_role;

COMMIT;
