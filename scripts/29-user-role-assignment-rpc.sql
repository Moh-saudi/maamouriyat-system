-- ==============================================================================
-- Script 29: Atomic V2 User Role Assignment + Audit
-- Phase: 3F/Administration bridge
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.assign_v2_user_role(
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_role_id UUID,
  p_assignment_org_id UUID,
  p_valid_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  assignment_id UUID;
BEGIN
  SELECT id
  INTO assignment_id
  FROM public.user_roles
  WHERE user_id = p_target_user_id
    AND role_id = p_role_id
    AND assignment_org_id IS NOT DISTINCT FROM p_assignment_org_id
  LIMIT 1;

  IF assignment_id IS NULL THEN
    INSERT INTO public.user_roles (
      user_id,
      role_id,
      assignment_org_id,
      is_active,
      valid_from,
      valid_until,
      assigned_by
    )
    VALUES (
      p_target_user_id,
      p_role_id,
      p_assignment_org_id,
      TRUE,
      NOW(),
      p_valid_until,
      p_actor_user_id
    )
    RETURNING id INTO assignment_id;
  ELSE
    UPDATE public.user_roles
    SET
      is_active = TRUE,
      valid_from = NOW(),
      valid_until = p_valid_until,
      assigned_by = p_actor_user_id,
      updated_at = NOW()
    WHERE id = assignment_id;
  END IF;

  INSERT INTO public.access_admin_audit (
    actor_user_id,
    action,
    target_user_id,
    target_role_id,
    details
  )
  VALUES (
    p_actor_user_id,
    'user_role.assigned',
    p_target_user_id,
    p_role_id,
    jsonb_build_object(
      'assignment_id', assignment_id,
      'assignment_org_id', p_assignment_org_id,
      'valid_until', p_valid_until
    )
  );

  RETURN assignment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_v2_user_role(
  p_actor_user_id UUID,
  p_assignment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  target_user UUID;
  target_role UUID;
  target_org UUID;
BEGIN
  SELECT user_id, role_id, assignment_org_id
  INTO target_user, target_role, target_org
  FROM public.user_roles
  WHERE id = p_assignment_id
    AND is_active IS TRUE
  FOR UPDATE;

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'Active role assignment not found';
  END IF;

  UPDATE public.user_roles
  SET
    is_active = FALSE,
    valid_until = NOW(),
    updated_at = NOW()
  WHERE id = p_assignment_id;

  INSERT INTO public.access_admin_audit (
    actor_user_id,
    action,
    target_user_id,
    target_role_id,
    details
  )
  VALUES (
    p_actor_user_id,
    'user_role.revoked',
    target_user,
    target_role,
    jsonb_build_object(
      'assignment_id', p_assignment_id,
      'assignment_org_id', target_org
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_v2_user_role(UUID, UUID, UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_v2_user_role(UUID, UUID, UUID, UUID, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.assign_v2_user_role(UUID, UUID, UUID, UUID, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assign_v2_user_role(UUID, UUID, UUID, UUID, TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.revoke_v2_user_role(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_v2_user_role(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.revoke_v2_user_role(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_v2_user_role(UUID, UUID) TO service_role;

COMMIT;
