-- ==============================================================================
-- Script 73: Harden direct mission execution updates
-- - Issuer/creator may edit only before execution.
-- - Field execution updates require actual team membership.
-- - Assignment identity is immutable from authenticated clients once approved.
-- ==============================================================================

BEGIN;

DROP POLICY IF EXISTS missions_update ON public.missions;

CREATE POLICY missions_update
ON public.missions
FOR UPDATE
TO authenticated
USING (
  (
    COALESCE(status, 'draft') NOT IN (
      'completed', 'closed', 'done', 'cancelled',
      'منفذة', 'مكتملة', 'مغلقة', 'ملغاة'
    )
    AND (
      primary_inspector_id = (
        SELECT ctx.user_id
        FROM public.get_current_user_data() ctx
      )
      OR assigned_user_id = (
        SELECT ctx.user_id
        FROM public.get_current_user_data() ctx
      )
      OR EXISTS (
        SELECT 1
        FROM public.mission_team mt
        WHERE mt.mission_id = missions.id
          AND mt.user_id = (
            SELECT ctx.user_id
            FROM public.get_current_user_data() ctx
          )
      )
    )
  )
  OR (
    created_by = (
      SELECT ctx.user_id
      FROM public.get_current_user_data() ctx
    )
    AND COALESCE(status, 'draft') IN (
      'draft', 'pending_approval', 'rejected', 'مرفوضة'
    )
  )
)
WITH CHECK (
  (
    (
      primary_inspector_id = (
        SELECT ctx.user_id
        FROM public.get_current_user_data() ctx
      )
      OR assigned_user_id = (
        SELECT ctx.user_id
        FROM public.get_current_user_data() ctx
      )
      OR EXISTS (
        SELECT 1
        FROM public.mission_team mt
        WHERE mt.mission_id = missions.id
          AND mt.user_id = (
            SELECT ctx.user_id
            FROM public.get_current_user_data() ctx
          )
      )
    )
    AND COALESCE(status, 'draft') NOT IN (
      'closed', 'done', 'cancelled', 'rejected',
      'مغلقة', 'ملغاة', 'مرفوضة'
    )
  )
  OR (
    created_by = (
      SELECT ctx.user_id
      FROM public.get_current_user_data() ctx
    )
    AND COALESCE(status, 'draft') IN (
      'draft', 'pending_approval', 'rejected', 'مرفوضة'
    )
  )
);

CREATE OR REPLACE FUNCTION public.guard_authenticated_mission_execution_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_old_status TEXT := COALESCE(OLD.status, 'draft');
  v_new_status TEXT := COALESCE(NEW.status, 'draft');
BEGIN
  -- Server-side service-role workflows remain authoritative.
  IF CURRENT_USER IN ('service_role', 'postgres') THEN
    RETURN NEW;
  END IF;

  IF CURRENT_USER <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF v_old_status IN ('approved', 'in_progress') THEN
    IF OLD.facility_id IS DISTINCT FROM NEW.facility_id
       OR OLD.target_facility_id IS DISTINCT FROM NEW.target_facility_id
       OR OLD.template_id IS DISTINCT FROM NEW.template_id
       OR OLD.assignment_batch_id IS DISTINCT FROM NEW.assignment_batch_id
       OR OLD.primary_inspector_id IS DISTINCT FROM NEW.primary_inspector_id
       OR OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id
       OR OLD.inspector_org_id IS DISTINCT FROM NEW.inspector_org_id
       OR OLD.created_by IS DISTINCT FROM NEW.created_by
       OR OLD.created_by_org IS DISTINCT FROM NEW.created_by_org
       OR OLD.sector_id IS DISTINCT FROM NEW.sector_id
       OR OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date
       OR OLD.expected_end_date IS DISTINCT FROM NEW.expected_end_date
       OR OLD.visit_purpose IS DISTINCT FROM NEW.visit_purpose
    THEN
      RAISE EXCEPTION
        'MISSION_ASSIGNMENT_FIELDS_LOCKED_DURING_EXECUTION';
    END IF;

    IF v_old_status = 'approved'
       AND v_new_status NOT IN ('approved', 'in_progress', 'completed', 'منفذة', 'مكتملة')
    THEN
      RAISE EXCEPTION 'MISSION_EXECUTION_STATUS_TRANSITION_INVALID';
    END IF;

    IF v_old_status = 'in_progress'
       AND v_new_status NOT IN ('in_progress', 'completed', 'منفذة', 'مكتملة')
    THEN
      RAISE EXCEPTION 'MISSION_EXECUTION_STATUS_TRANSITION_INVALID';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_authenticated_mission_execution_update
  ON public.missions;

CREATE TRIGGER trg_guard_authenticated_mission_execution_update
BEFORE UPDATE ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.guard_authenticated_mission_execution_update();

COMMIT;
