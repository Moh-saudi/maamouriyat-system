-- Employee-owned financial claims are independent from technical mission reports.
-- One claim may contain several completed assignment batches, but each batch is
-- represented once for the claimant regardless of its facility count.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.mission_financial_claim_number_seq;

CREATE TABLE IF NOT EXISTS public.mission_financial_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  scope_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'submitted',
  employee_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  returned_by UUID REFERENCES public.users(id),
  return_reason TEXT,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mission_financial_claims_status_check CHECK (
    status IN ('submitted', 'under_review', 'returned', 'approved', 'paid', 'cancelled')
  )
);

CREATE TABLE IF NOT EXISTS public.mission_financial_claim_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.mission_financial_claims(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  assignment_batch_id UUID NOT NULL REFERENCES public.mission_assignment_batches(id) ON DELETE RESTRICT,
  anchor_mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE RESTRICT,
  governorate TEXT NOT NULL,
  destination_summary TEXT NOT NULL,
  actual_start_date DATE NOT NULL,
  actual_end_date DATE NOT NULL,
  actual_duration_days INTEGER NOT NULL,
  overnight_nights INTEGER NOT NULL DEFAULT 0,
  accommodation_type TEXT NOT NULL DEFAULT 'none',
  accommodation_details TEXT,
  accommodation_cost_claimed NUMERIC(12,2) NOT NULL DEFAULT 0,
  transport_mode TEXT NOT NULL,
  departure_location TEXT NOT NULL,
  return_location TEXT NOT NULL,
  transport_details TEXT,
  transport_cost_claimed NUMERIC(12,2) NOT NULL DEFAULT 0,
  employee_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mission_financial_claim_items_dates_check CHECK (actual_end_date >= actual_start_date),
  CONSTRAINT mission_financial_claim_items_days_check CHECK (actual_duration_days >= 1),
  CONSTRAINT mission_financial_claim_items_nights_check CHECK (
    overnight_nights >= 0 AND overnight_nights <= GREATEST(actual_duration_days - 1, 0)
  ),
  CONSTRAINT mission_financial_claim_items_accommodation_check CHECK (
    accommodation_type IN ('none', 'government', 'hotel', 'self_arranged', 'other')
  ),
  CONSTRAINT mission_financial_claim_items_transport_check CHECK (
    transport_mode IN ('ministry_vehicle', 'public_transport', 'private_vehicle', 'rail', 'air', 'other')
  ),
  CONSTRAINT mission_financial_claim_items_costs_check CHECK (
    accommodation_cost_claimed >= 0 AND transport_cost_claimed >= 0
  ),
  UNIQUE (claim_id, assignment_batch_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_active_financial_claim_item_user_batch
  ON public.mission_financial_claim_items(user_id, assignment_batch_id);

CREATE INDEX IF NOT EXISTS idx_financial_claims_user_status
  ON public.mission_financial_claims(user_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_claims_scope_status
  ON public.mission_financial_claims(scope_org_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_claim_items_claim
  ON public.mission_financial_claim_items(claim_id, created_at);

ALTER TABLE public.mission_financial_settlements
  ADD COLUMN IF NOT EXISTS claim_id UUID REFERENCES public.mission_financial_claims(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS claim_item_id UUID REFERENCES public.mission_financial_claim_items(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mission_financial_settlements_claim_item
  ON public.mission_financial_settlements(claim_item_id)
  WHERE claim_item_id IS NOT NULL;

ALTER TABLE public.mission_financial_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_financial_claim_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mission_financial_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mission_financial_claim_items FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mission_financial_claims TO service_role;
GRANT ALL ON TABLE public.mission_financial_claim_items TO service_role;
REVOKE ALL ON SEQUENCE public.mission_financial_claim_number_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.mission_financial_claim_number_seq TO service_role;

CREATE OR REPLACE FUNCTION public.submit_employee_mission_financial_claim(
  p_actor_user_id UUID,
  p_items JSONB,
  p_employee_notes TEXT DEFAULT NULL
)
RETURNS TABLE(claim_id UUID, claim_number TEXT, settlement_count INTEGER, submitted_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user public.users%ROWTYPE;
  v_claim_id UUID;
  v_claim_number TEXT;
  v_item JSONB;
  v_batch public.mission_assignment_batches%ROWTYPE;
  v_batch_id UUID;
  v_anchor_mission_id UUID;
  v_governorate TEXT;
  v_destination_summary TEXT;
  v_claim_item_id UUID;
  v_settlement_count INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_accommodation_type TEXT;
  v_transport_mode TEXT;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_actor_user_id AND is_active = TRUE;
  IF NOT FOUND OR v_user.organization_id IS NULL THEN
    RAISE EXCEPTION 'FINANCIAL_CLAIM_USER_INVALID';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'FINANCIAL_CLAIM_ITEMS_REQUIRED';
  END IF;

  IF jsonb_array_length(p_items) > 30 THEN
    RAISE EXCEPTION 'FINANCIAL_CLAIM_ITEMS_LIMIT';
  END IF;

  v_claim_number := 'FCL-' || TO_CHAR(v_now, 'YYYY') || '-' ||
    LPAD(nextval('public.mission_financial_claim_number_seq')::TEXT, 6, '0');

  INSERT INTO public.mission_financial_claims (
    claim_number, user_id, scope_org_id, employee_notes, submitted_at
  ) VALUES (
    v_claim_number,
    p_actor_user_id,
    v_user.organization_id,
    NULLIF(BTRIM(COALESCE(p_employee_notes, '')), ''),
    v_now
  ) RETURNING id INTO v_claim_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_batch_id := (v_item->>'assignment_batch_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'FINANCIAL_CLAIM_BATCH_INVALID';
    END;

    SELECT * INTO v_batch
    FROM public.mission_assignment_batches
    WHERE id = v_batch_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_batch.status NOT IN ('completed', 'closed')
       OR v_batch.actual_start_date IS NULL
       OR v_batch.actual_end_date IS NULL
       OR v_batch.actual_duration_days IS NULL
       OR v_batch.actual_overnight_nights IS NULL THEN
      RAISE EXCEPTION 'FINANCIAL_CLAIM_BATCH_NOT_READY';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.missions m
      LEFT JOIN public.mission_team mt
        ON mt.mission_id = m.id AND mt.user_id = p_actor_user_id
      WHERE m.assignment_batch_id = v_batch_id
        AND (
          m.primary_inspector_id = p_actor_user_id
          OR m.assigned_user_id = p_actor_user_id
          OR mt.user_id IS NOT NULL
        )
    ) THEN
      RAISE EXCEPTION 'FINANCIAL_CLAIM_NOT_TEAM_MEMBER';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.assignment_batch_id = v_batch_id
        AND m.status NOT IN ('completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة')
    ) THEN
      RAISE EXCEPTION 'FINANCIAL_CLAIM_BATCH_NOT_READY';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.mission_financial_claim_items ci
      WHERE ci.user_id = p_actor_user_id AND ci.assignment_batch_id = v_batch_id
    ) THEN
      RAISE EXCEPTION 'FINANCIAL_CLAIM_BATCH_ALREADY_SUBMITTED';
    END IF;

    SELECT
      (ARRAY_AGG(m.id ORDER BY m.scheduled_date, m.created_at, m.id))[1],
      MIN(NULLIF(BTRIM(f.governorate), '')),
      STRING_AGG(DISTINCT f.name, '، ' ORDER BY f.name)
    INTO v_anchor_mission_id, v_governorate, v_destination_summary
    FROM public.missions m
    JOIN public.facilities f ON f.id = m.facility_id
    WHERE m.assignment_batch_id = v_batch_id;

    IF v_anchor_mission_id IS NULL OR v_governorate IS NULL THEN
      RAISE EXCEPTION 'FINANCIAL_CLAIM_DESTINATION_INVALID';
    END IF;

    v_accommodation_type := COALESCE(NULLIF(v_item->>'accommodation_type', ''), 'none');
    v_transport_mode := NULLIF(v_item->>'transport_mode', '');

    IF v_accommodation_type NOT IN ('none', 'government', 'hotel', 'self_arranged', 'other')
       OR v_transport_mode IS NULL
       OR v_transport_mode NOT IN ('ministry_vehicle', 'public_transport', 'private_vehicle', 'rail', 'air', 'other') THEN
      RAISE EXCEPTION 'FINANCIAL_CLAIM_TRAVEL_DETAILS_INVALID';
    END IF;

    IF NULLIF(BTRIM(COALESCE(v_item->>'departure_location', '')), '') IS NULL
       OR NULLIF(BTRIM(COALESCE(v_item->>'return_location', '')), '') IS NULL THEN
      RAISE EXCEPTION 'FINANCIAL_CLAIM_TRAVEL_LOCATIONS_REQUIRED';
    END IF;

    INSERT INTO public.mission_financial_claim_items (
      claim_id, user_id, assignment_batch_id, anchor_mission_id,
      governorate, destination_summary,
      actual_start_date, actual_end_date, actual_duration_days, overnight_nights,
      accommodation_type, accommodation_details, accommodation_cost_claimed,
      transport_mode, departure_location, return_location, transport_details,
      transport_cost_claimed, employee_notes
    ) VALUES (
      v_claim_id, p_actor_user_id, v_batch_id, v_anchor_mission_id,
      v_governorate, v_destination_summary,
      v_batch.actual_start_date, v_batch.actual_end_date,
      v_batch.actual_duration_days, v_batch.actual_overnight_nights,
      v_accommodation_type,
      NULLIF(BTRIM(COALESCE(v_item->>'accommodation_details', '')), ''),
      GREATEST(COALESCE((v_item->>'accommodation_cost_claimed')::NUMERIC, 0), 0),
      v_transport_mode,
      BTRIM(v_item->>'departure_location'), BTRIM(v_item->>'return_location'),
      NULLIF(BTRIM(COALESCE(v_item->>'transport_details', '')), ''),
      GREATEST(COALESCE((v_item->>'transport_cost_claimed')::NUMERIC, 0), 0),
      NULLIF(BTRIM(COALESCE(v_item->>'employee_notes', '')), '')
    ) RETURNING id INTO v_claim_item_id;

    INSERT INTO public.mission_financial_settlements (
      mission_id, assignment_batch_id, user_id, scope_org_id,
      status, mission_days, overnight_nights, claim_id, claim_item_id
    ) VALUES (
      v_anchor_mission_id, v_batch_id, p_actor_user_id, v_user.organization_id,
      'pending_review', GREATEST(v_batch.actual_duration_days, 1),
      GREATEST(v_batch.actual_overnight_nights, 0), v_claim_id, v_claim_item_id
    )
    ON CONFLICT (mission_id, user_id) DO UPDATE SET
      assignment_batch_id = EXCLUDED.assignment_batch_id,
      scope_org_id = EXCLUDED.scope_org_id,
      status = 'pending_review',
      mission_days = EXCLUDED.mission_days,
      overnight_nights = EXCLUDED.overnight_nights,
      claim_id = EXCLUDED.claim_id,
      claim_item_id = EXCLUDED.claim_item_id,
      rejection_reason = NULL,
      rejected_by = NULL,
      rejected_at = NULL,
      updated_at = NOW()
    WHERE public.mission_financial_settlements.status IN ('pending_review', 'rejected');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FINANCIAL_CLAIM_SETTLEMENT_ALREADY_LOCKED';
    END IF;

    v_settlement_count := v_settlement_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_claim_id, v_claim_number, v_settlement_count, v_now;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_mission_financial_claim_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_claim_id UUID := COALESCE(NEW.claim_id, OLD.claim_id);
  v_status TEXT;
BEGIN
  IF v_claim_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT CASE
    WHEN BOOL_AND(status = 'paid') THEN 'paid'
    WHEN BOOL_OR(status = 'rejected') THEN 'returned'
    WHEN BOOL_AND(status IN ('approved', 'paid')) THEN 'approved'
    WHEN BOOL_OR(status IN ('prepared', 'approved', 'paid')) THEN 'under_review'
    ELSE 'submitted'
  END INTO v_status
  FROM public.mission_financial_settlements
  WHERE claim_id = v_claim_id;

  UPDATE public.mission_financial_claims
  SET status = COALESCE(v_status, status),
      approved_at = CASE WHEN v_status = 'approved' THEN COALESCE(approved_at, NOW()) ELSE approved_at END,
      paid_at = CASE WHEN v_status = 'paid' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
      returned_at = CASE WHEN v_status = 'returned' THEN COALESCE(returned_at, NOW()) ELSE returned_at END,
      updated_at = NOW()
  WHERE id = v_claim_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_mission_financial_claim_status ON public.mission_financial_settlements;
CREATE TRIGGER trg_sync_mission_financial_claim_status
AFTER INSERT OR UPDATE OF status ON public.mission_financial_settlements
FOR EACH ROW EXECUTE FUNCTION public.sync_mission_financial_claim_status();

CREATE OR REPLACE FUNCTION public.guard_submitted_assignment_financial_basis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (
       OLD.report_submitted_to_finance_at IS NOT NULL
       OR EXISTS (
         SELECT 1
         FROM public.mission_financial_claim_items ci
         JOIN public.mission_financial_claims c ON c.id = ci.claim_id
         WHERE ci.assignment_batch_id = OLD.id
           AND c.status NOT IN ('returned', 'cancelled')
       )
     ) AND (
       OLD.actual_start_date IS DISTINCT FROM NEW.actual_start_date
       OR OLD.actual_end_date IS DISTINCT FROM NEW.actual_end_date
       OR OLD.actual_overnight_nights IS DISTINCT FROM NEW.actual_overnight_nights
       OR OLD.completion_disposition IS DISTINCT FROM NEW.completion_disposition
       OR OLD.timing_adjustment_reason IS DISTINCT FROM NEW.timing_adjustment_reason
       OR OLD.report_submitted_to_finance_at IS DISTINCT FROM NEW.report_submitted_to_finance_at
       OR OLD.report_submitted_to_finance_by IS DISTINCT FROM NEW.report_submitted_to_finance_by
     ) THEN
    RAISE EXCEPTION 'MISSION_BATCH_FINANCE_ALREADY_STARTED: financial basis is frozen after a claim is submitted';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_employee_mission_financial_claim(UUID, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_employee_mission_financial_claim(UUID, JSONB, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.sync_mission_financial_claim_status()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_mission_financial_claim_status()
  TO service_role;

COMMIT;
