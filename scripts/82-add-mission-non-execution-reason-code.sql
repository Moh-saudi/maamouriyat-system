-- Store a normalized reason category for accurate operational analytics.
BEGIN;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS non_execution_reason_code TEXT;

ALTER TABLE public.missions
  DROP CONSTRAINT IF EXISTS missions_non_execution_reason_code_check;

ALTER TABLE public.missions
  ADD CONSTRAINT missions_non_execution_reason_code_check
  CHECK (
    non_execution_reason_code IS NULL
    OR non_execution_reason_code IN (
      'facility_closed',
      'access_blocked',
      'reception_refused',
      'wrong_address',
      'facility_changed',
      'team_emergency',
      'other'
    )
  );

CREATE INDEX IF NOT EXISTS idx_missions_non_execution_reason_code
  ON public.missions(non_execution_reason_code)
  WHERE execution_outcome = 'not_performed';

COMMENT ON COLUMN public.missions.non_execution_reason_code IS
  'Normalized category for a terminal not_performed field outcome.';

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

CREATE OR REPLACE FUNCTION public.guard_verified_assignment_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.status = 'completed'
     AND COALESCE(OLD.status, '') NOT IN ('completed', 'closed')
     AND EXISTS (
       SELECT 1
       FROM public.missions m
       WHERE m.assignment_batch_id = NEW.id
         AND NOT (
           m.status IN (
             'completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'
           )
           AND m.execution_outcome IN ('performed', 'not_performed')
           AND m.outcome_recorded_by IS NOT NULL
           AND m.outcome_recorded_at IS NOT NULL
           AND m.checkin_time IS NOT NULL
           AND m.checkout_time IS NOT NULL
           AND m.checkin_lat IS NOT NULL
           AND m.checkin_lng IS NOT NULL
           AND m.checkout_lat IS NOT NULL
           AND m.checkout_lng IS NOT NULL
           AND (
             (
               m.execution_outcome = 'performed'
               AND COALESCE(m.gps_verified, FALSE) IS TRUE
             )
             OR (
               m.execution_outcome = 'not_performed'
               AND m.non_execution_reason_code IN (
                 'facility_closed',
                 'access_blocked',
                 'reception_refused',
                 'wrong_address',
                 'facility_changed',
                 'team_emergency',
                 'other'
               )
               AND length(BTRIM(COALESCE(m.non_execution_reason, ''))) >= 5
             )
           )
         )
     ) THEN
    RAISE EXCEPTION
      'MISSION_BATCH_OUTCOME_NOT_VERIFIED: every facility requires a verified terminal outcome';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_verified_assignment_completion()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_verified_assignment_completion()
  TO service_role;

COMMIT;
