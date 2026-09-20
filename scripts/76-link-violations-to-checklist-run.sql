-- ==============================================================================
-- Script 76: Keep violation audit consistent when a mission checklist changes
-- ==============================================================================

BEGIN;

ALTER TABLE public.violations
  ADD COLUMN IF NOT EXISTS checklist_run_id UUID
    REFERENCES public.mission_checklist_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_violations_checklist_run
  ON public.violations(checklist_run_id, record_state, status);

CREATE OR REPLACE FUNCTION public.change_mission_checklist_template(
  p_mission_id UUID,
  p_template_id UUID,
  p_actor_user_id UUID,
  p_reason TEXT
)
RETURNS TABLE(
  checklist_run_id UUID,
  template_id UUID,
  template_name TEXT,
  template_version TEXT,
  archived_answer_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_mission public.missions%ROWTYPE;
  v_template public.form_templates%ROWTYPE;
  v_current public.mission_checklist_runs%ROWTYPE;
  v_new_run_id UUID;
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
  v_answers INTEGER := 0;
  v_blocking_violations INTEGER := 0;
  v_voided_violations INTEGER := 0;
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'MISSION_TEMPLATE_CHANGE_REASON_REQUIRED';
  END IF;

  SELECT *
  INTO v_mission
  FROM public.missions
  WHERE id = p_mission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MISSION_NOT_FOUND';
  END IF;

  IF v_mission.status IN (
    'completed', 'closed', 'done', 'cancelled', 'rejected',
    'منفذة', 'مكتملة', 'مغلقة', 'ملغاة', 'مرفوضة'
  ) THEN
    RAISE EXCEPTION 'MISSION_TEMPLATE_CHANGE_LOCKED';
  END IF;

  SELECT *
  INTO v_template
  FROM public.form_templates
  WHERE id = p_template_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MISSION_TEMPLATE_NOT_AVAILABLE';
  END IF;

  SELECT *
  INTO v_current
  FROM public.mission_checklist_runs
  WHERE mission_id = p_mission_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_current.template_id = p_template_id THEN
    RETURN QUERY
    SELECT
      v_current.id,
      v_current.template_id,
      v_current.template_name,
      v_current.template_version,
      0;
    RETURN;
  END IF;

  IF FOUND THEN
    SELECT COUNT(*)::INTEGER
    INTO v_blocking_violations
    FROM public.violations v
    WHERE v.checklist_run_id = v_current.id
      AND v.record_state = 'active'
      AND COALESCE(v.status, 'new') <> 'new';

    IF v_blocking_violations > 0 THEN
      RAISE EXCEPTION
        'MISSION_TEMPLATE_CHANGE_HAS_ACTIVE_CORRECTION:%',
        v_blocking_violations;
    END IF;

    UPDATE public.violations AS v
    SET
      record_state = 'voided',
      voided_at = NOW(),
      voided_by = p_actor_user_id,
      void_reason =
        'استبعاد موثق: تم استبدال استمارة المأمورية قبل بدء إجراءات التصحيح. السبب: '
        || v_reason,
      updated_at = NOW()
    WHERE v.checklist_run_id = v_current.id
      AND v.record_state = 'active'
      AND COALESCE(v.status, 'new') = 'new';

    GET DIAGNOSTICS v_voided_violations = ROW_COUNT;

    SELECT COUNT(*)::INTEGER
    INTO v_answers
    FROM public.mission_results mr
    WHERE mr.checklist_run_id = v_current.id;

    UPDATE public.mission_checklist_runs
    SET
      status = 'archived',
      archived_by = p_actor_user_id,
      archived_at = NOW()
    WHERE id = v_current.id;
  ELSE
    v_answers := (
      SELECT COUNT(*)::INTEGER
      FROM public.mission_results mr
      WHERE mr.mission_id = p_mission_id
        AND mr.checklist_run_id IS NULL
    );
  END IF;

  INSERT INTO public.mission_checklist_runs (
    mission_id,
    template_id,
    template_name,
    template_version,
    status,
    source_type,
    previous_run_id,
    started_by,
    change_reason
  )
  VALUES (
    p_mission_id,
    p_template_id,
    v_template.name,
    v_template.version,
    'active',
    'replacement',
    CASE WHEN v_current.id IS NOT NULL THEN v_current.id ELSE NULL END,
    p_actor_user_id,
    v_reason
  )
  RETURNING id INTO v_new_run_id;

  UPDATE public.missions
  SET
    template_id = p_template_id,
    updated_at = NOW()
  WHERE id = p_mission_id;

  INSERT INTO public.mission_events (
    mission_id,
    user_id,
    event_type,
    description,
    metadata
  )
  VALUES (
    p_mission_id,
    p_actor_user_id,
    'checklist_template_changed',
    'تم تغيير استمارة المأمورية مع الاحتفاظ بسجل الاستمارة السابقة وإجاباتها واستبعاد المخالفات الأولية المرتبطة بها بصورة موثقة.',
    jsonb_build_object(
      'previous_template_id',
      CASE WHEN v_current.id IS NOT NULL THEN v_current.template_id ELSE v_mission.template_id END,
      'new_template_id', p_template_id,
      'new_template_name', v_template.name,
      'reason', v_reason,
      'archived_answer_count', v_answers,
      'voided_new_violation_count', v_voided_violations,
      'new_checklist_run_id', v_new_run_id
    )
  );

  RETURN QUERY
  SELECT
    v_new_run_id,
    p_template_id,
    v_template.name,
    v_template.version,
    v_answers;
END;
$function$;

COMMIT;
