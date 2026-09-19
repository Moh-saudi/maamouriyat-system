-- ==============================================================================
-- Script 73: Harden mission execution writes to assigned team members only
--            and reset stale scoring when a checklist is replaced.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_mission_execution_team_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_auth_id UUID;
  v_profile_id UUID;
  v_sensitive_change BOOLEAN;
BEGIN
  v_auth_id := auth.uid();

  -- Trusted server/service-role operations have no end-user auth.uid().
  IF v_auth_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.template_id IS DISTINCT FROM NEW.template_id
     OR OLD.team_template_change_allowed IS DISTINCT FROM NEW.team_template_change_allowed
     OR OLD.template_change_allowed_by IS DISTINCT FROM NEW.template_change_allowed_by
     OR OLD.template_change_allowed_at IS DISTINCT FROM NEW.template_change_allowed_at THEN
    RAISE EXCEPTION
      'MISSION_TEMPLATE_CHANGE_API_REQUIRED: checklist governance changes must use the secured mission checklist API';
  END IF;

  v_sensitive_change :=
       OLD.status IS DISTINCT FROM NEW.status
    OR OLD.checkin_lat IS DISTINCT FROM NEW.checkin_lat
    OR OLD.checkin_lng IS DISTINCT FROM NEW.checkin_lng
    OR OLD.checkin_time IS DISTINCT FROM NEW.checkin_time
    OR OLD.checkout_lat IS DISTINCT FROM NEW.checkout_lat
    OR OLD.checkout_lng IS DISTINCT FROM NEW.checkout_lng
    OR OLD.checkout_time IS DISTINCT FROM NEW.checkout_time
    OR OLD.gps_verified IS DISTINCT FROM NEW.gps_verified
    OR OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes
    OR OLD.total_score IS DISTINCT FROM NEW.total_score
    OR OLD.max_score IS DISTINCT FROM NEW.max_score
    OR OLD.score_pct IS DISTINCT FROM NEW.score_pct
    OR OLD.total_criteria IS DISTINCT FROM NEW.total_criteria
    OR OLD.violations_count IS DISTINCT FROM NEW.violations_count
    OR OLD.violation_count IS DISTINCT FROM NEW.violation_count
    OR OLD.actual_facility_id IS DISTINCT FROM NEW.actual_facility_id
    OR OLD.actual_governorate_id IS DISTINCT FROM NEW.actual_governorate_id
    OR OLD.destination_changed IS DISTINCT FROM NEW.destination_changed
    OR OLD.change_reason IS DISTINCT FROM NEW.change_reason
    OR OLD.execution_notes IS DISTINCT FROM NEW.execution_notes
    OR OLD.completed_at IS DISTINCT FROM NEW.completed_at
    OR OLD.actual_start_date IS DISTINCT FROM NEW.actual_start_date
    OR OLD.actual_end_date IS DISTINCT FROM NEW.actual_end_date
    OR OLD.actual_overnight_nights IS DISTINCT FROM NEW.actual_overnight_nights
    OR OLD.completion_disposition IS DISTINCT FROM NEW.completion_disposition
    OR OLD.timing_adjustment_reason IS DISTINCT FROM NEW.timing_adjustment_reason
    OR OLD.actual_timing_confirmed_by IS DISTINCT FROM NEW.actual_timing_confirmed_by
    OR OLD.actual_timing_confirmed_at IS DISTINCT FROM NEW.actual_timing_confirmed_at;

  IF NOT v_sensitive_change THEN
    RETURN NEW;
  END IF;

  SELECT u.id
  INTO v_profile_id
  FROM public.users u
  WHERE u.auth_id = v_auth_id
    AND u.is_active = TRUE
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'MISSION_EXECUTION_PROFILE_REQUIRED';
  END IF;

  IF NOT (
       OLD.assigned_user_id = v_profile_id
    OR OLD.primary_inspector_id = v_profile_id
    OR EXISTS (
      SELECT 1
      FROM public.mission_team mt
      WHERE mt.mission_id = OLD.id
        AND mt.user_id = v_profile_id
    )
  ) THEN
    RAISE EXCEPTION
      'MISSION_TEAM_EXECUTION_REQUIRED: only an assigned mission team member may record field execution';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_mission_execution_team_write
  ON public.missions;

CREATE TRIGGER trg_guard_mission_execution_team_write
BEFORE UPDATE ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.guard_mission_execution_team_write();

CREATE OR REPLACE FUNCTION public.reset_mission_score_on_checklist_replacement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.source_type = 'replacement' THEN
    UPDATE public.missions
    SET
      total_score = 0,
      max_score = 0,
      score_pct = NULL,
      total_criteria = 0,
      violations_count = 0,
      violation_count = 0,
      updated_at = NOW()
    WHERE id = NEW.mission_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reset_mission_score_on_checklist_replacement
  ON public.mission_checklist_runs;

CREATE TRIGGER trg_reset_mission_score_on_checklist_replacement
AFTER INSERT ON public.mission_checklist_runs
FOR EACH ROW
EXECUTE FUNCTION public.reset_mission_score_on_checklist_replacement();

REVOKE ALL ON FUNCTION public.guard_mission_execution_team_write()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_mission_execution_team_write()
  TO service_role;

REVOKE ALL ON FUNCTION public.reset_mission_score_on_checklist_replacement()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_mission_score_on_checklist_replacement()
  TO service_role;

COMMIT;
