BEGIN;

CREATE INDEX IF NOT EXISTS idx_financial_claims_scope_org
  ON public.mission_financial_claims(scope_org_id);
CREATE INDEX IF NOT EXISTS idx_financial_claims_returned_by
  ON public.mission_financial_claims(returned_by)
  WHERE returned_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_claim_items_batch
  ON public.mission_financial_claim_items(assignment_batch_id);
CREATE INDEX IF NOT EXISTS idx_financial_claim_items_anchor_mission
  ON public.mission_financial_claim_items(anchor_mission_id);
CREATE INDEX IF NOT EXISTS idx_financial_settlements_claim
  ON public.mission_financial_settlements(claim_id)
  WHERE claim_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_mission_financial_claim_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_claim_id UUID := COALESCE(NEW.claim_id, OLD.claim_id);
  v_status TEXT;
  v_return_reason TEXT;
  v_returned_by UUID;
BEGIN
  IF v_claim_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT
    CASE
      WHEN BOOL_AND(status = 'paid') THEN 'paid'
      WHEN BOOL_OR(status = 'rejected') THEN 'returned'
      WHEN BOOL_AND(status IN ('approved', 'paid')) THEN 'approved'
      WHEN BOOL_OR(status IN ('prepared', 'approved', 'paid')) THEN 'under_review'
      ELSE 'submitted'
    END,
    (ARRAY_AGG(rejection_reason ORDER BY rejected_at DESC NULLS LAST)
      FILTER (WHERE status = 'rejected'))[1],
    (ARRAY_AGG(rejected_by ORDER BY rejected_at DESC NULLS LAST)
      FILTER (WHERE status = 'rejected'))[1]
  INTO v_status, v_return_reason, v_returned_by
  FROM public.mission_financial_settlements
  WHERE claim_id = v_claim_id;

  UPDATE public.mission_financial_claims
  SET status = COALESCE(v_status, status),
      approved_at = CASE WHEN v_status = 'approved' THEN COALESCE(approved_at, NOW()) ELSE approved_at END,
      paid_at = CASE WHEN v_status = 'paid' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
      returned_at = CASE WHEN v_status = 'returned' THEN COALESCE(returned_at, NOW()) ELSE returned_at END,
      returned_by = CASE WHEN v_status = 'returned' THEN v_returned_by ELSE returned_by END,
      return_reason = CASE WHEN v_status = 'returned' THEN v_return_reason ELSE return_reason END,
      updated_at = NOW()
  WHERE id = v_claim_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

COMMIT;
