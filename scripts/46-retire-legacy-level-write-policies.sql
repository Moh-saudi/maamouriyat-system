-- ==============================================================================
-- Script 46: Retire legacy level-based direct-write RLS where V2 server APIs exist
-- ==============================================================================

BEGIN;

-- Organizations are mutated only through the V2 server API + dynamic RBAC.
DROP POLICY IF EXISTS org_insert ON public.organizations;
DROP POLICY IF EXISTS org_update ON public.organizations;

-- User/profile administration is handled by server APIs.
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;

-- Facility creation/correction is handled by the Information Center server API.
DROP POLICY IF EXISTS facilities_insert ON public.facilities;
DROP POLICY IF EXISTS facilities_update ON public.facilities;

COMMIT;
