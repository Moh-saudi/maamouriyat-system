-- ==============================================================================
-- Script 53: Violation correction workflow, escalation, and immutable audit trail
-- ==============================================================================
BEGIN;

-- 1) Workflow state on the existing violations table.
ALTER TABLE public.violations
  ADD COLUMN IF NOT EXISTS original_assigned_to_org_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS escalated_to_org_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_escalation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS record_state TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS void_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_requested_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS void_request_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'violations_escalation_level_nonnegative'
      AND conrelid = 'public.violations'::regclass
  ) THEN
    ALTER TABLE public.violations
      ADD CONSTRAINT violations_escalation_level_nonnegative
      CHECK (escalation_level >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'violations_record_state_check'
      AND conrelid = 'public.violations'::regclass
  ) THEN
    ALTER TABLE public.violations
      ADD CONSTRAINT violations_record_state_check
      CHECK (record_state IN ('active', 'voided'));
  END IF;
END
$$;

UPDATE public.violations
SET
  original_assigned_to_org_id = COALESCE(
    original_assigned_to_org_id,
    assigned_to_org_id
  ),
  next_escalation_at = CASE
    WHEN record_state = 'active'
      AND COALESCE(status, 'new') IN ('new', 'in_progress')
      AND assigned_to_org_id IS NOT NULL
    THEN COALESCE(next_escalation_at, correction_deadline, deadline)
    ELSE next_escalation_at
  END
WHERE original_assigned_to_org_id IS NULL
   OR next_escalation_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_violations_escalation_due
  ON public.violations(next_escalation_at)
  WHERE record_state = 'active'
    AND assigned_to_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_violations_escalated_to_org
  ON public.violations(escalated_to_org_id)
  WHERE escalated_to_org_id IS NOT NULL;

-- 2) Immutable workflow event timeline.
CREATE TABLE IF NOT EXISTS public.violation_workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_id UUID NOT NULL REFERENCES public.violations(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES public.users(id),
  actor_org_id UUID REFERENCES public.organizations(id),
  from_org_id UUID REFERENCES public.organizations(id),
  to_org_id UUID REFERENCES public.organizations(id),
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_violation_workflow_events_violation
  ON public.violation_workflow_events(violation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_violation_workflow_events_type
  ON public.violation_workflow_events(event_type, created_at DESC);

ALTER TABLE public.violation_workflow_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS violation_workflow_events_select_authenticated
  ON public.violation_workflow_events;

CREATE POLICY violation_workflow_events_select_authenticated
  ON public.violation_workflow_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.violations v
      WHERE v.id = violation_workflow_events.violation_id
    )
  );

-- Writes are service-side only.
REVOKE INSERT, UPDATE, DELETE
  ON public.violation_workflow_events
  FROM anon, authenticated;

-- 3) Central configurable escalation settings.
CREATE TABLE IF NOT EXISTS public.violation_workflow_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton IS TRUE),
  auto_escalation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  escalation_interval_hours INTEGER NOT NULL DEFAULT 24,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (escalation_interval_hours BETWEEN 1 AND 720)
);

INSERT INTO public.violation_workflow_settings (
  singleton,
  auto_escalation_enabled,
  escalation_interval_hours
)
VALUES (TRUE, TRUE, 24)
ON CONFLICT (singleton) DO NOTHING;

-- 4) Routing catalog. A rule says which functional role should receive a
-- category. Resolution to the concrete organization is performed by the app.
CREATE TABLE IF NOT EXISTS public.correction_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code TEXT NOT NULL UNIQUE,
  category_name_ar TEXT NOT NULL,
  target_role_code TEXT,
  target_organization_id UUID REFERENCES public.organizations(id),
  resolution_strategy TEXT NOT NULL DEFAULT 'nearest_role_assignment',
  default_deadline_hours INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    resolution_strategy IN (
      'nearest_role_assignment',
      'explicit_organization',
      'manual'
    )
  ),
  CHECK (
    default_deadline_hours IS NULL
    OR default_deadline_hours BETWEEN 1 AND 8760
  )
);

INSERT INTO public.correction_routing_rules (
  category_code,
  category_name_ar,
  target_role_code,
  resolution_strategy,
  sort_order
)
VALUES (
  'technology_information_systems',
  'تقنية المعلومات والحاسب والشبكات',
  'information_center',
  'nearest_role_assignment',
  10
)
ON CONFLICT (category_code) DO UPDATE
SET
  category_name_ar = EXCLUDED.category_name_ar,
  target_role_code = EXCLUDED.target_role_code,
  resolution_strategy = EXCLUDED.resolution_strategy,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- 5) Keep assignment/escalation metadata coherent even for legacy write paths.
CREATE OR REPLACE FUNCTION public.sync_violation_workflow_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.original_assigned_to_org_id :=
      COALESCE(NEW.original_assigned_to_org_id, NEW.assigned_to_org_id);

    IF NEW.record_state = 'active'
       AND COALESCE(NEW.status, 'new') IN ('new', 'in_progress')
       AND NEW.assigned_to_org_id IS NOT NULL THEN
      NEW.next_escalation_at :=
        COALESCE(NEW.next_escalation_at, NEW.correction_deadline, NEW.deadline);
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.assigned_to_org_id IS DISTINCT FROM OLD.assigned_to_org_id THEN
    NEW.original_assigned_to_org_id :=
      COALESCE(OLD.original_assigned_to_org_id, NEW.assigned_to_org_id);
    NEW.escalated_to_org_id := NULL;
    NEW.escalation_level := 0;
    NEW.last_escalated_at := NULL;
    NEW.next_escalation_at :=
      COALESCE(NEW.correction_deadline, NEW.deadline);
  ELSIF NEW.correction_deadline IS DISTINCT FROM OLD.correction_deadline
     OR NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    NEW.next_escalation_at :=
      COALESCE(NEW.correction_deadline, NEW.deadline);
  END IF;

  IF NEW.record_state <> 'active'
     OR COALESCE(NEW.status, 'new') NOT IN ('new', 'in_progress') THEN
    NEW.next_escalation_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_violation_workflow_state
  ON public.violations;

CREATE TRIGGER trg_sync_violation_workflow_state
BEFORE INSERT OR UPDATE OF
  assigned_to_org_id,
  correction_deadline,
  deadline,
  status,
  record_state
ON public.violations
FOR EACH ROW
EXECUTE FUNCTION public.sync_violation_workflow_state();

-- 6) Automatic escalation: keeps correction ownership on assigned_to_org_id
-- while escalating oversight to the parent organization.
CREATE OR REPLACE FUNCTION public.escalate_overdue_violations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_setting public.violation_workflow_settings%ROWTYPE;
  v_row RECORD;
  v_base_org_id UUID;
  v_parent_org_id UUID;
  v_parent_parent_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT *
  INTO v_setting
  FROM public.violation_workflow_settings
  WHERE singleton IS TRUE;

  IF NOT FOUND OR v_setting.auto_escalation_enabled IS NOT TRUE THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT v.*
    FROM public.violations v
    WHERE v.record_state = 'active'
      AND COALESCE(v.status, 'new') IN ('new', 'in_progress')
      AND v.assigned_to_org_id IS NOT NULL
      AND COALESCE(v.next_escalation_at, v.correction_deadline, v.deadline)
          IS NOT NULL
      AND COALESCE(v.next_escalation_at, v.correction_deadline, v.deadline)
          <= NOW()
    ORDER BY COALESCE(v.next_escalation_at, v.correction_deadline, v.deadline)
    FOR UPDATE SKIP LOCKED
  LOOP
    v_base_org_id := COALESCE(
      v_row.escalated_to_org_id,
      v_row.assigned_to_org_id
    );

    SELECT o.parent_id
    INTO v_parent_org_id
    FROM public.organizations o
    WHERE o.id = v_base_org_id;

    IF v_parent_org_id IS NULL THEN
      UPDATE public.violations
      SET next_escalation_at = NULL,
          updated_at = NOW()
      WHERE id = v_row.id;

      CONTINUE;
    END IF;

    SELECT o.parent_id
    INTO v_parent_parent_id
    FROM public.organizations o
    WHERE o.id = v_parent_org_id;

    UPDATE public.violations
    SET
      escalated_to_org_id = v_parent_org_id,
      escalation_level = COALESCE(escalation_level, 0) + 1,
      last_escalated_at = NOW(),
      next_escalation_at = CASE
        WHEN v_parent_parent_id IS NULL THEN NULL
        ELSE NOW() + make_interval(hours => v_setting.escalation_interval_hours)
      END,
      updated_at = NOW()
    WHERE id = v_row.id;

    INSERT INTO public.violation_workflow_events (
      violation_id,
      event_type,
      from_org_id,
      to_org_id,
      reason,
      metadata
    )
    VALUES (
      v_row.id,
      'auto_escalated',
      v_base_org_id,
      v_parent_org_id,
      'انتهت مهلة التصحيح دون إغلاق الملاحظة أو تسجيل تصحيح مكتمل.',
      jsonb_build_object(
        'previous_escalation_level', COALESCE(v_row.escalation_level, 0),
        'deadline', COALESCE(
          v_row.next_escalation_at,
          v_row.correction_deadline,
          v_row.deadline
        ),
        'interval_hours', v_setting.escalation_interval_hours
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.escalate_overdue_violations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.escalate_overdue_violations() FROM anon;
REVOKE ALL ON FUNCTION public.escalate_overdue_violations() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_overdue_violations() TO service_role;

-- 7) Voiding is not deletion. The record and workflow history remain intact.
CREATE OR REPLACE FUNCTION public.void_violation_with_audit(
  p_violation_id UUID,
  p_actor_user_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_row public.violations%ROWTYPE;
  v_reason TEXT := NULLIF(BTRIM(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Void reason is required';
  END IF;

  SELECT *
  INTO v_row
  FROM public.violations
  WHERE id = p_violation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Violation not found';
  END IF;

  IF v_row.record_state = 'voided' THEN
    RETURN;
  END IF;

  UPDATE public.violations
  SET
    record_state = 'voided',
    voided_at = NOW(),
    voided_by = p_actor_user_id,
    void_reason = v_reason,
    next_escalation_at = NULL,
    updated_at = NOW()
  WHERE id = p_violation_id;

  INSERT INTO public.violation_workflow_events (
    violation_id,
    event_type,
    actor_user_id,
    from_org_id,
    to_org_id,
    from_status,
    to_status,
    reason
  )
  VALUES (
    p_violation_id,
    'voided',
    p_actor_user_id,
    v_row.assigned_to_org_id,
    v_row.assigned_to_org_id,
    v_row.status,
    v_row.status,
    v_reason
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.void_violation_with_audit(UUID, UUID, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.void_violation_with_audit(UUID, UUID, TEXT)
  FROM anon;
REVOKE ALL ON FUNCTION public.void_violation_with_audit(UUID, UUID, TEXT)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.void_violation_with_audit(UUID, UUID, TEXT)
  TO service_role;

-- 8) Permission registry and grants.
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
  'violations.cancel',
  'violations',
  'cancel',
  'استبعاد ملاحظة رقابية',
  'استبعاد الملاحظة من سير العمل مع سبب إلزامي ودون حذف سجلها الرقابي.',
  TRUE,
  TRUE,
  70
)
ON CONFLICT (key) DO UPDATE
SET
  display_name_ar = EXCLUDED.display_name_ar,
  description_ar = EXCLUDED.description_ar,
  is_sensitive = EXCLUDED.is_sensitive,
  is_active = TRUE,
  updated_at = NOW();

-- Information Center is a correction destination only for its exact assigned
-- organization, not its wider geographic administration scope.
INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  p.permission_key,
  'organization'
FROM public.roles r
CROSS JOIN (
  VALUES ('violations.view'), ('violations.correct')
) AS p(permission_key)
WHERE r.code = 'information_center'
  AND r.is_active IS TRUE
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

-- Cancellation is deliberately reserved for oversight levels, not the
-- correction unit itself.
INSERT INTO public.role_permission_grants (
  role_id,
  permission_key,
  scope_type
)
SELECT
  r.id,
  'violations.cancel',
  CASE r.code
    WHEN 'system_superadmin' THEN 'national'
    WHEN 'sector_manager' THEN 'sector'
    WHEN 'central_admin_manager' THEN 'organization_tree'
    WHEN 'general_admin_manager' THEN 'organization_tree'
    WHEN 'directorate_manager' THEN 'governorate'
  END
FROM public.roles r
WHERE r.code IN (
  'system_superadmin',
  'sector_manager',
  'central_admin_manager',
  'general_admin_manager',
  'directorate_manager'
)
  AND r.is_active IS TRUE
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

COMMIT;
