-- ============================================================================
-- WhatsApp da plataforma (admin) — instância singleton + log de mensagens
-- Depende de: 0009 (is_platform_admin), 0010 (enums whatsapp)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_whatsapp_instance (
  singleton_key text PRIMARY KEY DEFAULT 'platform' CHECK (singleton_key = 'platform'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  instance_name text NOT NULL UNIQUE,
  instance_id text,
  instance_token text NOT NULL,
  status public.whatsapp_instance_status NOT NULL DEFAULT 'disconnected',
  connection_state text,
  profile_name text,
  profile_picture_url text,
  owner_number text,
  owner_jid text,
  connect_phone text,
  notify_settings jsonb NOT NULL DEFAULT '{
    "store_registered": {"enabled": false, "template": "Olá! Sua loja {{NOME_LOJA}} foi cadastrada no SofáShop. Em breve você receberá informações sobre o plano."},
    "payment_due_5d": {"enabled": false, "template": "Olá! Faltam 5 dias para o vencimento do plano da loja {{NOME_LOJA}}. Efetue o pagamento via PIX para manter o acesso."},
    "payment_due_3d": {"enabled": false, "template": "Olá! Faltam 3 dias para o vencimento do plano da loja {{NOME_LOJA}}. Efetue o pagamento via PIX para evitar a pausa da loja."},
    "payment_confirmed": {"enabled": false, "template": "Pagamento confirmado! O plano da loja {{NOME_LOJA}} está em dia. Obrigado!"}
  }'::jsonb,
  connected_at timestamptz,
  paused_at timestamptz
);

DROP TRIGGER IF EXISTS trg_platform_whatsapp_instance_updated ON public.platform_whatsapp_instance;
CREATE TRIGGER trg_platform_whatsapp_instance_updated
BEFORE UPDATE ON public.platform_whatsapp_instance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.platform_whatsapp_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid REFERENCES public.stores (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  recipient_phone text NOT NULL,
  message_text text NOT NULL,
  evolution_message_id text,
  delivery_status public.whatsapp_message_delivery_status NOT NULL,
  error_message text
);

CREATE INDEX IF NOT EXISTS platform_whatsapp_message_log_store_id_idx
  ON public.platform_whatsapp_message_log (store_id);
CREATE INDEX IF NOT EXISTS platform_whatsapp_message_log_event_type_idx
  ON public.platform_whatsapp_message_log (event_type);

ALTER TABLE public.platform_whatsapp_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_whatsapp_message_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_whatsapp_instance FROM anon, authenticated;
REVOKE ALL ON public.platform_whatsapp_message_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_whatsapp_instance_safe()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'singleton_key', i.singleton_key,
    'created_at', i.created_at,
    'updated_at', i.updated_at,
    'instance_name', i.instance_name,
    'instance_id', i.instance_id,
    'status', i.status,
    'connection_state', i.connection_state,
    'profile_name', i.profile_name,
    'profile_picture_url', i.profile_picture_url,
    'owner_number', i.owner_number,
    'owner_jid', i.owner_jid,
    'connect_phone', i.connect_phone,
    'notify_settings', i.notify_settings,
    'connected_at', i.connected_at,
    'paused_at', i.paused_at
  ) INTO result
  FROM public.platform_whatsapp_instance i
  WHERE i.singleton_key = 'platform';

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_whatsapp_instance_safe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_whatsapp_instance_safe() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_platform_whatsapp_notify_settings(p_settings jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.platform_whatsapp_instance
  SET notify_settings = p_settings
  WHERE singleton_key = 'platform';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instância WhatsApp da plataforma não encontrada';
  END IF;

  RETURN json_build_object('ok', true, 'notify_settings', p_settings);
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_whatsapp_notify_settings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_platform_whatsapp_notify_settings(jsonb) TO authenticated;
