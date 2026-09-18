-- ==============================================================================
-- Script 40: Organization lifecycle, provenance, audit, and usage summary
-- ==============================================================================

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deactivated_by_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS archived_by_user_id UUID NULL;

UPDATE public.organizations
SET lifecycle_status = CASE
  WHEN is_active IS TRUE THEN 'active'
  ELSE 'inactive'
END
WHERE lifecycle_status IS NULL
   OR lifecycle_status NOT IN ('active', 'inactive', 'archived');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_lifecycle_status_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_lifecycle_status_check
      CHECK (lifecycle_status IN ('active', 'inactive', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_created_by_user_id_fkey
      FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_updated_by_user_id_fkey'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_updated_by_user_id_fkey
      FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_deactivated_by_user_id_fkey'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_deactivated_by_user_id_fkey
      FOREIGN KEY (deactivated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_archived_by_user_id_fkey'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_archived_by_user_id_fkey
      FOREIGN KEY (archived_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.organization_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID NULL
    REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT NULL,
  before_data JSONB NULL,
  after_data JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_change_audit_action_check
    CHECK (action IN ('create', 'update', 'deactivate', 'reactivate', 'archive'))
);

CREATE INDEX IF NOT EXISTS idx_organization_change_audit_org_created
  ON public.organization_change_audit (organization_id, created_at DESC);

ALTER TABLE public.organization_change_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organization_change_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.organization_change_audit TO service_role;

CREATE OR REPLACE VIEW public.organization_usage_stats
WITH (security_invoker = true)
AS
WITH
user_stats AS (
  SELECT
    organization_id,
    COUNT(*)::BIGINT AS users_total,
    COUNT(*) FILTER (WHERE is_active IS TRUE)::BIGINT AS users_active
  FROM public.users
  GROUP BY organization_id
),
child_stats AS (
  SELECT
    parent_id AS organization_id,
    COUNT(*)::BIGINT AS child_organizations_total,
    COUNT(*) FILTER (WHERE is_active IS TRUE)::BIGINT AS child_organizations_active
  FROM public.organizations
  WHERE parent_id IS NOT NULL
  GROUP BY parent_id
),
facility_stats AS (
  SELECT
    organization_id,
    COUNT(*)::BIGINT AS facilities_total,
    COUNT(*) FILTER (WHERE is_active IS TRUE)::BIGINT AS facilities_active
  FROM public.facilities
  WHERE organization_id IS NOT NULL
  GROUP BY organization_id
),
mission_created_stats AS (
  SELECT created_by_org AS organization_id, COUNT(*)::BIGINT AS missions_created
  FROM public.missions
  WHERE created_by_org IS NOT NULL
  GROUP BY created_by_org
),
mission_inspector_stats AS (
  SELECT inspector_org_id AS organization_id, COUNT(*)::BIGINT AS missions_inspector
  FROM public.missions
  WHERE inspector_org_id IS NOT NULL
  GROUP BY inspector_org_id
),
role_stats AS (
  SELECT
    assignment_org_id AS organization_id,
    COUNT(*) FILTER (WHERE is_active IS TRUE)::BIGINT AS active_role_assignments
  FROM public.user_roles
  WHERE assignment_org_id IS NOT NULL
  GROUP BY assignment_org_id
),
form_stats AS (
  SELECT created_by_org AS organization_id, COUNT(*)::BIGINT AS form_templates_total
  FROM public.form_templates
  WHERE created_by_org IS NOT NULL
  GROUP BY created_by_org
),
violation_stats AS (
  SELECT assigned_to_org_id AS organization_id, COUNT(*)::BIGINT AS violations_total
  FROM public.violations
  WHERE assigned_to_org_id IS NOT NULL
  GROUP BY assigned_to_org_id
),
leadership_stats AS (
  SELECT target_organization_id AS organization_id, COUNT(*)::BIGINT AS leadership_targets_total
  FROM public.leadership_targets
  WHERE target_organization_id IS NOT NULL
  GROUP BY target_organization_id
),
mission_target_stats AS (
  SELECT scope_organization_id AS organization_id, COUNT(*)::BIGINT AS mission_targets_total
  FROM public.mission_targets
  WHERE scope_organization_id IS NOT NULL
  GROUP BY scope_organization_id
)
SELECT
  o.id AS organization_id,
  COALESCE(us.users_total, 0)::BIGINT AS users_total,
  COALESCE(us.users_active, 0)::BIGINT AS users_active,
  COALESCE(cs.child_organizations_total, 0)::BIGINT AS child_organizations_total,
  COALESCE(cs.child_organizations_active, 0)::BIGINT AS child_organizations_active,
  COALESCE(fs.facilities_total, 0)::BIGINT AS facilities_total,
  COALESCE(fs.facilities_active, 0)::BIGINT AS facilities_active,
  COALESCE(mcs.missions_created, 0)::BIGINT AS missions_created,
  COALESCE(mis.missions_inspector, 0)::BIGINT AS missions_inspector,
  COALESCE(rs.active_role_assignments, 0)::BIGINT AS active_role_assignments,
  COALESCE(fts.form_templates_total, 0)::BIGINT AS form_templates_total,
  COALESCE(vs.violations_total, 0)::BIGINT AS violations_total,
  COALESCE(ls.leadership_targets_total, 0)::BIGINT AS leadership_targets_total,
  COALESCE(mts.mission_targets_total, 0)::BIGINT AS mission_targets_total
FROM public.organizations o
LEFT JOIN user_stats us ON us.organization_id = o.id
LEFT JOIN child_stats cs ON cs.organization_id = o.id
LEFT JOIN facility_stats fs ON fs.organization_id = o.id
LEFT JOIN mission_created_stats mcs ON mcs.organization_id = o.id
LEFT JOIN mission_inspector_stats mis ON mis.organization_id = o.id
LEFT JOIN role_stats rs ON rs.organization_id = o.id
LEFT JOIN form_stats fts ON fts.organization_id = o.id
LEFT JOIN violation_stats vs ON vs.organization_id = o.id
LEFT JOIN leadership_stats ls ON ls.organization_id = o.id
LEFT JOIN mission_target_stats mts ON mts.organization_id = o.id;

REVOKE ALL ON TABLE public.organization_usage_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.organization_usage_stats TO service_role;

CREATE OR REPLACE FUNCTION public.mutate_organization_lifecycle(
  p_organization_id UUID,
  p_action TEXT,
  p_actor_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_before public.organizations%ROWTYPE;
  v_after public.organizations%ROWTYPE;
BEGIN
  IF p_action NOT IN ('deactivate', 'reactivate', 'archive') THEN
    RAISE EXCEPTION 'Unsupported organization lifecycle action';
  END IF;

  SELECT *
  INTO v_before
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF v_before.organization_type_code = 'ministry' THEN
    RAISE EXCEPTION 'Ministry organization lifecycle cannot be changed';
  END IF;

  IF p_action = 'deactivate' THEN
    UPDATE public.organizations
    SET
      is_active = FALSE,
      lifecycle_status = 'inactive',
      deactivated_at = NOW(),
      deactivated_by_user_id = p_actor_user_id,
      updated_at = NOW(),
      updated_by_user_id = p_actor_user_id
    WHERE id = p_organization_id
    RETURNING * INTO v_after;
  ELSIF p_action = 'reactivate' THEN
    UPDATE public.organizations
    SET
      is_active = TRUE,
      lifecycle_status = 'active',
      deactivated_at = NULL,
      deactivated_by_user_id = NULL,
      archived_at = NULL,
      archived_by_user_id = NULL,
      updated_at = NOW(),
      updated_by_user_id = p_actor_user_id
    WHERE id = p_organization_id
    RETURNING * INTO v_after;
  ELSE
    UPDATE public.organizations
    SET
      is_active = FALSE,
      lifecycle_status = 'archived',
      archived_at = NOW(),
      archived_by_user_id = p_actor_user_id,
      updated_at = NOW(),
      updated_by_user_id = p_actor_user_id
    WHERE id = p_organization_id
    RETURNING * INTO v_after;
  END IF;

  INSERT INTO public.organization_change_audit (
    organization_id,
    actor_user_id,
    action,
    reason,
    before_data,
    after_data
  )
  VALUES (
    p_organization_id,
    p_actor_user_id,
    p_action,
    NULLIF(BTRIM(p_reason), ''),
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mutate_organization_lifecycle(
  UUID, TEXT, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_organization_lifecycle(
  UUID, TEXT, UUID, TEXT
) TO service_role;

COMMIT;
