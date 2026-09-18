-- ==============================================================================
-- Script 31: Atomic Custom Role Administration + Audit
-- Phase: V2 Administration
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.save_v2_custom_role(
  p_actor_user_id UUID,
  p_role_id UUID,
  p_code TEXT,
  p_name_ar TEXT,
  p_description_ar TEXT,
  p_owner_organization_id UUID,
  p_grants JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  target_role_id UUID;
  existing_system BOOLEAN;
  grant_item JSONB;
  old_state JSONB;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid role code';
  END IF;

  IF p_name_ar IS NULL OR btrim(p_name_ar) = '' THEN
    RAISE EXCEPTION 'Role name is required';
  END IF;

  IF p_grants IS NULL OR jsonb_typeof(p_grants) <> 'array' THEN
    RAISE EXCEPTION 'Role grants must be a JSON array';
  END IF;

  IF jsonb_array_length(p_grants) = 0 THEN
    RAISE EXCEPTION 'Custom role must have at least one grant';
  END IF;

  IF p_role_id IS NULL THEN
    INSERT INTO public.roles (
      code,
      name_ar,
      description_ar,
      owner_organization_id,
      is_system,
      is_active,
      priority,
      created_by
    )
    VALUES (
      p_code,
      btrim(p_name_ar),
      NULLIF(btrim(COALESCE(p_description_ar, '')), ''),
      p_owner_organization_id,
      FALSE,
      TRUE,
      100,
      p_actor_user_id
    )
    RETURNING id INTO target_role_id;

    old_state := NULL;
  ELSE
    SELECT
      is_system,
      jsonb_build_object(
        'code', code,
        'name_ar', name_ar,
        'description_ar', description_ar,
        'owner_organization_id', owner_organization_id,
        'is_active', is_active
      )
    INTO existing_system, old_state
    FROM public.roles
    WHERE id = p_role_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Role not found';
    END IF;

    IF existing_system IS TRUE THEN
      RAISE EXCEPTION 'System roles cannot be modified through custom role administration';
    END IF;

    target_role_id := p_role_id;

    UPDATE public.roles
    SET
      code = p_code,
      name_ar = btrim(p_name_ar),
      description_ar = NULLIF(btrim(COALESCE(p_description_ar, '')), ''),
      owner_organization_id = p_owner_organization_id,
      is_active = TRUE,
      updated_at = NOW()
    WHERE id = target_role_id;

    DELETE FROM public.role_permission_grants
    WHERE role_id = target_role_id;
  END IF;

  FOR grant_item IN
    SELECT value
    FROM jsonb_array_elements(p_grants)
  LOOP
    IF NOT (grant_item ? 'permission_key')
       OR NOT (grant_item ? 'scope_type') THEN
      RAISE EXCEPTION 'Every grant requires permission_key and scope_type';
    END IF;

    INSERT INTO public.role_permission_grants (
      role_id,
      permission_key,
      scope_type,
      created_by
    )
    VALUES (
      target_role_id,
      grant_item->>'permission_key',
      grant_item->>'scope_type',
      p_actor_user_id
    );
  END LOOP;

  INSERT INTO public.access_admin_audit (
    actor_user_id,
    action,
    target_role_id,
    details
  )
  VALUES (
    p_actor_user_id,
    CASE
      WHEN p_role_id IS NULL THEN 'role.created'
      ELSE 'role.updated'
    END,
    target_role_id,
    jsonb_build_object(
      'before', old_state,
      'after', jsonb_build_object(
        'code', p_code,
        'name_ar', btrim(p_name_ar),
        'description_ar', NULLIF(btrim(COALESCE(p_description_ar, '')), ''),
        'owner_organization_id', p_owner_organization_id,
        'grant_count', jsonb_array_length(p_grants)
      )
    )
  );

  RETURN target_role_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.disable_v2_custom_role(
  p_actor_user_id UUID,
  p_role_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  system_role BOOLEAN;
  affected_assignments INTEGER;
BEGIN
  SELECT is_system
  INTO system_role
  FROM public.roles
  WHERE id = p_role_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  IF system_role IS TRUE THEN
    RAISE EXCEPTION 'System roles cannot be disabled';
  END IF;

  UPDATE public.roles
  SET
    is_active = FALSE,
    updated_at = NOW()
  WHERE id = p_role_id;

  UPDATE public.user_roles
  SET
    is_active = FALSE,
    valid_until = COALESCE(valid_until, NOW()),
    updated_at = NOW()
  WHERE role_id = p_role_id
    AND is_active IS TRUE;

  GET DIAGNOSTICS affected_assignments = ROW_COUNT;

  INSERT INTO public.access_admin_audit (
    actor_user_id,
    action,
    target_role_id,
    details
  )
  VALUES (
    p_actor_user_id,
    'role.disabled',
    p_role_id,
    jsonb_build_object(
      'assignments_deactivated', affected_assignments
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_v2_custom_role(UUID, UUID, TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_v2_custom_role(UUID, UUID, TEXT, TEXT, TEXT, UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.save_v2_custom_role(UUID, UUID, TEXT, TEXT, TEXT, UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_v2_custom_role(UUID, UUID, TEXT, TEXT, TEXT, UUID, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.disable_v2_custom_role(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.disable_v2_custom_role(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.disable_v2_custom_role(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.disable_v2_custom_role(UUID, UUID) TO service_role;

COMMIT;
