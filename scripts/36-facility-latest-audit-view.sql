-- ==============================================================================
-- Script 36: Latest facility audit summary
-- ==============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.facility_latest_change
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (a.facility_id)
  a.facility_id,
  a.created_at,
  a.action,
  a.actor_user_id,
  u.full_name AS actor_name
FROM public.facility_change_audit a
LEFT JOIN public.users u ON u.id = a.actor_user_id
ORDER BY a.facility_id, a.created_at DESC;

REVOKE ALL ON TABLE public.facility_latest_change FROM PUBLIC;
REVOKE ALL ON TABLE public.facility_latest_change FROM anon;
REVOKE ALL ON TABLE public.facility_latest_change FROM authenticated;
GRANT SELECT ON TABLE public.facility_latest_change TO service_role;

COMMIT;
