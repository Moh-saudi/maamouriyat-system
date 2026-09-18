-- ==============================================================================
-- Script 45: Keep user context synchronized after organization moves
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.move_organization_by_type(
  p_actor_user_id UUID,
  p_organization_id UUID,
  p_new_parent_id UUID,
  p_new_type_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_current public.organizations%ROWTYPE;
  v_parent public.organizations%ROWTYPE;
  v_new_level INTEGER;
  v_max_descendant_depth INTEGER;
  v_new_sector_id UUID;
  v_new_governorate TEXT;
  v_new_health_admin TEXT;
BEGIN
  IF p_organization_id IS NULL
     OR p_new_parent_id IS NULL
     OR NULLIF(BTRIM(p_new_type_code), '') IS NULL THEN
    RAISE EXCEPTION 'Organization, parent, and type are required';
  END IF;

  IF p_organization_id = p_new_parent_id THEN
    RAISE EXCEPTION 'Organization cannot be its own parent';
  END IF;

  SELECT *
  INTO v_current
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF v_current.organization_type_code = 'ministry' THEN
    RAISE EXCEPTION 'Ministry organization cannot be moved';
  END IF;

  SELECT *
  INTO v_parent
  FROM public.organizations
  WHERE id = p_new_parent_id
    AND is_active IS TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent organization not found or inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_types type_row
    WHERE type_row.code = p_new_type_code
      AND type_row.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Organization type not found or inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_type_relations relation
    WHERE relation.parent_type_code = v_parent.organization_type_code
      AND relation.child_type_code = p_new_type_code
      AND relation.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION
      'Requested organization type is not allowed under selected parent';
  END IF;

  IF EXISTS (
    WITH RECURSIVE descendants AS (
      SELECT id
      FROM public.organizations
      WHERE parent_id = p_organization_id

      UNION ALL

      SELECT child.id
      FROM public.organizations child
      JOIN descendants descendant ON child.parent_id = descendant.id
    )
    SELECT 1
    FROM descendants
    WHERE id = p_new_parent_id
  ) THEN
    RAISE EXCEPTION 'Parent cannot be a descendant of the organization';
  END IF;

  v_new_level := v_parent.level + 1;

  SELECT COALESCE(MAX(level - v_current.level), 0)
  INTO v_max_descendant_depth
  FROM (
    WITH RECURSIVE subtree AS (
      SELECT id, level
      FROM public.organizations
      WHERE id = p_organization_id

      UNION ALL

      SELECT child.id, child.level
      FROM public.organizations child
      JOIN subtree parent ON child.parent_id = parent.id
    )
    SELECT level
    FROM subtree
  ) levels;

  IF v_new_level + v_max_descendant_depth > 7 THEN
    RAISE EXCEPTION
      'Moving this branch would exceed the supported hierarchy depth';
  END IF;

  v_new_sector_id := CASE
    WHEN p_new_type_code = 'sector' THEN v_current.id
    WHEN v_parent.organization_type_code = 'sector' THEN v_parent.id
    ELSE v_parent.sector_id
  END;

  v_new_governorate := CASE
    WHEN p_new_type_code = 'health_directorate'
      THEN v_current.governorate
    ELSE v_parent.governorate
  END;

  v_new_health_admin := CASE
    WHEN p_new_type_code = 'health_administration'
      THEN COALESCE(NULLIF(BTRIM(v_current.health_admin), ''), v_current.name)
    WHEN v_parent.organization_type_code = 'health_administration'
      THEN COALESCE(NULLIF(BTRIM(v_parent.health_admin), ''), v_parent.name)
    ELSE v_parent.health_admin
  END;

  UPDATE public.organizations
  SET
    parent_id = v_parent.id,
    organization_type_code = p_new_type_code,
    level = v_new_level,
    level_label = CASE p_new_type_code
      WHEN 'ministry' THEN 'ministry'
      WHEN 'sector' THEN 'sector'
      WHEN 'central_administration' THEN 'central_admin'
      WHEN 'general_administration' THEN 'general_admin'
      WHEN 'health_directorate' THEN 'directorate'
      WHEN 'health_administration' THEN 'health_admin'
      WHEN 'administration' THEN 'administration'
      WHEN 'department' THEN 'department'
      WHEN 'section' THEN 'section'
      ELSE 'administration'
    END,
    sector_id = v_new_sector_id,
    governorate = v_new_governorate,
    health_admin = v_new_health_admin,
    updated_at = NOW(),
    updated_by_user_id = p_actor_user_id
  WHERE id = v_current.id;

  WITH RECURSIVE subtree AS (
    SELECT
      root.id,
      root.name,
      root.organization_type_code,
      root.level AS new_level,
      root.sector_id AS new_sector_id,
      root.governorate AS new_governorate,
      root.health_admin AS new_health_admin
    FROM public.organizations root
    WHERE root.id = v_current.id

    UNION ALL

    SELECT
      child.id,
      child.name,
      child.organization_type_code,
      parent.new_level + 1,
      CASE
        WHEN child.organization_type_code = 'sector' THEN child.id
        WHEN parent.organization_type_code = 'sector' THEN parent.id
        ELSE parent.new_sector_id
      END,
      CASE
        WHEN child.organization_type_code = 'health_directorate'
          THEN child.governorate
        ELSE parent.new_governorate
      END,
      CASE
        WHEN child.organization_type_code = 'health_administration'
          THEN COALESCE(NULLIF(BTRIM(child.health_admin), ''), child.name)
        WHEN parent.organization_type_code = 'health_administration'
          THEN COALESCE(NULLIF(BTRIM(parent.new_health_admin), ''), parent.name)
        ELSE parent.new_health_admin
      END
    FROM public.organizations child
    JOIN subtree parent ON child.parent_id = parent.id
  )
  UPDATE public.organizations organization
  SET
    level = subtree.new_level,
    sector_id = subtree.new_sector_id,
    governorate = subtree.new_governorate,
    health_admin = subtree.new_health_admin,
    updated_at = NOW()
  FROM subtree
  WHERE organization.id = subtree.id
    AND organization.id <> v_current.id;

  -- Re-run the user sync trigger for every profile in the moved subtree.
  WITH RECURSIVE subtree_ids AS (
    SELECT id
    FROM public.organizations
    WHERE id = p_organization_id

    UNION ALL

    SELECT child.id
    FROM public.organizations child
    JOIN subtree_ids parent ON child.parent_id = parent.id
  )
  UPDATE public.users profile
  SET organization_id = profile.organization_id
  WHERE profile.organization_id IN (SELECT id FROM subtree_ids);

  INSERT INTO public.access_admin_audit (
    actor_user_id,
    action,
    details
  )
  VALUES (
    p_actor_user_id,
    'organization.moved_by_type',
    jsonb_build_object(
      'organization_id', p_organization_id,
      'old_parent_id', v_current.parent_id,
      'new_parent_id', p_new_parent_id,
      'old_type', v_current.organization_type_code,
      'new_type', p_new_type_code,
      'old_level', v_current.level,
      'new_level', v_new_level
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.move_organization_by_type(
  UUID, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_organization_by_type(
  UUID, UUID, UUID, TEXT
) TO service_role;

COMMIT;
