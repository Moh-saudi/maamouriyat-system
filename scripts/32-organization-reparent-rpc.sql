-- ==============================================================================
-- Script 32: Safe Organization Reparenting
-- Phase: V2 Organization Administration
--
-- Reparents an organization inside the fixed seven-level hierarchy while:
-- - preventing self/cycle parenting,
-- - preserving level semantics,
-- - propagating sector context to the moved subtree,
-- - refreshing inherited governorate/health-admin context where applicable,
-- - recording an immutable access-admin audit event.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reparent_v2_organization(
  p_actor_user_id UUID,
  p_organization_id UUID,
  p_new_parent_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  current_row public.organizations%ROWTYPE;
  parent_row public.organizations%ROWTYPE;
  expected_parent_level INTEGER;
  resolved_sector_id UUID;
  descendant_cycle_count INTEGER;
BEGIN
  IF p_organization_id IS NULL OR p_new_parent_id IS NULL THEN
    RAISE EXCEPTION 'Organization and new parent are required';
  END IF;

  IF p_organization_id = p_new_parent_id THEN
    RAISE EXCEPTION 'Organization cannot be its own parent';
  END IF;

  SELECT *
  INTO current_row
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF current_row.level <= 1 THEN
    RAISE EXCEPTION 'Root ministry organization cannot be reparented';
  END IF;

  SELECT *
  INTO parent_row
  FROM public.organizations
  WHERE id = p_new_parent_id
    AND is_active IS TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'New parent organization not found or inactive';
  END IF;

  expected_parent_level := current_row.level - 1;

  IF parent_row.level <> expected_parent_level THEN
    RAISE EXCEPTION
      'Invalid parent level: organization level % requires parent level %, received %',
      current_row.level,
      expected_parent_level,
      parent_row.level;
  END IF;

  WITH RECURSIVE descendants AS (
    SELECT id
    FROM public.organizations
    WHERE parent_id = p_organization_id

    UNION ALL

    SELECT child.id
    FROM public.organizations child
    JOIN descendants d ON child.parent_id = d.id
  )
  SELECT COUNT(*)
  INTO descendant_cycle_count
  FROM descendants
  WHERE id = p_new_parent_id;

  IF descendant_cycle_count > 0 THEN
    RAISE EXCEPTION 'New parent cannot be a descendant of the organization';
  END IF;

  resolved_sector_id := CASE
    WHEN current_row.level = 2 THEN current_row.id
    WHEN parent_row.level = 2 THEN parent_row.id
    ELSE parent_row.sector_id
  END;

  IF current_row.level >= 3 AND resolved_sector_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve sector anchor for new parent';
  END IF;

  UPDATE public.organizations
  SET
    parent_id = parent_row.id,
    sector_id = resolved_sector_id,
    governorate = CASE
      WHEN current_row.level >= 6 THEN parent_row.governorate
      ELSE governorate
    END,
    health_admin = CASE
      WHEN current_row.level = 7 THEN parent_row.health_admin
      ELSE health_admin
    END,
    updated_at = NOW()
  WHERE id = current_row.id;

  WITH RECURSIVE subtree AS (
    SELECT id, level
    FROM public.organizations
    WHERE parent_id = current_row.id

    UNION ALL

    SELECT child.id, child.level
    FROM public.organizations child
    JOIN subtree s ON child.parent_id = s.id
  )
  UPDATE public.organizations organization
  SET
    sector_id = resolved_sector_id,
    governorate = CASE
      WHEN current_row.level = 6 THEN parent_row.governorate
      ELSE organization.governorate
    END,
    health_admin = CASE
      WHEN current_row.level = 6
           AND organization.level = 7
        THEN current_row.health_admin
      ELSE organization.health_admin
    END,
    updated_at = NOW()
  FROM subtree
  WHERE organization.id = subtree.id;

  INSERT INTO public.access_admin_audit (
    actor_user_id,
    action,
    details
  )
  VALUES (
    p_actor_user_id,
    'organization.reparented',
    jsonb_build_object(
      'organization_id', p_organization_id,
      'old_parent_id', current_row.parent_id,
      'new_parent_id', p_new_parent_id,
      'level', current_row.level,
      'resolved_sector_id', resolved_sector_id
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reparent_v2_organization(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reparent_v2_organization(UUID, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.reparent_v2_organization(UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reparent_v2_organization(UUID, UUID, UUID) TO service_role;

COMMIT;
