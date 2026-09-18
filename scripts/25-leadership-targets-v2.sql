-- ==============================================================================
-- Script 25: Leadership Targets V2 Persistence
-- Phase: 3F — Replace local JSON storage with reviewed server-only persistence
-- ==============================================================================

BEGIN;

DO $leadership_targets$
BEGIN
  IF to_regclass('public.leadership_targets') IS NOT NULL THEN
    RAISE EXCEPTION 'leadership_targets already exists; review existing schema before applying script 25';
  END IF;
END;
$leadership_targets$;

CREATE TABLE public.leadership_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  sector_head_id UUID NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  sector_id UUID NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  target_organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  undersecretary_id UUID NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  undersecretary_name TEXT NOT NULL,
  governorate TEXT NULL,
  target_missions INTEGER NOT NULL DEFAULT 15,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  instructions TEXT,
  created_by UUID NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_leadership_targets_count
    CHECK (target_missions > 0),

  CONSTRAINT chk_leadership_targets_dates
    CHECK (end_date >= start_date),

  CONSTRAINT chk_leadership_targets_status
    CHECK (status IN ('active', 'completed', 'expired'))
);

CREATE INDEX idx_leadership_targets_undersecretary
  ON public.leadership_targets (undersecretary_id);

CREATE INDEX idx_leadership_targets_sector
  ON public.leadership_targets (sector_id);

CREATE INDEX idx_leadership_targets_target_org
  ON public.leadership_targets (target_organization_id);

CREATE INDEX idx_leadership_targets_dates
  ON public.leadership_targets (start_date, end_date);

CREATE INDEX idx_leadership_targets_status
  ON public.leadership_targets (status);

CREATE INDEX idx_leadership_targets_created_by
  ON public.leadership_targets (created_by);

CREATE TRIGGER trg_leadership_targets_updated_at
  BEFORE UPDATE ON public.leadership_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.rbac_set_updated_at();

ALTER TABLE public.leadership_targets ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies by design.
-- Access is server-only after verified V2 authorization.

COMMIT;
