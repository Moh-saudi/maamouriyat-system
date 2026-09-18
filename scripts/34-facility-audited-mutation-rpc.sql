-- ==============================================================================
-- Script 34: Atomic facility mutation + audit
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.mutate_facility_with_audit(
  p_facility_id UUID,
  p_action TEXT,
  p_actor_user_id UUID,
  p_actor_organization_id UUID,
  p_payload JSONB DEFAULT '{}'::JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_id UUID;
  v_before public.facilities%ROWTYPE;
  v_after public.facilities%ROWTYPE;
  v_before_json JSONB;
  v_after_json JSONB;
  v_changed_fields TEXT[];
BEGIN
  IF p_action NOT IN ('create', 'update', 'deactivate', 'reactivate') THEN
    RAISE EXCEPTION 'Unsupported facility action';
  END IF;

  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Actor user is required';
  END IF;

  IF p_action = 'create' THEN
    v_id := COALESCE(p_facility_id, gen_random_uuid());

    INSERT INTO public.facilities (
      id,
      name,
      facility_type,
      organization_id,
      sector_id,
      governorate,
      health_admin,
      urban_rural,
      village_city,
      latitude,
      longitude,
      is_active
    )
    VALUES (
      v_id,
      NULLIF(BTRIM(p_payload->>'name'), ''),
      NULLIF(BTRIM(p_payload->>'facility_type'), ''),
      NULLIF(p_payload->>'organization_id', '')::UUID,
      NULLIF(p_payload->>'sector_id', '')::UUID,
      NULLIF(BTRIM(p_payload->>'governorate'), ''),
      NULLIF(BTRIM(p_payload->>'health_admin'), ''),
      NULLIF(BTRIM(p_payload->>'urban_rural'), ''),
      NULLIF(BTRIM(p_payload->>'village_city'), ''),
      (p_payload->>'latitude')::NUMERIC,
      (p_payload->>'longitude')::NUMERIC,
      COALESCE((p_payload->>'is_active')::BOOLEAN, TRUE)
    )
    RETURNING * INTO v_after;

    v_after_json := to_jsonb(v_after);
    v_changed_fields := ARRAY[
      'name', 'facility_type', 'organization_id', 'sector_id',
      'governorate', 'health_admin', 'urban_rural', 'village_city',
      'latitude', 'longitude', 'is_active'
    ];
  ELSE
    SELECT *
    INTO v_before
    FROM public.facilities
    WHERE id = p_facility_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Facility not found';
    END IF;

    v_id := v_before.id;
    v_before_json := to_jsonb(v_before);

    IF p_action = 'deactivate' THEN
      UPDATE public.facilities
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = v_id
      RETURNING * INTO v_after;
    ELSIF p_action = 'reactivate' THEN
      UPDATE public.facilities
      SET is_active = TRUE,
          updated_at = NOW()
      WHERE id = v_id
      RETURNING * INTO v_after;
    ELSE
      UPDATE public.facilities
      SET
        name = CASE
          WHEN p_payload ? 'name'
            THEN NULLIF(BTRIM(p_payload->>'name'), '')
          ELSE name
        END,
        facility_type = CASE
          WHEN p_payload ? 'facility_type'
            THEN NULLIF(BTRIM(p_payload->>'facility_type'), '')
          ELSE facility_type
        END,
        organization_id = CASE
          WHEN p_payload ? 'organization_id'
            THEN NULLIF(p_payload->>'organization_id', '')::UUID
          ELSE organization_id
        END,
        sector_id = CASE
          WHEN p_payload ? 'sector_id'
            THEN NULLIF(p_payload->>'sector_id', '')::UUID
          ELSE sector_id
        END,
        governorate = CASE
          WHEN p_payload ? 'governorate'
            THEN NULLIF(BTRIM(p_payload->>'governorate'), '')
          ELSE governorate
        END,
        health_admin = CASE
          WHEN p_payload ? 'health_admin'
            THEN NULLIF(BTRIM(p_payload->>'health_admin'), '')
          ELSE health_admin
        END,
        urban_rural = CASE
          WHEN p_payload ? 'urban_rural'
            THEN NULLIF(BTRIM(p_payload->>'urban_rural'), '')
          ELSE urban_rural
        END,
        village_city = CASE
          WHEN p_payload ? 'village_city'
            THEN NULLIF(BTRIM(p_payload->>'village_city'), '')
          ELSE village_city
        END,
        latitude = CASE
          WHEN p_payload ? 'latitude'
            THEN (p_payload->>'latitude')::NUMERIC
          ELSE latitude
        END,
        longitude = CASE
          WHEN p_payload ? 'longitude'
            THEN (p_payload->>'longitude')::NUMERIC
          ELSE longitude
        END,
        updated_at = NOW()
      WHERE id = v_id
      RETURNING * INTO v_after;
    END IF;

    v_after_json := to_jsonb(v_after);

    SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::TEXT[])
    INTO v_changed_fields
    FROM jsonb_object_keys(v_after_json) AS key
    WHERE (v_before_json -> key) IS DISTINCT FROM (v_after_json -> key);
  END IF;

  INSERT INTO public.facility_change_audit (
    facility_id,
    actor_user_id,
    actor_organization_id,
    action,
    reason,
    before_data,
    after_data,
    changed_fields
  )
  VALUES (
    v_id,
    p_actor_user_id,
    p_actor_organization_id,
    p_action,
    NULLIF(BTRIM(p_reason), ''),
    v_before_json,
    v_after_json,
    COALESCE(v_changed_fields, ARRAY[]::TEXT[])
  );

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.mutate_facility_with_audit(
  UUID, TEXT, UUID, UUID, JSONB, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mutate_facility_with_audit(
  UUID, TEXT, UUID, UUID, JSONB, TEXT
) FROM anon;
REVOKE ALL ON FUNCTION public.mutate_facility_with_audit(
  UUID, TEXT, UUID, UUID, JSONB, TEXT
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_facility_with_audit(
  UUID, TEXT, UUID, UUID, JSONB, TEXT
) TO service_role;

COMMIT;
