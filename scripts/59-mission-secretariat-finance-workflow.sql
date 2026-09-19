-- ==============================================================================
-- Script 59: Mission secretariat, approval workflow, and financial settlements
-- ==============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Fine-grained mission preparation + reporting + finance permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (
  key, module, action, display_name_ar, description_ar,
  is_sensitive, is_active, sort_order
)
VALUES
  (
    'missions.prepare',
    'missions',
    'prepare',
    'إعداد تكليف مأمورية',
    'إعداد بيانات التكليف والفريق المقترح وإرساله للاعتماد دون امتلاك سلطة الاعتماد.',
    FALSE, TRUE, 205
  ),
  (
    'missions.propose_team',
    'missions',
    'propose_team',
    'اقتراح فريق المأمورية',
    'اختيار فريق مقترح داخل نموذج التكليف دون أن يصبح التكليف نافذًا قبل الاعتماد.',
    FALSE, TRUE, 235
  ),
  (
    'finance.view',
    'finance',
    'view',
    'عرض الاستحقاقات المالية',
    'عرض الاستحقاقات المالية الناتجة عن المأموريات المنفذة داخل النطاق.',
    TRUE, TRUE, 600
  ),
  (
    'finance.prepare',
    'finance',
    'prepare',
    'إعداد التسوية المالية',
    'إعداد أيام وبدلات ومكافآت وتسويات الاستحقاق المالي للمأمورية.',
    TRUE, TRUE, 610
  ),
  (
    'finance.approve',
    'finance',
    'approve',
    'اعتماد التسوية المالية',
    'اعتماد التسوية المالية بعد مراجعتها وقبل تسجيل الصرف.',
    TRUE, TRUE, 620
  ),
  (
    'finance.reject',
    'finance',
    'reject',
    'رفض أو إعادة التسوية المالية',
    'رفض الاستحقاق أو إعادته للمراجعة بسبب موثق.',
    TRUE, TRUE, 625
  ),
  (
    'finance.mark_paid',
    'finance',
    'mark_paid',
    'تسجيل صرف الاستحقاق',
    'تسجيل أن الاستحقاق المالي المعتمد قد تم صرفه مع مرجع الصرف.',
    TRUE, TRUE, 630
  ),
  (
    'reports.missions.view',
    'reports',
    'missions_view',
    'عرض تقارير المأموريات',
    'عرض التقارير التشغيلية والإدارية الخاصة بالمأموريات داخل النطاق.',
    FALSE, TRUE, 700
  ),
  (
    'reports.finance.view',
    'reports',
    'finance_view',
    'عرض التقارير المالية',
    'عرض تقارير الاستحقاقات والصرف المالي للمأموريات داخل النطاق.',
    TRUE, TRUE, 710
  )
ON CONFLICT (key) DO UPDATE
SET
  display_name_ar = EXCLUDED.display_name_ar,
  description_ar = EXCLUDED.description_ar,
  is_sensitive = EXCLUDED.is_sensitive,
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2) Generic system work types
-- ---------------------------------------------------------------------------
INSERT INTO public.roles (
  code, name_ar, description_ar, owner_organization_id,
  is_system, is_active, priority
)
VALUES
  (
    'mission_secretariat',
    'سكرتارية المأموريات',
    'إعداد نماذج تكليف المأموريات واقتراح الفرق وإرسال التكليفات للاعتماد دون تنفيذ أو اعتماد المأموريات.',
    NULL, TRUE, TRUE, 66
  ),
  (
    'finance_officer',
    'مسؤول الاستحقاقات المالية للمأموريات',
    'مراجعة المأموريات المنفذة وإعداد التسويات المالية والبدلات والمكافآت وإصدار التقارير المالية داخل النطاق.',
    NULL, TRUE, TRUE, 73
  ),
  (
    'finance_approver',
    'معتمد الاستحقاقات المالية',
    'اعتماد أو رفض التسويات المالية وتسجيل الصرف بعد المراجعة، مع فصل الصلاحية عن إعداد التسوية.',
    NULL, TRUE, TRUE, 74
  )
ON CONFLICT (code) DO UPDATE
SET
  name_ar = EXCLUDED.name_ar,
  description_ar = EXCLUDED.description_ar,
  is_active = TRUE,
  priority = EXCLUDED.priority,
  updated_at = NOW();

-- Secretariat grants.
INSERT INTO public.role_permission_grants (role_id, permission_key, scope_type)
SELECT r.id, p.permission_key, 'organization_tree'
FROM public.roles r
CROSS JOIN (
  VALUES
    ('dashboard.view'),
    ('missions.view'),
    ('missions.prepare'),
    ('missions.propose_team'),
    ('reports.missions.view')
) AS p(permission_key)
WHERE r.code = 'mission_secretariat'
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

-- Finance preparer grants.
INSERT INTO public.role_permission_grants (role_id, permission_key, scope_type)
SELECT r.id, p.permission_key, 'organization_tree'
FROM public.roles r
CROSS JOIN (
  VALUES
    ('dashboard.view'),
    ('missions.view'),
    ('finance.view'),
    ('finance.prepare'),
    ('reports.finance.view')
) AS p(permission_key)
WHERE r.code = 'finance_officer'
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

-- Finance approver/payment grants.
INSERT INTO public.role_permission_grants (role_id, permission_key, scope_type)
SELECT r.id, p.permission_key, 'organization_tree'
FROM public.roles r
CROSS JOIN (
  VALUES
    ('dashboard.view'),
    ('missions.view'),
    ('finance.view'),
    ('finance.approve'),
    ('finance.reject'),
    ('finance.mark_paid'),
    ('reports.finance.view')
) AS p(permission_key)
WHERE r.code = 'finance_approver'
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

-- National oversight/testing.
INSERT INTO public.role_permission_grants (role_id, permission_key, scope_type)
SELECT r.id, p.permission_key, 'national'
FROM public.roles r
CROSS JOIN (
  VALUES
    ('finance.view'),
    ('finance.prepare'),
    ('finance.approve'),
    ('finance.reject'),
    ('finance.mark_paid'),
    ('reports.missions.view'),
    ('reports.finance.view')
) AS p(permission_key)
WHERE r.code = 'system_superadmin'
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

-- Directorate/health-administration financial oversight is view/report only.
INSERT INTO public.role_permission_grants (role_id, permission_key, scope_type)
SELECT
  r.id,
  p.permission_key,
  CASE
    WHEN r.code = 'directorate_manager' THEN 'governorate'
    ELSE 'organization_tree'
  END
FROM public.roles r
CROSS JOIN (
  VALUES
    ('finance.view'),
    ('reports.missions.view'),
    ('reports.finance.view')
) AS p(permission_key)
WHERE r.code IN ('directorate_manager', 'health_admin_manager')
ON CONFLICT (role_id, permission_key) DO UPDATE
SET scope_type = EXCLUDED.scope_type;

-- ---------------------------------------------------------------------------
-- 3) Assignment-batch approval metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.mission_assignment_batches
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mission_assignment_batches_status_check'
      AND conrelid = 'public.mission_assignment_batches'::regclass
  ) THEN
    ALTER TABLE public.mission_assignment_batches
      ADD CONSTRAINT mission_assignment_batches_status_check
      CHECK (status IN ('pending_approval', 'approved', 'rejected'));
  END IF;
END
$$;

UPDATE public.mission_assignment_batches b
SET
  status = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.assignment_batch_id = b.id
        AND m.status = 'approved'
    ) THEN 'approved'
    WHEN EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.assignment_batch_id = b.id
        AND m.status = 'rejected'
    ) THEN 'rejected'
    ELSE 'pending_approval'
  END
WHERE b.status IS NULL
   OR b.status NOT IN ('pending_approval', 'approved', 'rejected');

CREATE INDEX IF NOT EXISTS idx_mission_assignment_batches_status
  ON public.mission_assignment_batches(status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4) Financial settlement model
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mission_financial_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  scope_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  currency TEXT NOT NULL DEFAULT 'EGP',
  mission_days INTEGER NOT NULL DEFAULT 1,
  overnight_nights INTEGER NOT NULL DEFAULT 0,
  fixed_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  daily_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  daily_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  overnight_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  overnight_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  adjustment_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  prepared_by UUID REFERENCES public.users(id),
  prepared_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  paid_by UUID REFERENCES public.users(id),
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mission_id, user_id),
  CHECK (status IN ('pending_review', 'prepared', 'approved', 'rejected', 'paid')),
  CHECK (currency = 'EGP'),
  CHECK (mission_days >= 1),
  CHECK (overnight_nights >= 0),
  CHECK (fixed_amount >= 0),
  CHECK (daily_rate >= 0),
  CHECK (daily_amount >= 0),
  CHECK (overnight_rate >= 0),
  CHECK (overnight_amount >= 0),
  CHECK (bonus_amount >= 0),
  CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_mission_financial_settlements_scope_status
  ON public.mission_financial_settlements(scope_org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mission_financial_settlements_user
  ON public.mission_financial_settlements(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mission_financial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES public.mission_financial_settlements(id) ON DELETE RESTRICT,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES public.users(id),
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mission_financial_events_settlement
  ON public.mission_financial_events(settlement_id, created_at DESC);

ALTER TABLE public.mission_financial_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_financial_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mission_financial_settlements FROM anon, authenticated;
REVOKE ALL ON TABLE public.mission_financial_events FROM anon, authenticated;
GRANT ALL ON TABLE public.mission_financial_settlements TO service_role;
GRANT ALL ON TABLE public.mission_financial_events TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Financial settlement creation when a mission is completed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_mission_financial_settlements(
  p_mission_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_mission RECORD;
  v_user_id UUID;
  v_inserted INTEGER := 0;
BEGIN
  SELECT
    m.id,
    m.status,
    m.facility_id,
    m.primary_inspector_id,
    m.scheduled_date,
    COALESCE(m.expected_end_date, m.scheduled_date) AS end_date,
    COALESCE(m.expected_nights, 0) AS expected_nights,
    f.organization_id AS scope_org_id
  INTO v_mission
  FROM public.missions m
  JOIN public.facilities f ON f.id = m.facility_id
  WHERE m.id = p_mission_id;

  IF NOT FOUND OR v_mission.status NOT IN ('completed', 'closed') THEN
    RETURN 0;
  END IF;

  FOR v_user_id IN
    SELECT DISTINCT team_user_id
    FROM (
      SELECT mt.user_id AS team_user_id
      FROM public.mission_team mt
      WHERE mt.mission_id = p_mission_id

      UNION ALL

      SELECT v_mission.primary_inspector_id
    ) users_for_settlement
    WHERE team_user_id IS NOT NULL
  LOOP
    INSERT INTO public.mission_financial_settlements (
      mission_id,
      user_id,
      scope_org_id,
      mission_days,
      overnight_nights
    )
    VALUES (
      p_mission_id,
      v_user_id,
      v_mission.scope_org_id,
      GREATEST((v_mission.end_date - v_mission.scheduled_date) + 1, 1),
      GREATEST(v_mission.expected_nights, 0)
    )
    ON CONFLICT (mission_id, user_id) DO NOTHING;

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_create_mission_financial_settlements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.status IN ('completed', 'closed')
     AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
     ) THEN
    PERFORM public.ensure_mission_financial_settlements(NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_create_mission_financial_settlements
  ON public.missions;

CREATE TRIGGER trg_create_mission_financial_settlements
AFTER INSERT OR UPDATE OF status
ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.trg_create_mission_financial_settlements();

-- Backfill completed legacy/current missions.
DO $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN
    SELECT id
    FROM public.missions
    WHERE status IN ('completed', 'closed')
  LOOP
    PERFORM public.ensure_mission_financial_settlements(v_id);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 6) Audited financial mutation RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_mission_financial_settlement(
  p_settlement_id UUID,
  p_actor_user_id UUID,
  p_mission_days INTEGER,
  p_overnight_nights INTEGER,
  p_fixed_amount NUMERIC,
  p_daily_rate NUMERIC,
  p_overnight_rate NUMERIC,
  p_bonus_amount NUMERIC,
  p_adjustment_amount NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_row public.mission_financial_settlements%ROWTYPE;
  v_daily_amount NUMERIC(12,2);
  v_overnight_amount NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  SELECT *
  INTO v_row
  FROM public.mission_financial_settlements
  WHERE id = p_settlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial settlement not found';
  END IF;

  IF v_row.status IN ('approved', 'paid') THEN
    RAISE EXCEPTION 'Approved or paid settlement cannot be edited directly';
  END IF;

  IF p_mission_days < 1 OR p_overnight_nights < 0 THEN
    RAISE EXCEPTION 'Invalid mission days or nights';
  END IF;

  IF p_fixed_amount < 0 OR p_daily_rate < 0 OR p_overnight_rate < 0 OR p_bonus_amount < 0 THEN
    RAISE EXCEPTION 'Financial amounts cannot be negative';
  END IF;

  v_daily_amount := ROUND(p_mission_days * p_daily_rate, 2);
  v_overnight_amount := ROUND(p_overnight_nights * p_overnight_rate, 2);
  v_total := ROUND(
    p_fixed_amount +
    v_daily_amount +
    v_overnight_amount +
    p_bonus_amount +
    p_adjustment_amount,
    2
  );

  IF v_total < 0 THEN
    RAISE EXCEPTION 'Financial settlement total cannot be negative';
  END IF;

  UPDATE public.mission_financial_settlements
  SET
    status = 'prepared',
    mission_days = p_mission_days,
    overnight_nights = p_overnight_nights,
    fixed_amount = p_fixed_amount,
    daily_rate = p_daily_rate,
    daily_amount = v_daily_amount,
    overnight_rate = p_overnight_rate,
    overnight_amount = v_overnight_amount,
    bonus_amount = p_bonus_amount,
    adjustment_amount = p_adjustment_amount,
    total_amount = v_total,
    notes = NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    prepared_by = p_actor_user_id,
    prepared_at = NOW(),
    rejected_by = NULL,
    rejected_at = NULL,
    rejection_reason = NULL,
    updated_at = NOW()
  WHERE id = p_settlement_id;

  INSERT INTO public.mission_financial_events (
    settlement_id, mission_id, actor_user_id, event_type,
    from_status, to_status, metadata
  )
  VALUES (
    p_settlement_id,
    v_row.mission_id,
    p_actor_user_id,
    'prepared',
    v_row.status,
    'prepared',
    jsonb_build_object(
      'mission_days', p_mission_days,
      'overnight_nights', p_overnight_nights,
      'fixed_amount', p_fixed_amount,
      'daily_rate', p_daily_rate,
      'daily_amount', v_daily_amount,
      'overnight_rate', p_overnight_rate,
      'overnight_amount', v_overnight_amount,
      'bonus_amount', p_bonus_amount,
      'adjustment_amount', p_adjustment_amount,
      'total_amount', v_total
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_mission_financial_settlement(
  p_settlement_id UUID,
  p_actor_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_row public.mission_financial_settlements%ROWTYPE;
BEGIN
  SELECT *
  INTO v_row
  FROM public.mission_financial_settlements
  WHERE id = p_settlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial settlement not found';
  END IF;

  IF v_row.status <> 'prepared' THEN
    RAISE EXCEPTION 'Only prepared settlement can be approved';
  END IF;

  UPDATE public.mission_financial_settlements
  SET
    status = 'approved',
    approved_by = p_actor_user_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_settlement_id;

  INSERT INTO public.mission_financial_events (
    settlement_id, mission_id, actor_user_id, event_type,
    from_status, to_status, metadata
  )
  VALUES (
    p_settlement_id, v_row.mission_id, p_actor_user_id,
    'approved', v_row.status, 'approved',
    jsonb_build_object('total_amount', v_row.total_amount)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_mission_financial_settlement(
  p_settlement_id UUID,
  p_actor_user_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_row public.mission_financial_settlements%ROWTYPE;
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  SELECT *
  INTO v_row
  FROM public.mission_financial_settlements
  WHERE id = p_settlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial settlement not found';
  END IF;

  IF v_row.status = 'paid' THEN
    RAISE EXCEPTION 'Paid settlement cannot be rejected';
  END IF;

  UPDATE public.mission_financial_settlements
  SET
    status = 'rejected',
    rejected_by = p_actor_user_id,
    rejected_at = NOW(),
    rejection_reason = v_reason,
    approved_by = NULL,
    approved_at = NULL,
    updated_at = NOW()
  WHERE id = p_settlement_id;

  INSERT INTO public.mission_financial_events (
    settlement_id, mission_id, actor_user_id, event_type,
    from_status, to_status, reason
  )
  VALUES (
    p_settlement_id, v_row.mission_id, p_actor_user_id,
    'rejected', v_row.status, 'rejected', v_reason
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_mission_financial_settlement_paid(
  p_settlement_id UUID,
  p_actor_user_id UUID,
  p_payment_reference TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_row public.mission_financial_settlements%ROWTYPE;
  v_reference TEXT := NULLIF(BTRIM(COALESCE(p_payment_reference, '')), '');
BEGIN
  IF v_reference IS NULL THEN
    RAISE EXCEPTION 'Payment reference is required';
  END IF;

  SELECT *
  INTO v_row
  FROM public.mission_financial_settlements
  WHERE id = p_settlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial settlement not found';
  END IF;

  IF v_row.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved settlement can be marked paid';
  END IF;

  UPDATE public.mission_financial_settlements
  SET
    status = 'paid',
    paid_by = p_actor_user_id,
    paid_at = NOW(),
    payment_reference = v_reference,
    updated_at = NOW()
  WHERE id = p_settlement_id;

  INSERT INTO public.mission_financial_events (
    settlement_id, mission_id, actor_user_id, event_type,
    from_status, to_status, metadata
  )
  VALUES (
    p_settlement_id, v_row.mission_id, p_actor_user_id,
    'paid', v_row.status, 'paid',
    jsonb_build_object(
      'total_amount', v_row.total_amount,
      'payment_reference', v_reference
    )
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7) Batch approval/rejection RPCs
-- ---------------------------------------------------------------------------
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

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_v2_mission_assignment_batch(
  p_batch_id UUID,
  p_actor_user_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_batch public.mission_assignment_batches%ROWTYPE;
  v_mission RECORD;
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
  v_count INTEGER := 0;
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  SELECT *
  INTO v_batch
  FROM public.mission_assignment_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission assignment batch not found';
  END IF;

  IF v_batch.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only pending assignment batch can be rejected';
  END IF;

  UPDATE public.mission_assignment_batches
  SET
    status = 'rejected',
    rejected_by = p_actor_user_id,
    rejected_at = NOW(),
    rejection_reason = v_reason
  WHERE id = p_batch_id;

  FOR v_mission IN
    UPDATE public.missions
    SET
      status = 'rejected',
      rejection_reason = v_reason,
      updated_at = NOW()
    WHERE assignment_batch_id = p_batch_id
      AND status = 'pending_approval'
    RETURNING id
  LOOP
    INSERT INTO public.mission_events (
      mission_id, user_id, event_type, description, metadata
    )
    VALUES (
      v_mission.id,
      p_actor_user_id,
      'assignment_rejected',
      'تم رفض تكليف المأمورية وإعادته للمراجعة.',
      jsonb_build_object(
        'assignment_batch_id', p_batch_id,
        'reason', v_reason
      )
    );

    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.notifications (
    user_id, type, title, body
  )
  VALUES (
    v_batch.created_by,
    'mission_assignment_rejected',
    'تم رفض تكليف مأمورية',
    'تم رفض دفعة التكليف وإعادتها للمراجعة. السبب: ' || v_reason
  );

  RETURN v_count;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8) Replace V2 batch creation: pending batches do NOT notify inspectors
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 9) Service-role only mutation surface
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ensure_mission_financial_settlements(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_mission_financial_settlements(UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.prepare_mission_financial_settlement(
  UUID, UUID, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_mission_financial_settlement(
  UUID, UUID, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.approve_mission_financial_settlement(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_mission_financial_settlement(UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.reject_mission_financial_settlement(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_mission_financial_settlement(UUID, UUID, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.mark_mission_financial_settlement_paid(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_mission_financial_settlement_paid(UUID, UUID, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.approve_v2_mission_assignment_batch(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_v2_mission_assignment_batch(UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.reject_v2_mission_assignment_batch(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_v2_mission_assignment_batch(UUID, UUID, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.create_v2_mission_assignment_batch(
  UUID, UUID, UUID[], UUID, UUID[], UUID, DATE, DATE, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_v2_mission_assignment_batch(
  UUID, UUID, UUID[], UUID, UUID[], UUID, DATE, DATE, TEXT, TEXT, TEXT,
  BOOLEAN, BOOLEAN, TEXT, UUID
) TO service_role;

COMMIT;
