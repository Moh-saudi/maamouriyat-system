-- ==============================================================================
-- Script 48: Harden legacy RLS helpers after organization hierarchy migration
-- ==============================================================================
--
-- Goals:
--   * Derive legacy scope classes from organization_type_code, never hierarchy
--     depth, so health directorates/admins keep their intended RLS semantics
--     after moving to technical levels 2/3.
--   * Keep SECURITY DEFINER implementation details outside the exposed public
--     schema while preserving backwards-compatible public RPC wrappers.
--   * Fix mutable search_path warnings on legacy trigger/helper functions.
--   * Restrict internal trigger/event-trigger functions from direct RPC use.
--   * Replace deprecated auth.role()-style read policies and cache auth.uid()
--     through init plans.
-- ==============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_current_user_data()
RETURNS TABLE(
  user_id UUID,
  org_level INTEGER,
  sector_id UUID,
  org_id UUID,
  governorate TEXT,
  health_admin TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public, private
AS $function$
  SELECT
    u.id AS user_id,
    CASE o.organization_type_code
      WHEN 'ministry' THEN 1
      WHEN 'sector' THEN 2
      WHEN 'central_administration' THEN 3
      WHEN 'general_administration' THEN 4
      WHEN 'health_directorate' THEN 5
      WHEN 'health_administration' THEN 6
      ELSE 7
    END AS org_level,
    CASE
      WHEN o.organization_type_code = 'sector' THEN o.id
      ELSE COALESCE(u.sector_id, o.sector_id)
    END AS sector_id,
    COALESCE(u.organization_id, u.org_unit_id, o.id) AS org_id,
    COALESCE(o.governorate, '') AS governorate,
    COALESCE(o.health_admin, '') AS health_admin
  FROM public.users u
  LEFT JOIN public.organizations o
    ON o.id = COALESCE(u.organization_id, u.org_unit_id)
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND u.auth_id = (SELECT auth.uid())
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION private.get_current_user_data()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_current_user_data()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_current_user_data()
RETURNS TABLE(
  user_id UUID,
  org_level INTEGER,
  sector_id UUID,
  org_id UUID,
  governorate TEXT,
  health_admin TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog, public, private
AS $function$
  SELECT * FROM private.get_current_user_data();
$function$;

REVOKE ALL ON FUNCTION public.get_current_user_data()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_data()
  TO authenticated, service_role;

-- Compatibility wrapper retained until all legacy clients stop requesting a
-- serial number before inserting a mission. New code relies on the insert
-- trigger and does not call this RPC.
CREATE OR REPLACE FUNCTION private.generate_serial_number(dept_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private
AS $function$
DECLARE
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_month TEXT := TO_CHAR(NOW(), 'MM');
  v_seq BIGINT;
  v_serial TEXT;
  v_exists BOOLEAN;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  LOOP
    v_seq := nextval('public.mission_serial_seq');
    v_serial :=
      'MIS-' || v_year || '-' || v_month || '-' ||
      LPAD(v_seq::TEXT, 5, '0') || '-' ||
      UPPER(COALESCE(dept_code, 'MIS'));

    SELECT EXISTS (
      SELECT 1
      FROM public.missions
      WHERE serial_number = v_serial
    )
    INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_serial;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION private.generate_serial_number(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.generate_serial_number(TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_serial_number(
  dept_code TEXT DEFAULT 'GEN'::TEXT
)
RETURNS TEXT
LANGUAGE sql
SECURITY INVOKER
SET search_path TO pg_catalog, public, private
AS $function$
  SELECT private.generate_serial_number(dept_code);
$function$;

REVOKE ALL ON FUNCTION public.generate_serial_number(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_serial_number(TEXT)
  TO authenticated, service_role;

ALTER FUNCTION public.calculate_mission_duration()
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.update_updated_at()
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.set_correction_deadline()
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.update_mission_violation_count()
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.log_mission_destination_change()
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.update_organization_updated_at()
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.handle_new_auth_user()
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.is_org_under(UUID, UUID)
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.get_form_for_mission(UUID, UUID)
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.generate_mission_serial(TEXT, TEXT)
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.sync_mission_compat_fields()
  SET search_path TO pg_catalog, public;
ALTER FUNCTION public.set_mission_serial_trigger()
  SET search_path TO pg_catalog, public;

REVOKE ALL ON FUNCTION public.handle_new_auth_user()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user()
  TO service_role;

REVOKE ALL ON FUNCTION public.is_org_under(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_under(UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable()
  TO service_role;

REVOKE ALL ON FUNCTION public.set_mission_serial_trigger()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_mission_serial_trigger()
  TO service_role;

ALTER POLICY org_units_read_authenticated
ON public.organizational_units
TO authenticated
USING (TRUE);

ALTER POLICY user_permissions_select
ON public.user_permissions
TO authenticated
USING (TRUE);

ALTER POLICY notif_select
ON public.notifications
USING (
  user_id = (
    SELECT ctx.user_id
    FROM public.get_current_user_data() AS ctx
  )
  OR user_id = (SELECT auth.uid())
);

ALTER POLICY notif_update
ON public.notifications
USING (
  user_id = (
    SELECT ctx.user_id
    FROM public.get_current_user_data() AS ctx
  )
  OR user_id = (SELECT auth.uid())
)
WITH CHECK (
  user_id = (
    SELECT ctx.user_id
    FROM public.get_current_user_data() AS ctx
  )
  OR user_id = (SELECT auth.uid())
);

ALTER POLICY users_select
ON public.users
USING (
  (SELECT ctx.org_level FROM public.get_current_user_data() AS ctx) = 1
  OR (SELECT ctx.sector_id FROM public.get_current_user_data() AS ctx)
       = '00000000-0000-0000-0000-000000000014'::UUID
  OR (SELECT ctx.org_level FROM public.get_current_user_data() AS ctx) <= 6
  OR auth_id = (SELECT auth.uid())
);

COMMIT;
