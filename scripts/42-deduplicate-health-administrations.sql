-- ==============================================================================
-- Script 42: Deduplicate health administrations and prevent duplicate siblings
-- ==============================================================================
--
-- Production shape before this migration:
--   * 462 health_administration rows = 231 exact sibling pairs.
--   * 230 pairs have one referenced row and one empty row.
--   * One pair (Abnoub) is split: users/roles/missions on one row and 16
--     facilities on the other.
--
-- Safety strategy:
--   * Rank each duplicate pair by identity/history references first, then by
--     total live references.
--   * Abort if the production shape differs from the audited shape.
--   * Move only the 16 facility references from duplicate rows.
--   * Abort if any other reference exists on a row selected for deletion.
--   * Delete exactly one row from every pair.
--   * Add a normalized sibling uniqueness index to prevent recurrence.
--
-- The script is safe to re-run after a successful migration: when the 231
-- canonical health administrations already exist with no duplicate pairs, the
-- data-move phase is skipped and the uniqueness index is only ensured.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE public.organizations IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.facilities IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE tmp_health_admin_merge_map (
  drop_id UUID PRIMARY KEY,
  keep_id UUID NOT NULL,
  parent_id UUID,
  name TEXT NOT NULL,
  keep_identity_refs BIGINT NOT NULL,
  keep_live_refs BIGINT NOT NULL,
  drop_identity_refs BIGINT NOT NULL,
  drop_live_refs BIGINT NOT NULL
) ON COMMIT DROP;

WITH usage AS (
  SELECT
    h.id,
    h.name,
    h.parent_id,
    h.created_at,
    (
      (SELECT COUNT(*) FROM public.users x WHERE x.organization_id = h.id) +
      (SELECT COUNT(*) FROM public.roles x WHERE x.owner_organization_id = h.id) +
      (SELECT COUNT(*) FROM public.user_roles x WHERE x.assignment_org_id = h.id) +
      (SELECT COUNT(*) FROM public.mission_targets x WHERE x.scope_organization_id = h.id) +
      (SELECT COUNT(*) FROM public.missions x WHERE x.created_by_org = h.id) +
      (SELECT COUNT(*) FROM public.missions x WHERE x.inspector_org_id = h.id) +
      (SELECT COUNT(*) FROM public.form_criteria x WHERE x.added_by_org = h.id) +
      (SELECT COUNT(*) FROM public.form_sections x WHERE x.added_by_org = h.id) +
      (SELECT COUNT(*) FROM public.form_templates x WHERE x.created_by_org = h.id) +
      (SELECT COUNT(*) FROM public.org_form_customizations x WHERE x.organization_id = h.id) +
      (SELECT COUNT(*) FROM public.violations x WHERE x.assigned_to_org_id = h.id) +
      (SELECT COUNT(*) FROM public.leadership_targets x WHERE x.target_organization_id = h.id) +
      (SELECT COUNT(*) FROM public.organizations x WHERE x.parent_id = h.id)
    )::BIGINT AS identity_refs,
    (
      (SELECT COUNT(*) FROM public.users x WHERE x.organization_id = h.id) +
      (SELECT COUNT(*) FROM public.facilities x WHERE x.organization_id = h.id) +
      (SELECT COUNT(*) FROM public.roles x WHERE x.owner_organization_id = h.id) +
      (SELECT COUNT(*) FROM public.user_roles x WHERE x.assignment_org_id = h.id) +
      (SELECT COUNT(*) FROM public.mission_targets x WHERE x.scope_organization_id = h.id) +
      (SELECT COUNT(*) FROM public.missions x WHERE x.created_by_org = h.id) +
      (SELECT COUNT(*) FROM public.missions x WHERE x.inspector_org_id = h.id) +
      (SELECT COUNT(*) FROM public.form_criteria x WHERE x.added_by_org = h.id) +
      (SELECT COUNT(*) FROM public.form_sections x WHERE x.added_by_org = h.id) +
      (SELECT COUNT(*) FROM public.form_templates x WHERE x.created_by_org = h.id) +
      (SELECT COUNT(*) FROM public.org_form_customizations x WHERE x.organization_id = h.id) +
      (SELECT COUNT(*) FROM public.violations x WHERE x.assigned_to_org_id = h.id) +
      (SELECT COUNT(*) FROM public.leadership_targets x WHERE x.target_organization_id = h.id) +
      (SELECT COUNT(*) FROM public.organizations x WHERE x.parent_id = h.id)
    )::BIGINT AS live_refs
  FROM public.organizations h
  WHERE h.organization_type_code = 'health_administration'
),
ranked AS (
  SELECT
    u.*,
    COUNT(*) OVER (PARTITION BY parent_id, name) AS group_size,
    ROW_NUMBER() OVER (
      PARTITION BY parent_id, name
      ORDER BY identity_refs DESC, live_refs DESC, created_at ASC NULLS LAST, id
    ) AS rn
  FROM usage u
),
pairs AS (
  SELECT
    d.id AS drop_id,
    k.id AS keep_id,
    d.parent_id,
    d.name,
    k.identity_refs AS keep_identity_refs,
    k.live_refs AS keep_live_refs,
    d.identity_refs AS drop_identity_refs,
    d.live_refs AS drop_live_refs
  FROM ranked d
  JOIN ranked k
    ON k.parent_id IS NOT DISTINCT FROM d.parent_id
   AND k.name = d.name
   AND k.rn = 1
  WHERE d.group_size = 2
    AND d.rn = 2
)
INSERT INTO tmp_health_admin_merge_map
SELECT * FROM pairs;

DO $$
DECLARE
  v_health_admin_rows BIGINT;
  v_map_rows BIGINT;
  v_both_used BIGINT;
  v_one_used_one_empty BIGINT;
  v_facility_refs BIGINT;
  v_other_refs BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_health_admin_rows
  FROM public.organizations
  WHERE organization_type_code = 'health_administration';

  SELECT COUNT(*) INTO v_map_rows
  FROM tmp_health_admin_merge_map;

  IF v_map_rows = 0 THEN
    IF v_health_admin_rows <> 231 THEN
      RAISE EXCEPTION
        'Expected 231 canonical health administrations when no duplicates exist, found %',
        v_health_admin_rows;
    END IF;
    RETURN;
  END IF;

  SELECT COUNT(*) FILTER (
           WHERE keep_live_refs > 0 AND drop_live_refs > 0
         ),
         COUNT(*) FILTER (
           WHERE keep_live_refs > 0 AND drop_live_refs = 0
         )
  INTO v_both_used, v_one_used_one_empty
  FROM tmp_health_admin_merge_map;

  SELECT COUNT(*) INTO v_facility_refs
  FROM public.facilities f
  JOIN tmp_health_admin_merge_map m ON m.drop_id = f.organization_id;

  SELECT
    (SELECT COUNT(*) FROM public.organizations x JOIN tmp_health_admin_merge_map m ON x.parent_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.organizations x JOIN tmp_health_admin_merge_map m ON x.sector_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.users x JOIN tmp_health_admin_merge_map m ON x.organization_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.users x JOIN tmp_health_admin_merge_map m ON x.sector_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.users x JOIN tmp_health_admin_merge_map m ON x.org_unit_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.facilities x JOIN tmp_health_admin_merge_map m ON x.sector_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.facility_change_audit x JOIN tmp_health_admin_merge_map m ON x.actor_organization_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.form_criteria x JOIN tmp_health_admin_merge_map m ON x.added_by_org = m.drop_id) +
    (SELECT COUNT(*) FROM public.form_sections x JOIN tmp_health_admin_merge_map m ON x.added_by_org = m.drop_id) +
    (SELECT COUNT(*) FROM public.form_templates x JOIN tmp_health_admin_merge_map m ON x.created_by_org = m.drop_id) +
    (SELECT COUNT(*) FROM public.leadership_targets x JOIN tmp_health_admin_merge_map m ON x.sector_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.leadership_targets x JOIN tmp_health_admin_merge_map m ON x.target_organization_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.mission_targets x JOIN tmp_health_admin_merge_map m ON x.scope_organization_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.mission_targets x JOIN tmp_health_admin_merge_map m ON x.sector_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.missions x JOIN tmp_health_admin_merge_map m ON x.created_by_org = m.drop_id) +
    (SELECT COUNT(*) FROM public.missions x JOIN tmp_health_admin_merge_map m ON x.inspector_org_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.missions x JOIN tmp_health_admin_merge_map m ON x.sector_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.missions x JOIN tmp_health_admin_merge_map m ON x.org_unit_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.org_form_customizations x JOIN tmp_health_admin_merge_map m ON x.organization_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.organization_change_audit x JOIN tmp_health_admin_merge_map m ON x.organization_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.roles x JOIN tmp_health_admin_merge_map m ON x.owner_organization_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.user_roles x JOIN tmp_health_admin_merge_map m ON x.assignment_org_id = m.drop_id) +
    (SELECT COUNT(*) FROM public.violations x JOIN tmp_health_admin_merge_map m ON x.assigned_to_org_id = m.drop_id)
  INTO v_other_refs;

  IF v_health_admin_rows <> 462 THEN
    RAISE EXCEPTION 'Expected 462 health administration rows, found %', v_health_admin_rows;
  END IF;

  IF v_map_rows <> 231 THEN
    RAISE EXCEPTION 'Expected 231 duplicate pairs, found %', v_map_rows;
  END IF;

  IF v_both_used <> 1 OR v_one_used_one_empty <> 230 THEN
    RAISE EXCEPTION
      'Unexpected duplicate usage shape: both_used=%, one_used_one_empty=%',
      v_both_used, v_one_used_one_empty;
  END IF;

  IF v_facility_refs <> 16 THEN
    RAISE EXCEPTION 'Expected 16 facilities on drop rows, found %', v_facility_refs;
  END IF;

  IF v_other_refs <> 0 THEN
    RAISE EXCEPTION 'Unexpected non-facility references on drop rows: %', v_other_refs;
  END IF;
END;
$$;

UPDATE public.facilities f
SET organization_id = m.keep_id
FROM tmp_health_admin_merge_map m
WHERE f.organization_id = m.drop_id;

DO $$
DECLARE
  v_remaining_facilities BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_remaining_facilities
  FROM public.facilities f
  JOIN tmp_health_admin_merge_map m ON m.drop_id = f.organization_id;

  IF v_remaining_facilities <> 0 THEN
    RAISE EXCEPTION 'Facility reassignment incomplete: % rows remain', v_remaining_facilities;
  END IF;
END;
$$;

DELETE FROM public.organizations o
USING tmp_health_admin_merge_map m
WHERE o.id = m.drop_id;

DO $$
DECLARE
  v_health_admin_rows BIGINT;
  v_duplicate_groups BIGINT;
  v_drop_rows_remaining BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_health_admin_rows
  FROM public.organizations
  WHERE organization_type_code = 'health_administration';

  SELECT COUNT(*) INTO v_duplicate_groups
  FROM (
    SELECT parent_id, name
    FROM public.organizations
    WHERE organization_type_code = 'health_administration'
    GROUP BY parent_id, name
    HAVING COUNT(*) > 1
  ) d;

  SELECT COUNT(*) INTO v_drop_rows_remaining
  FROM public.organizations o
  JOIN tmp_health_admin_merge_map m ON m.drop_id = o.id;

  IF v_health_admin_rows <> 231 THEN
    RAISE EXCEPTION 'Expected 231 health administrations after merge, found %', v_health_admin_rows;
  END IF;

  IF v_duplicate_groups <> 0 THEN
    RAISE EXCEPTION 'Duplicate health administration groups remain: %', v_duplicate_groups;
  END IF;

  IF v_drop_rows_remaining <> 0 THEN
    RAISE EXCEPTION 'Deleted organization rows still present: %', v_drop_rows_remaining;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_organizations_parent_type_normalized_name
ON public.organizations (
  parent_id,
  organization_type_code,
  (LOWER(BTRIM(name)))
)
NULLS NOT DISTINCT;

COMMIT;
