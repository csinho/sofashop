-- ============================================================================
-- Agendamento diário do billing-cron (09:00 BRT = 12:00 UTC)
-- Usa pg_cron + pg_net + Vault para chamar a Edge Function com token interno.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Token interno (Vault + system_settings) — idempotente em re-runs
DO $$
DECLARE
  v_token text;
  v_project_url text := 'https://hacpynysbnetrsxaekxz.supabase.co';
BEGIN
  SELECT value->>'token' INTO v_token
  FROM public.system_settings
  WHERE key = 'billing_cron_internal';

  IF v_token IS NULL OR v_token = '' THEN
    v_token := encode(gen_random_bytes(32), 'hex');
    INSERT INTO public.system_settings (key, value)
    VALUES ('billing_cron_internal', jsonb_build_object('token', v_token));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'billing_cron_internal_token') THEN
    PERFORM vault.create_secret(
      v_token,
      'billing_cron_internal_token',
      'Token interno pg_cron → billing-cron'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'project_url') THEN
    PERFORM vault.create_secret(v_project_url, 'project_url', 'URL do projeto Supabase');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.invoke_sofashop_billing_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault, pg_catalog
AS $$
BEGIN
  PERFORM net.http_post(
    url := (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'project_url'
      LIMIT 1
    ) || '/functions/v1/billing-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'billing_cron_internal_token'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_sofashop_billing_cron() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_sofashop_billing_cron() TO postgres;

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'sofashop-billing-cron-daily';

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'sofashop-billing-cron-daily',
  '0 12 * * *',
  $$SELECT public.invoke_sofashop_billing_cron();$$
);
