-- ==============================================================================
-- Script 52: Aggregate organization usage across the full descendant tree
-- - Every organization reports totals for itself + all descendant organizations
-- - Child organization totals are recursive descendants, excluding the org itself
-- - The view remains live, so totals update automatically as records are added
-- ==============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.organization_usage_stats AS
WITH RECURSIVE organization_tree AS (
  SELECT
    o.id AS ancestor_id,
    o.id AS descendant_id,
    ARRAY[o.id]::UUID[] AS path
  FROM public.organizations o

  UNION ALL

  SELECT
    tree.ancestor_id,
    child.id AS descendant_id,
    tree.path || child.id
  FROM organization_tree tree
  JOIN public.organizations child
    ON child.parent_id = tree.descendant_id
  WHERE NOT child.id = ANY(tree.path)
),
descendant_stats AS (
  SELECT
    tree.ancestor_id AS organization_id,
    COUNT(*) FILTER (
      WHERE tree.descendant_id <> tree.ancestor_id
    ) AS child_organizations_total,
    COUNT(*) FILTER (
      WHERE tree.descendant_id <> tree.ancestor_id
        AND descendant.is_active IS TRUE
    ) AS child_organizations_active
  FROM organization_tree tree
  JOIN public.organizations descendant
    ON descendant.id = tree.descendant_id
  GROUP BY tree.ancestor_id
),
user_stats AS (
  SELECT
    tree.ancestor_id AS organization_id,
    COUNT(u.id) AS users_total,
    COUNT(u.id) FILTER (WHERE u.is_active IS TRUE) AS users_active
  FROM organization_tree tree
  JOIN public.users u
    ON u.organization_id = tree.descendant_id
  GROUP BY tree.ancestor_id
),
facility_stats AS (
  SELECT
    tree.ancestor_id AS organization_id,
    COUNT(f.id) AS facilities_total,
    COUNT(f.id) FILTER (WHERE f.is_active IS TRUE) AS facilities_active
  FROM organization_tree tree
  JOIN public.facilities f
    ON f.organization_id = tree.descendant_id
  GROUP BY tree.ancestor_id
),
mission_created_stats AS (
  SELECT
    tree.ancestor_id AS organization_id,
    COUNT(m.id) AS missions_created
  FROM organization_tree tree
  JOIN public.missions m
    ON m.created_by_org = tree.descendant_id
  GROUP BY tree.ancestor_id
),
mission_inspector_stats AS (
  SELECT
    tree.ancestor_id AS organization_id,
    COUNT(m.id) AS missions_inspector
  FROM organization_tree tree
  JOIN public.missions m
    ON m.inspector_org_id = tree.descendant_id
  GROUP BY tree.ancestor_id
),
role_stats AS (
  SELECT
    tree.ancestor_id AS organization_id,
    COUNT(ur.id) FILTER (WHERE ur.is_active IS TRUE) AS active_role_assignments
  FROM organization_tree tree
  JOIN public.user_roles ur
    ON ur.assignment_org_id = tree.descendant_id
  GROUP BY tree.ancestor_id
),
form_stats AS (
  SELECT
    tree.ancestor_id AS organization_id,
    COUNT(ft.id) AS form_templates_total
  FROM organization_tree tree
  JOIN public.form_templates ft
    ON ft.created_by_org = tree.descendant_id
  GROUP BY tree.ancestor_id
),
violation_stats AS (
  SELECT
    tree.ancestor_id AS organization_id,
    COUNT(v.id) AS violations_total
  FROM organization_tree tree
  JOIN public.violations v
    ON v.assigned_to_org_id = tree.descendant_id
  GROUP BY tree.ancestor_id
),
leadership_stats AS (
  SELECT
    tree.ancestor_id AS organization_id,
    COUNT(lt.id) AS leadership_targets_total
  FROM organization_tree tree
  JOIN public.leadership_targets lt
    ON lt.target_organization_id = tree.descendant_id
  GROUP BY tree.ancestor_id
),
mission_target_stats AS (
  SELECT
    tree.ancestor_id AS organization_id,
    COUNT(mt.id) AS mission_targets_total
  FROM organization_tree tree
  JOIN public.mission_targets mt
    ON mt.scope_organization_id = tree.descendant_id
  GROUP BY tree.ancestor_id
)
SELECT
  o.id AS organization_id,
  COALESCE(us.users_total, 0::BIGINT) AS users_total,
  COALESCE(us.users_active, 0::BIGINT) AS users_active,
  COALESCE(ds.child_organizations_total, 0::BIGINT) AS child_organizations_total,
  COALESCE(ds.child_organizations_active, 0::BIGINT) AS child_organizations_active,
  COALESCE(fs.facilities_total, 0::BIGINT) AS facilities_total,
  COALESCE(fs.facilities_active, 0::BIGINT) AS facilities_active,
  COALESCE(mcs.missions_created, 0::BIGINT) AS missions_created,
  COALESCE(mis.missions_inspector, 0::BIGINT) AS missions_inspector,
  COALESCE(rs.active_role_assignments, 0::BIGINT) AS active_role_assignments,
  COALESCE(fts.form_templates_total, 0::BIGINT) AS form_templates_total,
  COALESCE(vs.violations_total, 0::BIGINT) AS violations_total,
  COALESCE(ls.leadership_targets_total, 0::BIGINT) AS leadership_targets_total,
  COALESCE(mts.mission_targets_total, 0::BIGINT) AS mission_targets_total
FROM public.organizations o
LEFT JOIN user_stats us ON us.organization_id = o.id
LEFT JOIN descendant_stats ds ON ds.organization_id = o.id
LEFT JOIN facility_stats fs ON fs.organization_id = o.id
LEFT JOIN mission_created_stats mcs ON mcs.organization_id = o.id
LEFT JOIN mission_inspector_stats mis ON mis.organization_id = o.id
LEFT JOIN role_stats rs ON rs.organization_id = o.id
LEFT JOIN form_stats fts ON fts.organization_id = o.id
LEFT JOIN violation_stats vs ON vs.organization_id = o.id
LEFT JOIN leadership_stats ls ON ls.organization_id = o.id
LEFT JOIN mission_target_stats mts ON mts.organization_id = o.id;

COMMIT;
