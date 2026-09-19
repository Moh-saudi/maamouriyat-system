-- ==============================================================================
-- Script 72: Govern mission checklists, preserve replaced answers, and add
--            mission-level delegation for team template changes.
-- ==============================================================================

BEGIN;

INSERT INTO public.permissions (
  key,
  module,
  action,
  display_name_ar,
  description_ar,
  is_sensitive,
  is_active,
  sort_order
)
VALUES (
  'missions.checklist_change',
  'missions',
  'checklist_change',
  'إدارة استمارة المأمورية',
  'تغيير الاستمارة المرتبطة بالمأمورية أو السماح لأعضاء الفريق بتغييرها مع تسجيل سبب التغيير وسجل التدقيق.',
  FALSE,
  TRUE,
  275
)
ON CONFLICT (key) DO UPDATE
SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  display_name_ar = EXCLUDED.display_name_ar,
  description_ar = EXCLUDED.description_ar,
  is_sensitive = EXCLUDED.is_sensitive,
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  'missions.checklist_change',
  CASE
    WHEN r.code IN ('system_superadmin', 'system_techadmin') THEN 'national'
    ELSE 'organization_tree'
  END
FROM public.roles r
WHERE r.code IN (
  'system_superadmin',
  'system_techadmin',
  'information_center'
)
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS team_template_change_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS template_change_allowed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS template_change_allowed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.mission_checklist_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.form_templates(id),
  template_name TEXT NOT NULL,
  template_version TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source_type TEXT NOT NULL DEFAULT 'original',
  previous_run_id UUID REFERENCES public.mission_checklist_runs(id) ON DELETE SET NULL,
  started_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mission_checklist_runs_status_check
    CHECK (status IN ('active', 'archived', 'completed')),
  CONSTRAINT mission_checklist_runs_source_type_check
    CHECK (source_type IN ('original', 'replacement'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mission_checklist_runs_active
  ON public.mission_checklist_runs(mission_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_mission_checklist_runs_mission
  ON public.mission_checklist_runs(mission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mission_checklist_runs_template
  ON public.mission_checklist_runs(template_id);

ALTER TABLE public.mission_results
  ADD COLUMN IF NOT EXISTS checklist_run_id UUID
    REFERENCES public.mission_checklist_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mission_results_checklist_run
  ON public.mission_results(checklist_run_id);

INSERT INTO public.mission_checklist_runs (
  mission_id,
  template_id,
  template_name,
  template_version,
  status,
  source_type,
  started_by,
  started_at
)
SELECT
  m.id,
  m.template_id,
  ft.name,
  ft.version,
  'active',
  'original',
  m.created_by,
  COALESCE(m.created_at, NOW())
FROM public.missions m
JOIN public.form_templates ft ON ft.id = m.template_id
WHERE m.template_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.mission_checklist_runs r
    WHERE r.mission_id = m.id
      AND r.status = 'active'
  );

UPDATE public.mission_results mr
SET checklist_run_id = r.id
FROM public.mission_checklist_runs r
WHERE mr.mission_id = r.mission_id
  AND r.status = 'active'
  AND mr.checklist_run_id IS NULL;

CREATE OR REPLACE FUNCTION public.ensure_active_mission_checklist_run(
  p_mission_id UUID,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_run_id UUID;
  v_template RECORD;
BEGIN
  SELECT id
  INTO v_run_id
  FROM public.mission_checklist_runs
  WHERE mission_id = p_mission_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_run_id IS NOT NULL THEN
    RETURN v_run_id;
  END IF;

  SELECT
    m.template_id,
    ft.name,
    ft.version
  INTO v_template
  FROM public.missions m
  JOIN public.form_templates ft ON ft.id = m.template_id
  WHERE m.id = p_mission_id
    AND m.template_id IS NOT NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.mission_checklist_runs (
    mission_id,
    template_id,
    template_name,
    template_version,
    status,
    source_type,
    started_by
  )
  VALUES (
    p_mission_id,
    v_template.template_id,
    v_template.name,
    v_template.version,
    'active',
    'original',
    p_actor_user_id
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$function$;

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
    INTO v_answers
    FROM public.mission_results
    WHERE checklist_run_id = v_current.id;

    UPDATE public.mission_checklist_runs
    SET
      status = 'archived',
      archived_by = p_actor_user_id,
      archived_at = NOW()
    WHERE id = v_current.id;
  ELSE
    v_answers := (
      SELECT COUNT(*)::INTEGER
      FROM public.mission_results
      WHERE mission_id = p_mission_id
        AND checklist_run_id IS NULL
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
    'تم تغيير استمارة المأمورية مع الاحتفاظ بسجل الاستمارة السابقة وإجاباتها.',
    jsonb_build_object(
      'previous_template_id',
      CASE WHEN v_current.id IS NOT NULL THEN v_current.template_id ELSE v_mission.template_id END,
      'new_template_id', p_template_id,
      'new_template_name', v_template.name,
      'reason', v_reason,
      'archived_answer_count', v_answers,
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

CREATE OR REPLACE FUNCTION public.set_mission_team_template_change_allowed(
  p_mission_id UUID,
  p_actor_user_id UUID,
  p_allowed BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  UPDATE public.missions
  SET
    team_template_change_allowed = p_allowed,
    template_change_allowed_by = p_actor_user_id,
    template_change_allowed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_mission_id
    AND status NOT IN (
      'completed', 'closed', 'done', 'cancelled', 'rejected',
      'منفذة', 'مكتملة', 'مغلقة', 'ملغاة', 'مرفوضة'
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MISSION_TEMPLATE_CHANGE_LOCKED_OR_NOT_FOUND';
  END IF;

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
    'team_checklist_change_permission_updated',
    CASE
      WHEN p_allowed
        THEN 'تم السماح لأعضاء فريق المأمورية بتغيير الاستمارة مع تسجيل السبب.'
      ELSE 'تم إيقاف إمكانية تغيير الاستمارة لأعضاء فريق المأمورية.'
    END,
    jsonb_build_object('allowed', p_allowed)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.replace_mission_results(
  p_mission_id UUID,
  p_results JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_run_id UUID;
BEGIN
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RAISE EXCEPTION 'p_results must be a JSON array';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.missions WHERE id = p_mission_id
  ) THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  v_run_id := public.ensure_active_mission_checklist_run(
    p_mission_id,
    NULL
  );

  IF v_run_id IS NOT NULL THEN
    DELETE FROM public.mission_results
    WHERE mission_id = p_mission_id
      AND checklist_run_id = v_run_id;
  ELSE
    DELETE FROM public.mission_results
    WHERE mission_id = p_mission_id
      AND checklist_run_id IS NULL;
  END IF;

  INSERT INTO public.mission_results (
    mission_id,
    checklist_run_id,
    checklist_item_id,
    answer,
    notes,
    photo_url
  )
  SELECT
    p_mission_id,
    v_run_id,
    NULLIF(item->>'checklist_item_id', '')::UUID,
    NULLIF(item->>'answer', ''),
    NULLIF(item->>'notes', ''),
    NULLIF(item->>'photo_url', '')
  FROM jsonb_array_elements(p_results) AS item;
END;
$function$;

REVOKE ALL ON TABLE public.mission_checklist_runs
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mission_checklist_runs TO service_role;

REVOKE ALL ON FUNCTION public.ensure_active_mission_checklist_run(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_active_mission_checklist_run(UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.change_mission_checklist_template(
  UUID, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_mission_checklist_template(
  UUID, UUID, UUID, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.set_mission_team_template_change_allowed(
  UUID, UUID, BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_mission_team_template_change_allowed(
  UUID, UUID, BOOLEAN
) TO service_role;

COMMIT;
