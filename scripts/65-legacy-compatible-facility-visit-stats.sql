-- ==============================================================================
-- Script 65: Legacy-compatible facility visit frequency
-- ==============================================================================
BEGIN;

CREATE OR REPLACE VIEW public.facility_mission_visit_stats AS
SELECT
  f.id AS facility_id,
  COUNT(m.id) FILTER (
    WHERE COALESCE(m.status, '') NOT IN (
      'cancelled', 'rejected', 'draft', 'ملغاة', 'مرفوضة'
    )
  )::INTEGER AS assignment_count,
  COUNT(m.id) FILTER (
    WHERE
      m.checkin_time IS NOT NULL
      OR m.status IN (
        'completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'
      )
  )::INTEGER AS visit_count,
  COUNT(DISTINCT m.primary_inspector_id) FILTER (
    WHERE
      m.primary_inspector_id IS NOT NULL
      AND (
        m.checkin_time IS NOT NULL
        OR m.status IN (
          'completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'
        )
      )
  )::INTEGER AS distinct_primary_inspectors,
  MAX(
    COALESCE(
      m.checkout_time,
      m.completed_at,
      m.checkin_time,
      m.scheduled_date::timestamp with time zone
    )
  ) FILTER (
    WHERE
      m.checkin_time IS NOT NULL
      OR m.status IN (
        'completed', 'closed', 'done', 'منفذة', 'مكتملة', 'مغلقة'
      )
  ) AS last_visited_at,
  MAX(m.scheduled_date) FILTER (
    WHERE COALESCE(m.status, '') NOT IN (
      'cancelled', 'rejected', 'draft', 'ملغاة', 'مرفوضة'
    )
  ) AS last_scheduled_date
FROM public.facilities f
LEFT JOIN public.missions m
  ON COALESCE(m.target_facility_id, m.facility_id) = f.id
GROUP BY f.id;

REVOKE ALL ON public.facility_mission_visit_stats FROM anon, authenticated;
GRANT SELECT ON public.facility_mission_visit_stats TO service_role;

COMMIT;
