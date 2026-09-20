-- Trigger functions are invoked by PostgreSQL and must not be exposed as RPCs.
BEGIN;

REVOKE ALL ON FUNCTION public.trg_create_mission_financial_settlements()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_create_mission_financial_settlements()
  TO service_role;

COMMIT;
