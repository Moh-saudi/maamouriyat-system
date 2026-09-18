-- ==============================================================================
-- Script 39: Expand legacy level_label compatibility values
-- organization_type_code is the business type; level_label remains transitional.
-- ==============================================================================

BEGIN;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_level_label_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_level_label_check
  CHECK (
    level_label IN (
      'ministry',
      'sector',
      'central_admin',
      'general_admin',
      'administration',
      'department',
      'section',
      'directorate',
      'health_admin',
      'unit'
    )
  );

COMMIT;
