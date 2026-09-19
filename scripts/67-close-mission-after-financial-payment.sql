-- ==============================================================================
-- Script 67: Close mission after all financial settlements are paid
-- ==============================================================================
BEGIN;

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
    settlement_id,
    mission_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    metadata
  )
  VALUES (
    p_settlement_id,
    v_row.mission_id,
    p_actor_user_id,
    'paid',
    v_row.status,
    'paid',
    jsonb_build_object(
      'total_amount', v_row.total_amount,
      'payment_reference', v_reference
    )
  );

  -- "Executed" means the field report is complete. The mission becomes fully
  -- "ended/closed" only after every team member's financial settlement is paid.
  IF NOT EXISTS (
    SELECT 1
    FROM public.mission_financial_settlements s
    WHERE s.mission_id = v_row.mission_id
      AND s.status <> 'paid'
  ) THEN
    UPDATE public.missions
    SET
      status = 'closed',
      updated_at = NOW()
    WHERE id = v_row.mission_id
      AND status IN ('completed', 'done', 'منفذة', 'مكتملة');

    IF FOUND THEN
      INSERT INTO public.mission_events (
        mission_id,
        user_id,
        event_type,
        description,
        metadata
      )
      VALUES (
        v_row.mission_id,
        p_actor_user_id,
        'mission_closed_financially',
        'تم إغلاق المأمورية بعد صرف جميع الاستحقاقات المالية لأعضاء الفريق.',
        jsonb_build_object(
          'closed_after_all_settlements_paid', TRUE
        )
      );
    END IF;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_mission_financial_settlement_paid(
  UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mark_mission_financial_settlement_paid(
  UUID, UUID, TEXT
) TO service_role;

COMMIT;
