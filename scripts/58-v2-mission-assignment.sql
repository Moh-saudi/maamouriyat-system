-- ==============================================================================
-- Script 58: V2 mission assignment batches and atomic issuance
-- ==============================================================================

BEGIN;

-- Regional facilities/directorates are valid mission targets even when they do
-- not belong to a central ministry sector.
ALTER TABLE public.missions
  ALTER COLUMN sector_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.mission_assignment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_by_org UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE RESTRICT,
  source_target_id UUID REFERENCES public.mission_targets(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  expected_end_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  visit_purpose TEXT NOT NULL,
  notes TEXT,
  requires_overnight BOOLEAN NOT NULL DEFAULT FALSE,
  requires_hotel_booking BOOLEAN NOT NULL DEFAULT FALSE,
  mission_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mission_assignment_batches_priority_check
    CHECK (priority IN ('normal', 'high', 'urgent')),
  CONSTRAINT mission_assignment_batches_dates_check
    CHECK (expected_end_date >= scheduled_date),
  CONSTRAINT mission_assignment_batches_count_check
    CHECK (mission_count >= 0)
);

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS assignment_batch_id UUID
    REFERENCES public.mission_assignment_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_target_id UUID
    REFERENCES public.mission_targets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mission_assignment_batches_created_by
  ON public.mission_assignment_batches(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_missions_assignment_batch
  ON public.missions(assignment_batch_id);

CREATE INDEX IF NOT EXISTS idx_missions_source_target
  ON public.missions(source_target_id)
  WHERE source_target_id IS NOT NULL;

ALTER TABLE public.mission_assignment_batches ENABLE ROW LEVEL SECURITY;

-- V2 access goes through server-side authorization APIs. No direct browser
-- policies are intentionally added.
REVOKE ALL ON TABLE public.mission_assignment_batches
  FROM anon, authenticated;
GRANT ALL ON TABLE public.mission_assignment_batches
  TO service_role;

CREATE OR REPLACE FUNCTION public.create_v2_mission_assignment_batch(
  p_actor_user_id UUID,
  p_actor_org_id UUID,
  p_team_user_ids UUID[],
  p_primary_user_id UUID,
  p_facility_ids UUID[],
  p_template_id UUID,
  p_scheduled_date DATE,
  p_expected_end_date DATE,
  p_priority TEXT,
  p_visit_purpose TEXT,
  p_notes TEXT DEFAULT NULL,
  p_requires_overnight BOOLEAN DEFAULT FALSE,
  p_requires_hotel_booking BOOLEAN DEFAULT FALSE,
  p_status TEXT DEFAULT 'pending_approval',
  p_source_target_id UUID DEFAULT NULL
)
RETURNS TABLE (
  batch_id UUID,
  mission_id UUID,
  serial_number TEXT,
  facility_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_batch_id UUID;
  v_primary_org_id UUID;
  v_primary_level INTEGER;
  v_facility RECORD;
  v_mission_id UUID;
  v_serial TEXT;
  v_team_user_id UUID;
  v_duration_days INTEGER;
  v_team_ids UUID[];
  v_facility_ids UUID[];
BEGIN
  v_team_ids := ARRAY(
    SELECT DISTINCT value
    FROM unnest(COALESCE(p_team_user_ids, ARRAY[]::UUID[])) AS value
    WHERE value IS NOT NULL
  );

  v_facility_ids := ARRAY(
    SELECT DISTINCT value
    FROM unnest(COALESCE(p_facility_ids, ARRAY[]::UUID[])) AS value
    WHERE value IS NOT NULL
  );

  IF cardinality(v_team_ids) = 0 THEN
    RAISE EXCEPTION 'Mission team is required';
  END IF;

  IF cardinality(v_facility_ids) = 0 THEN
    RAISE EXCEPTION 'At least one facility is required';
  END IF;

  IF NOT p_primary_user_id = ANY(v_team_ids) THEN
    RAISE EXCEPTION 'Primary inspector must belong to the mission team';
  END IF;

  IF p_expected_end_date < p_scheduled_date THEN
    RAISE EXCEPTION 'Mission end date cannot precede start date';
  END IF;

  IF p_priority NOT IN ('normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid mission priority';
  END IF;

  IF p_status NOT IN ('pending_approval', 'approved') THEN
    RAISE EXCEPTION 'Invalid initial mission status';
  END IF;

  IF NULLIF(BTRIM(p_visit_purpose), '') IS NULL THEN
    RAISE EXCEPTION 'Mission visit purpose is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.form_templates
    WHERE id = p_template_id
      AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Mission template is missing or inactive';
  END IF;

  SELECT
    u.organization_id,
    COALESCE(u.org_level, u.level, 7)
  INTO
    v_primary_org_id,
    v_primary_level
  FROM public.users u
  WHERE u.id = p_primary_user_id
    AND u.is_active IS TRUE;

  IF NOT FOUND OR v_primary_org_id IS NULL THEN
    RAISE EXCEPTION 'Primary inspector is missing, inactive, or has no organization';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.users u
    WHERE u.id = ANY(v_team_ids)
      AND u.is_active IS TRUE
  ) <> cardinality(v_team_ids) THEN
    RAISE EXCEPTION 'Mission team contains a missing or inactive user';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.facilities f
    WHERE f.id = ANY(v_facility_ids)
      AND f.is_active IS TRUE
  ) <> cardinality(v_facility_ids) THEN
    RAISE EXCEPTION 'Mission target contains a missing or inactive facility';
  END IF;

  v_duration_days := (p_expected_end_date - p_scheduled_date) + 1;

  INSERT INTO public.mission_assignment_batches (
    created_by,
    created_by_org,
    template_id,
    source_target_id,
    scheduled_date,
    expected_end_date,
    priority,
    visit_purpose,
    notes,
    requires_overnight,
    requires_hotel_booking,
    mission_count
  )
  VALUES (
    p_actor_user_id,
    p_actor_org_id,
    p_template_id,
    p_source_target_id,
    p_scheduled_date,
    p_expected_end_date,
    p_priority,
    BTRIM(p_visit_purpose),
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    COALESCE(p_requires_overnight, FALSE),
    COALESCE(p_requires_hotel_booking, FALSE),
    cardinality(v_facility_ids)
  )
  RETURNING id INTO v_batch_id;

  FOR v_facility IN
    SELECT
      f.id,
      f.organization_id,
      f.sector_id,
      f.name
    FROM public.facilities f
    WHERE f.id = ANY(v_facility_ids)
    ORDER BY array_position(v_facility_ids, f.id)
  LOOP
    INSERT INTO public.missions (
      serial_number,
      facility_id,
      target_facility_id,
      template_id,
      sector_id,
      primary_inspector_id,
      assigned_user_id,
      inspector_org_id,
      inspector_level,
      created_by,
      created_by_org,
      status,
      priority,
      scheduled_date,
      expected_end_date,
      visit_purpose,
      notes,
      requires_overnight,
      requires_hotel_booking,
      expected_duration_days,
      expected_nights,
      destination_type,
      assignment_batch_id,
      source_target_id
    )
    VALUES (
      NULL,
      v_facility.id,
      v_facility.id,
      p_template_id,
      v_facility.sector_id,
      p_primary_user_id,
      p_primary_user_id,
      v_primary_org_id,
      v_primary_level,
      p_actor_user_id,
      p_actor_org_id,
      p_status,
      p_priority,
      p_scheduled_date,
      p_expected_end_date,
      BTRIM(p_visit_purpose),
      NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
      COALESCE(p_requires_overnight, FALSE),
      COALESCE(p_requires_hotel_booking, FALSE),
      v_duration_days,
      GREATEST(v_duration_days - 1, 0),
      'facility',
      v_batch_id,
      p_source_target_id
    )
    RETURNING id, public.missions.serial_number
    INTO v_mission_id, v_serial;

    FOREACH v_team_user_id IN ARRAY v_team_ids
    LOOP
      INSERT INTO public.mission_team (
        mission_id,
        user_id,
        is_primary
      )
      VALUES (
        v_mission_id,
        v_team_user_id,
        v_team_user_id = p_primary_user_id
      );

      INSERT INTO public.notifications (
        user_id,
        mission_id,
        type,
        title,
        body
      )
      VALUES (
        v_team_user_id,
        v_mission_id,
        'mission_assigned',
        CASE
          WHEN p_status = 'approved'
            THEN 'تكليف مأمورية جديد'
          ELSE 'مأمورية بانتظار الاعتماد'
        END,
        CASE
          WHEN p_status = 'approved'
            THEN 'تم تكليفك بالمأمورية رقم ' || v_serial ||
                 ' على ' || v_facility.name ||
                 ' بتاريخ ' || TO_CHAR(p_scheduled_date, 'YYYY-MM-DD') || '.'
          ELSE 'تم إدراجك ضمن فريق المأمورية رقم ' || v_serial ||
               ' على ' || v_facility.name ||
               ' وهي بانتظار الاعتماد.'
        END
      );
    END LOOP;

    INSERT INTO public.mission_events (
      mission_id,
      user_id,
      event_type,
      description,
      metadata
    )
    VALUES (
      v_mission_id,
      p_actor_user_id,
      'assignment_created',
      CASE
        WHEN p_status = 'approved'
          THEN 'تم إصدار واعتماد تكليف المأمورية.'
        ELSE 'تم إنشاء تكليف المأمورية وإرساله للاعتماد.'
      END,
      jsonb_build_object(
        'assignment_batch_id', v_batch_id,
        'facility_id', v_facility.id,
        'team_user_ids', to_jsonb(v_team_ids),
        'primary_user_id', p_primary_user_id,
        'initial_status', p_status
      )
    );

    batch_id := v_batch_id;
    mission_id := v_mission_id;
    serial_number := v_serial;
    facility_id := v_facility.id;
    RETURN NEXT;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_v2_mission_assignment_batch(
  UUID, UUID, UUID[], UUID, UUID[], UUID, DATE, DATE, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT, UUID
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_v2_mission_assignment_batch(
  UUID, UUID, UUID[], UUID, UUID[], UUID, DATE, DATE, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT, UUID
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_v2_mission_assignment_batch(
  UUID, UUID, UUID[], UUID, UUID[], UUID, DATE, DATE, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT, UUID
) TO service_role;

COMMIT;
