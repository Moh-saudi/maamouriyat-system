-- ==============================================================================
-- Script 42: Migrate regional health hierarchy out of the primary-care sector
-- - Health directorates become direct children of the ministry.
-- - Regional branches no longer inherit a central-sector id.
-- - Numeric level remains technical tree depth only.
-- - User organizational context is synchronized atomically.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_ministry_id UUID;
  v_directorate_count INTEGER;
  v_regional_node_count INTEGER;
  v_user_count INTEGER;
BEGIN
  SELECT id
  INTO v_ministry_id
  FROM public.organizations
  WHERE organization_type_code = 'ministry'
    AND is_active IS TRUE;

  IF v_ministry_id IS NULL THEN
    RAISE EXCEPTION 'Active ministry organization not found';
  END IF;

  SELECT COUNT(*)
  INTO v_directorate_count
  FROM public.organizations
  WHERE organization_type_code = 'health_directorate';

  IF v_directorate_count <> 27 THEN
    RAISE EXCEPTION
      'Expected 27 health directorates before migration, found %',
      v_directorate_count;
  END IF;

  -- Move every health directorate directly beneath the ministry.
  UPDATE public.organizations
  SET
    parent_id = v_ministry_id,
    level = 2,
    sector_id = NULL,
    health_admin = NULL,
    updated_at = NOW()
  WHERE organization_type_code = 'health_directorate';

  -- Recalculate every descendant from the real parent-child tree.
  WITH RECURSIVE regional_tree AS (
    SELECT
      root.id,
      root.name,
      root.organization_type_code,
      2::INTEGER AS new_level,
      NULL::UUID AS new_sector_id,
      root.governorate AS new_governorate,
      NULL::TEXT AS new_health_admin
    FROM public.organizations root
    WHERE root.organization_type_code = 'health_directorate'

    UNION ALL

    SELECT
      child.id,
      child.name,
      child.organization_type_code,
      parent.new_level + 1,
      NULL::UUID,
      parent.new_governorate,
      CASE
        WHEN child.organization_type_code = 'health_administration'
          THEN COALESCE(NULLIF(BTRIM(child.health_admin), ''), child.name)
        WHEN parent.organization_type_code = 'health_administration'
          THEN COALESCE(NULLIF(BTRIM(parent.new_health_admin), ''), parent.name)
        ELSE parent.new_health_admin
      END
    FROM public.organizations child
    JOIN regional_tree parent
      ON child.parent_id = parent.id
  )
  UPDATE public.organizations organization
  SET
    level = tree.new_level,
    sector_id = tree.new_sector_id,
    governorate = tree.new_governorate,
    health_admin = tree.new_health_admin,
    updated_at = NOW()
  FROM regional_tree tree
  WHERE organization.id = tree.id;

  -- Keep profile organizational context aligned with its actual organization.
  WITH RECURSIVE regional_ids AS (
    SELECT id
    FROM public.organizations
    WHERE organization_type_code = 'health_directorate'

    UNION ALL

    SELECT child.id
    FROM public.organizations child
    JOIN regional_ids parent
      ON child.parent_id = parent.id
  )
  UPDATE public.users profile
  SET
    level = organization.level,
    org_level = organization.level,
    sector_id = organization.sector_id
  FROM public.organizations organization
  WHERE profile.organization_id = organization.id
    AND organization.id IN (SELECT id FROM regional_ids);

  SELECT COUNT(*)
  INTO v_regional_node_count
  FROM public.organizations organization
  WHERE organization.organization_type_code IN (
    'health_directorate',
    'health_administration'
  )
     OR EXISTS (
       SELECT 1
       FROM public.organizations directorate
       WHERE directorate.organization_type_code = 'health_directorate'
         AND organization.parent_id = directorate.id
     );

  SELECT COUNT(*)
  INTO v_user_count
  FROM public.users profile
  JOIN public.organizations organization
    ON organization.id = profile.organization_id
  WHERE organization.organization_type_code IN (
    'health_directorate',
    'health_administration',
    'administration',
    'department',
    'section'
  )
    AND organization.governorate IS NOT NULL
    AND organization.sector_id IS NULL;

  INSERT INTO public.access_admin_audit (
    actor_user_id,
    action,
    details
  )
  VALUES (
    NULL,
    'organization.regional_hierarchy_migrated',
    jsonb_build_object(
      'directorates_moved', v_directorate_count,
      'regional_nodes_recalculated', v_regional_node_count,
      'regional_users_synchronized', v_user_count,
      'new_parent_id', v_ministry_id,
      'regional_sector_id', NULL
    )
  );
END $$;

COMMIT;
