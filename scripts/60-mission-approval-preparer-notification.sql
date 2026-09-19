-- ==============================================================================
-- Script 60: Notify assignment preparer after approval
-- ==============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.approve_v2_mission_assignment_batch(
  p_batch_id UUID,
  p_actor_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_batch public.mission_assignment_batches%ROWTYPE;
  v_mission RECORD;
  v_team RECORD;
  v_count INTEGER := 0;
BEGIN
  SELECT *
  INTO v_batch
  FROM public.mission_assignment_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission assignment batch not found';
  END IF;

  IF v_batch.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only pending assignment batch can be approved';
  END IF;

  UPDATE public.mission_assignment_batches
  SET
    status = 'approved',
    approved_by = p_actor_user_id,
    approved_at = NOW(),
    rejected_by = NULL,
    rejected_at = NULL,
    rejection_reason = NULL
  WHERE id = p_batch_id;

  FOR v_mission IN
    UPDATE public.missions
    SET
      status = 'approved',
      approved_by = p_actor_user_id,
      rejection_reason = NULL,
      updated_at = NOW()
    WHERE assignment_batch_id = p_batch_id
      AND status = 'pending_approval'
    RETURNING id, serial_number, facility_id, scheduled_date
  LOOP
    INSERT INTO public.mission_events (
      mission_id, user_id, event_type, description, metadata
    )
    VALUES (
      v_mission.id,
      p_actor_user_id,
      'assignment_approved',
      'تم اعتماد تكليف المأمورية.',
      jsonb_build_object('assignment_batch_id', p_batch_id)
    );

    FOR v_team IN
      SELECT mt.user_id, f.name AS facility_name
      FROM public.mission_team mt
      JOIN public.facilities f ON f.id = v_mission.facility_id
      WHERE mt.mission_id = v_mission.id
    LOOP
      INSERT INTO public.notifications (
        user_id, mission_id, type, title, body
      )
      VALUES (
        v_team.user_id,
        v_mission.id,
        'mission_assigned',
        'تكليف مأمورية جديد',
        'تم اعتماد تكليفك بالمأمورية رقم ' || v_mission.serial_number ||
        ' على ' || v_team.facility_name ||
        ' بتاريخ ' || TO_CHAR(v_mission.scheduled_date, 'YYYY-MM-DD') || '.'
      );
    END LOOP;

    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.notifications (
    user_id, type, title, body
  )
  VALUES (
    v_batch.created_by,
    'mission_assignment_approved',
    'تم اعتماد دفعة التكليف',
    'تم اعتماد دفعة التكليف التي أعددتها وعدد مأمورياتها ' ||
    v_count::TEXT || '.'
  );

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_v2_mission_assignment_batch(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_v2_mission_assignment_batch(UUID, UUID)
  TO service_role;

COMMIT;
