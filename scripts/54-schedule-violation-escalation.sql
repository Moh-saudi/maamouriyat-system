-- ==============================================================================
-- Script 54: Schedule overdue violation escalation every hour
-- ==============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'violation-overdue-escalation'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'violation-overdue-escalation',
  '10 * * * *',
  'SELECT public.escalate_overdue_violations();'
);

COMMIT;
