-- ==============================================================================
-- Script 61: Mission assignment discovery, facility programs, template library
-- ==============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Facility programs / initiatives (e.g. حياة كريمة)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.facility_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  program_type TEXT NOT NULL DEFAULT 'program',
  scope_organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT facility_programs_type_check
    CHECK (program_type IN ('program', 'initiative', 'project', 'campaign'))
);

CREATE TABLE IF NOT EXISTS public.facility_program_facilities (
  program_id UUID NOT NULL REFERENCES public.facility_programs(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (program_id, facility_id)
);

CREATE INDEX IF NOT EXISTS idx_facility_programs_active
  ON public.facility_programs(is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_facility_program_facilities_facility
  ON public.facility_program_facilities(facility_id, program_id);

INSERT INTO public.facility_programs (
  code, name, description, program_type, sort_order, is_active
)
VALUES (
  'HAYAH_KARIMA',
  'حياة كريمة',
  'مجموعة منشآت المبادرة/المشروع. يتم ربط المنشآت المعتمدة بالمجموعة دون افتراض عضوية أي منشأة تلقائياً.',
  'initiative',
  10,
  TRUE
)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = NOW();

ALTER TABLE public.facility_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_program_facilities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.facility_programs FROM anon, authenticated;
REVOKE ALL ON TABLE public.facility_program_facilities FROM anon, authenticated;
GRANT ALL ON TABLE public.facility_programs TO service_role;
GRANT ALL ON TABLE public.facility_program_facilities TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Personal template ownership/library
-- ---------------------------------------------------------------------------
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'system';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'form_templates_visibility_check'
      AND conrelid = 'public.form_templates'::regclass
  ) THEN
    ALTER TABLE public.form_templates
      ADD CONSTRAINT form_templates_visibility_check
      CHECK (visibility IN ('system', 'organization', 'private'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_template_library (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'saved',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, template_id),
  CONSTRAINT user_template_library_source_check
    CHECK (source_type IN ('created', 'saved'))
);

CREATE INDEX IF NOT EXISTS idx_user_template_library_template
  ON public.user_template_library(template_id, user_id);

ALTER TABLE public.user_template_library ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_template_library FROM anon, authenticated;
GRANT ALL ON TABLE public.user_template_library TO service_role;

-- Existing templates remain system/shared. New templates created by the V2/API
-- can explicitly be private or organization-owned.
UPDATE public.form_templates
SET visibility = 'system'
WHERE created_by_user_id IS NULL
  AND visibility IS DISTINCT FROM 'system';

-- ---------------------------------------------------------------------------
-- 3) Source program metadata on mission assignments
-- ---------------------------------------------------------------------------
ALTER TABLE public.mission_assignment_batches
  ADD COLUMN IF NOT EXISTS source_program_id UUID REFERENCES public.facility_programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selection_source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS source_program_id UUID REFERENCES public.facility_programs(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mission_assignment_batches_selection_source_check'
      AND conrelid = 'public.mission_assignment_batches'::regclass
  ) THEN
    ALTER TABLE public.mission_assignment_batches
      ADD CONSTRAINT mission_assignment_batches_selection_source_check
      CHECK (selection_source IN ('manual', 'target', 'program'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_missions_source_program
  ON public.missions(source_program_id);

CREATE INDEX IF NOT EXISTS idx_mission_batches_source_program
  ON public.mission_assignment_batches(source_program_id);

-- ---------------------------------------------------------------------------
-- 4) Facility visit-frequency view
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.facility_mission_visit_stats AS
SELECT
  f.id AS facility_id,
  COUNT(m.id) FILTER (
    WHERE COALESCE(m.status, '') NOT IN ('cancelled', 'rejected', 'draft')
  )::INTEGER AS assignment_count,
  COUNT(m.id) FILTER (
    WHERE
      m.checkin_time IS NOT NULL
      OR m.status IN ('completed', 'closed', 'done')
  )::INTEGER AS visit_count,
  COUNT(DISTINCT m.primary_inspector_id) FILTER (
    WHERE
      m.primary_inspector_id IS NOT NULL
      AND (
        m.checkin_time IS NOT NULL
        OR m.status IN ('completed', 'closed', 'done')
      )
  )::INTEGER AS distinct_primary_inspectors,
  MAX(
    COALESCE(
      m.checkout_time,
      m.completed_at,
      m.checkin_time
    )
  ) FILTER (
    WHERE
      m.checkin_time IS NOT NULL
      OR m.status IN ('completed', 'closed', 'done')
  ) AS last_visited_at,
  MAX(m.scheduled_date) FILTER (
    WHERE COALESCE(m.status, '') NOT IN ('cancelled', 'rejected', 'draft')
  ) AS last_scheduled_date
FROM public.facilities f
LEFT JOIN public.missions m
  ON COALESCE(m.target_facility_id, m.facility_id) = f.id
GROUP BY f.id;

REVOKE ALL ON public.facility_mission_visit_stats FROM anon, authenticated;
GRANT SELECT ON public.facility_mission_visit_stats TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Permissions for programs and personal template library
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (
  key, module, action, display_name_ar, description_ar,
  is_sensitive, is_active, sort_order
)
VALUES
  (
    'facility_programs.view',
    'facility_programs',
    'view',
    'عرض برامج ومشروعات المنشآت',
    'عرض مجموعات المنشآت المرتبطة ببرنامج أو مبادرة أو مشروع عند إعداد المأموريات.',
    FALSE, TRUE, 180
  ),
  (
    'facility_programs.manage',
    'facility_programs',
    'manage',
    'إدارة برامج ومشروعات المنشآت',
    'إنشاء البرامج والمبادرات وربط المنشآت المعتمدة بها.',
    TRUE, TRUE, 181
  ),
  (
    'checklists.library',
    'checklists',
    'library',
    'إدارة استماراتي',
    'حفظ النماذج المتاحة داخل المكتبة الشخصية واستخدام الاستمارات التي أنشأها المستخدم.',
    FALSE, TRUE, 135
  )
ON CONFLICT (key) DO UPDATE
SET
  display_name_ar = EXCLUDED.display_name_ar,
  description_ar = EXCLUDED.description_ar,
  is_sensitive = EXCLUDED.is_sensitive,
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- View/use programs + personal template library for mission-working roles.
INSERT INTO public.role_permission_grants (role_id, permission_key, scope_type)
SELECT
  r.id,
  p.permission_key,
  CASE
    WHEN r.code = 'system_superadmin' THEN 'national'
    WHEN r.code = 'sector_manager' THEN 'sector'
    WHEN r.code = 'directorate_manager' THEN 'governorate'
    WHEN r.code IN ('central_admin_manager','general_admin_manager','health_admin_manager','information_center','mission_secretariat')
      THEN 'organization_tree'
    ELSE 'assigned'
  END
FROM public.roles r
CROSS JOIN (
  VALUES
    ('facility_programs.view'),
    ('checklists.library')
) AS p(permission_key)
WHERE r.code IN (
  'system_superadmin',
  'sector_manager',
  'central_admin_manager',
  'general_admin_manager',
  'directorate_manager',
  'health_admin_manager',
  'information_center',
  'mission_secretariat',
  'field_inspector'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.role_permission_grants (role_id, permission_key, scope_type)
SELECT
  r.id,
  'facility_programs.manage',
  CASE
    WHEN r.code = 'system_superadmin' THEN 'national'
    WHEN r.code = 'sector_manager' THEN 'sector'
    WHEN r.code = 'directorate_manager' THEN 'governorate'
    ELSE 'organization_tree'
  END
FROM public.roles r
WHERE r.code IN (
  'system_superadmin',
  'sector_manager',
  'central_admin_manager',
  'general_admin_manager',
  'directorate_manager'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6) Operational leaders/support may execute ONLY missions assigned to them.
-- This fixes the "one person only" team picker without granting global execute.
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permission_grants (role_id, permission_key, scope_type)
SELECT r.id, p.permission_key, 'assigned'
FROM public.roles r
CROSS JOIN (
  VALUES
    ('missions.execute'),
    ('mission_results.record'),
    ('mission_results.edit'),
    ('checklists.execute')
) AS p(permission_key)
WHERE r.code IN (
  'system_superadmin',
  'sector_manager',
  'central_admin_manager',
  'general_admin_manager',
  'directorate_manager',
  'health_admin_manager',
  'information_center',
  'field_inspector'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7) Replace assignment RPC with program source support.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_v2_mission_assignment_batch(
  UUID, UUID, UUID[], UUID, UUID[], UUID, DATE, DATE, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT, UUID
);

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
  p_source_target_id UUID DEFAULT NULL,
  p_source_program_id UUID DEFAULT NULL,
  p_selection_source TEXT DEFAULT 'manual'
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

  IF p_selection_source NOT IN ('manual', 'target', 'program') THEN
    RAISE EXCEPTION 'Invalid assignment selection source';
  END IF;

  IF p_selection_source = 'target' AND p_source_target_id IS NULL THEN
    RAISE EXCEPTION 'Target source is required';
  END IF;

  IF p_selection_source = 'program' AND p_source_program_id IS NULL THEN
    RAISE EXCEPTION 'Program source is required';
  END IF;

  IF p_selection_source = 'manual' THEN
    p_source_target_id := NULL;
    p_source_program_id := NULL;
  ELSIF p_selection_source = 'target' THEN
    p_source_program_id := NULL;
  ELSIF p_selection_source = 'program' THEN
    p_source_target_id := NULL;
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

  IF p_source_target_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.mission_targets
    WHERE id = p_source_target_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Mission target is missing or inactive';
  END IF;

  IF p_source_program_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.facility_programs
    WHERE id = p_source_program_id
      AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Facility program is missing or inactive';
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

  IF p_source_target_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM unnest(v_facility_ids) selected_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.mission_target_facilities mtf
      WHERE mtf.target_id = p_source_target_id
        AND mtf.facility_id = selected_id
    )
  ) THEN
    RAISE EXCEPTION 'Selected facility is outside the chosen mission target';
  END IF;

  IF p_source_program_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM unnest(v_facility_ids) selected_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.facility_program_facilities fpf
      WHERE fpf.program_id = p_source_program_id
        AND fpf.facility_id = selected_id
    )
  ) THEN
    RAISE EXCEPTION 'Selected facility is outside the chosen facility program';
  END IF;

  v_duration_days := (p_expected_end_date - p_scheduled_date) + 1;

  INSERT INTO public.mission_assignment_batches (
    created_by,
    created_by_org,
    template_id,
    source_target_id,
    source_program_id,
    selection_source,
    scheduled_date,
    expected_end_date,
    priority,
    visit_purpose,
    notes,
    requires_overnight,
    requires_hotel_booking,
    mission_count,
    status,
    submitted_at,
    approved_by,
    approved_at
  )
  VALUES (
    p_actor_user_id,
    p_actor_org_id,
    p_template_id,
    p_source_target_id,
    p_source_program_id,
    p_selection_source,
    p_scheduled_date,
    p_expected_end_date,
    p_priority,
    BTRIM(p_visit_purpose),
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    COALESCE(p_requires_overnight, FALSE),
    COALESCE(p_requires_hotel_booking, FALSE),
    cardinality(v_facility_ids),
    p_status,
    NOW(),
    CASE WHEN p_status = 'approved' THEN p_actor_user_id ELSE NULL END,
    CASE WHEN p_status = 'approved' THEN NOW() ELSE NULL END
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
      approved_by,
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
      source_target_id,
      source_program_id
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
      CASE WHEN p_status = 'approved' THEN p_actor_user_id ELSE NULL END,
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
      p_source_target_id,
      p_source_program_id
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

      IF p_status = 'approved' THEN
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
          'تكليف مأمورية جديد',
          'تم تكليفك بالمأمورية رقم ' || v_serial ||
          ' على ' || v_facility.name ||
          ' بتاريخ ' || TO_CHAR(p_scheduled_date, 'YYYY-MM-DD') || '.'
        );
      END IF;
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
        ELSE 'تم إعداد تكليف المأمورية وإرساله للاعتماد.'
      END,
      jsonb_build_object(
        'assignment_batch_id', v_batch_id,
        'facility_id', v_facility.id,
        'team_user_ids', to_jsonb(v_team_ids),
        'primary_user_id', p_primary_user_id,
        'initial_status', p_status,
        'selection_source', p_selection_source,
        'source_target_id', p_source_target_id,
        'source_program_id', p_source_program_id
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
  BOOLEAN, BOOLEAN, TEXT, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_v2_mission_assignment_batch(
  UUID, UUID, UUID[], UUID, UUID[], UUID, DATE, DATE, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT, UUID, UUID, TEXT
) TO service_role;

COMMIT;
