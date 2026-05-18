-- ============================================================================
-- WhatsApp (Evolution API) — instância por loja + log de mensagens
-- Depende de: 0001–0009
-- Leitura segura no app: RPC get_store_whatsapp_instance_safe (0011)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.whatsapp_instance_status AS ENUM (
    'disconnected',
    'connecting',
    'connected',
    'paused'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.whatsapp_message_delivery_status AS ENUM (
    'sent',
    'failed',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.store_whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores (id) ON DELETE CASCADE,
  instance_name text NOT NULL UNIQUE,
  instance_id text,
  instance_token text NOT NULL,
  status public.whatsapp_instance_status NOT NULL DEFAULT 'disconnected',
  connection_state text,
  profile_name text,
  profile_picture_url text,
  owner_number text,
  owner_jid text,
  notify_statuses jsonb NOT NULL DEFAULT '{
    "novo": false,
    "em_analise": false,
    "aprovado": false,
    "em_producao": false,
    "pronto_entrega": false,
    "entregue": false,
    "cancelado": false
  }'::jsonb,
  connected_at timestamptz,
  paused_at timestamptz
);

CREATE INDEX IF NOT EXISTS store_whatsapp_instances_store_id_idx ON public.store_whatsapp_instances (store_id);

DROP TRIGGER IF EXISTS trg_store_whatsapp_instances_updated ON public.store_whatsapp_instances;
CREATE TRIGGER trg_store_whatsapp_instances_updated
BEFORE UPDATE ON public.store_whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  customer_phone text NOT NULL,
  order_status public.order_status,
  message_text text NOT NULL,
  evolution_message_id text,
  delivery_status public.whatsapp_message_delivery_status NOT NULL,
  error_message text
);

CREATE INDEX IF NOT EXISTS whatsapp_message_log_store_id_idx ON public.whatsapp_message_log (store_id);
CREATE INDEX IF NOT EXISTS whatsapp_message_log_order_id_idx ON public.whatsapp_message_log (order_id);

DROP VIEW IF EXISTS public.store_whatsapp_instances_safe;
CREATE VIEW public.store_whatsapp_instances_safe AS
SELECT
  id,
  created_at,
  updated_at,
  store_id,
  instance_name,
  instance_id,
  status,
  connection_state,
  profile_name,
  profile_picture_url,
  owner_number,
  owner_jid,
  notify_statuses,
  connected_at,
  paused_at
FROM public.store_whatsapp_instances;

ALTER TABLE public.store_whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.store_whatsapp_instances FROM anon, authenticated;

REVOKE ALL ON public.whatsapp_message_log FROM anon;
GRANT SELECT ON public.whatsapp_message_log TO authenticated;

DROP POLICY IF EXISTS whatsapp_message_log_member_read ON public.whatsapp_message_log;
CREATE POLICY whatsapp_message_log_member_read
ON public.whatsapp_message_log
FOR SELECT
TO authenticated
USING (public.is_store_member(store_id));
