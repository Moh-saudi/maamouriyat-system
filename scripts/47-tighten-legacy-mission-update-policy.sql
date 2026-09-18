-- ==============================================================================
-- Script 47: Prevent depth changes from broadening direct mission updates
-- ==============================================================================

BEGIN;

DROP POLICY IF EXISTS missions_update ON public.missions;

CREATE POLICY missions_update
ON public.missions
FOR UPDATE
TO authenticated
USING (
  primary_inspector_id = (
    SELECT ctx.user_id
    FROM public.get_current_user_data() ctx
  )
  OR assigned_user_id = (
    SELECT ctx.user_id
    FROM public.get_current_user_data() ctx
  )
  OR created_by = (
    SELECT ctx.user_id
    FROM public.get_current_user_data() ctx
  )
)
WITH CHECK (
  primary_inspector_id = (
    SELECT ctx.user_id
    FROM public.get_current_user_data() ctx
  )
  OR assigned_user_id = (
    SELECT ctx.user_id
    FROM public.get_current_user_data() ctx
  )
  OR created_by = (
    SELECT ctx.user_id
    FROM public.get_current_user_data() ctx
  )
);

COMMIT;
