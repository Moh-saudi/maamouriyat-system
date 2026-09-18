-- ==============================================================================
-- Script 26: Mission Targets V2 Persistence
-- Phase: 3F — Replace local JSON mission-target storage
-- ==============================================================================

BEGIN;

DO $mission_targets$
BEGIN
  IF to_regclass('public.mission_targets') IS NOT NULL
     OR to_regclass('public.mission_target_facilities') IS NOT NULL THEN
    RAISE EXCEPTION 'mission target V2 tables already exist; review schema before applying script 26';
  END IF;
END;
$mission_targets$;

CREATE TABLE public.mission_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  period_label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_missions INTEGER NOT NULL DEFAULT 1,
  scope_level TEXT NOT NULL,
  scope_name TEXT NOT NULL,
  scope_organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  assigned_user_id UUID NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  sector_id UUID NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  target_type TEXT NOT NULL DEFAULT 'aggregate',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_mission_targets_period_type
    CHECK (period_type IN ('monthly', 'quarterly', 'custom')),

  CONSTRAINT chk_mission_targets_scope_level
    CHECK (scope_level IN ('ministry', 'sector', 'governorate', 'health_admin', 'user')),

  CONSTRAINT chk_mission_targets_target_type
    CHECK (target_type IN ('aggregate', 'specific_facilities')),

  CONSTRAINT chk_mission_targets_status
    CHECK (status IN ('active', 'completed', 'cancelled')),

  CONSTRAINT chk_mission_targets_count
    CHECK (target_missions > 0),

  CONSTRAINT chk_mission_targets_dates
    CHECK (end_date >= start_date),

  CONSTRAINT chk_mission_targets_scope_anchor
    CHECK (
      (scope_level = 'ministry')
      OR (scope_level = 'sector' AND sector_id IS NOT NULL)
      OR (scope_level IN ('governorate', 'health_admin') AND scope_organization_id IS NOT NULL)
      OR (scope_level = 'user' AND assigned_user_id IS NOT NULL)
    )
);

CREATE TABLE public.mission_target_facilities (
  target_id UUID NOT NULL REFERENCES public.mission_targets(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (target_id, facility_id)
);

CREATE INDEX idx_mission_targets_status
  ON public.mission_targets (status);

CREATE INDEX idx_mission_targets_dates
  ON public.mission_targets (start_date, end_date);

CREATE INDEX idx_mission_targets_scope_org
  ON public.mission_targets (scope_organization_id);

CREATE INDEX idx_mission_targets_sector
  ON public.mission_targets (sector_id);

CREATE INDEX idx_mission_targets_assigned_user
  ON public.mission_targets (assigned_user_id);

CREATE INDEX idx_mission_targets_created_by
  ON public.mission_targets (created_by);

CREATE INDEX idx_mission_target_facilities_facility
  ON public.mission_target_facilities (facility_id);

CREATE TRIGGER trg_mission_targets_updated_at
  BEFORE UPDATE ON public.mission_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.rbac_set_updated_at();

ALTER TABLE public.mission_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_target_facilities ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies by design.
-- Server-only access after verified V2 permission/scope checks.

COMMIT;
