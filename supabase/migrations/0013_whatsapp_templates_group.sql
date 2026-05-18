-- Templates por status, grupo de pedidos na loja, log com recipient_kind

-- stores: grupo persiste ao recriar instância
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS whatsapp_orders_group_jid text,
  ADD COLUMN IF NOT EXISTS whatsapp_orders_group_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_orders_group_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS app_base_url text;

-- notify_settings substitui notify_statuses (boolean)
ALTER TABLE public.store_whatsapp_instances
  ADD COLUMN IF NOT EXISTS notify_settings jsonb;

UPDATE public.store_whatsapp_instances i
SET notify_settings = (
  SELECT jsonb_object_agg(
    key,
    jsonb_build_object(
      'enabled', COALESCE((i.notify_statuses ->> key)::boolean, false),
      'template', CASE key
        WHEN 'novo' THEN 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi registrado. Status: {{STATUS_PEDIDO}}.'
        WHEN 'em_analise' THEN 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está em análise. Status: {{STATUS_PEDIDO}}.'
        WHEN 'aprovado' THEN 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi aprovado. Status: {{STATUS_PEDIDO}}.'
        WHEN 'em_producao' THEN 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está em produção. Status: {{STATUS_PEDIDO}}.'
        WHEN 'pronto_entrega' THEN 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está pronto para entrega. Status: {{STATUS_PEDIDO}}.'
        WHEN 'entregue' THEN 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi entregue. Status: {{STATUS_PEDIDO}}.'
        WHEN 'cancelado' THEN 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi cancelado. Status: {{STATUS_PEDIDO}}.'
        ELSE 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} — {{STATUS_PEDIDO}}.'
      END
    )
  )
  FROM jsonb_object_keys(i.notify_statuses) AS key
)
WHERE notify_settings IS NULL AND notify_statuses IS NOT NULL;

ALTER TABLE public.store_whatsapp_instances
  ALTER COLUMN notify_settings SET DEFAULT '{
    "novo": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi registrado. Status: {{STATUS_PEDIDO}}."},
    "em_analise": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está em análise. Status: {{STATUS_PEDIDO}}."},
    "aprovado": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi aprovado. Status: {{STATUS_PEDIDO}}."},
    "em_producao": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está em produção. Status: {{STATUS_PEDIDO}}."},
    "pronto_entrega": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está pronto para entrega. Status: {{STATUS_PEDIDO}}."},
    "entregue": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi entregue. Status: {{STATUS_PEDIDO}}."},
    "cancelado": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi cancelado. Status: {{STATUS_PEDIDO}}."}
  }'::jsonb;

UPDATE public.store_whatsapp_instances
SET notify_settings = '{
    "novo": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi registrado. Status: {{STATUS_PEDIDO}}."},
    "em_analise": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está em análise. Status: {{STATUS_PEDIDO}}."},
    "aprovado": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi aprovado. Status: {{STATUS_PEDIDO}}."},
    "em_producao": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está em produção. Status: {{STATUS_PEDIDO}}."},
    "pronto_entrega": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está pronto para entrega. Status: {{STATUS_PEDIDO}}."},
    "entregue": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi entregue. Status: {{STATUS_PEDIDO}}."},
    "cancelado": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi cancelado. Status: {{STATUS_PEDIDO}}."}
  }'::jsonb
WHERE notify_settings IS NULL;

ALTER TABLE public.store_whatsapp_instances
  ALTER COLUMN notify_settings SET NOT NULL;

ALTER TABLE public.whatsapp_message_log
  ADD COLUMN IF NOT EXISTS recipient_kind text NOT NULL DEFAULT 'customer';

DROP VIEW IF EXISTS public.store_whatsapp_instances_safe;

ALTER TABLE public.store_whatsapp_instances
  DROP COLUMN IF EXISTS notify_statuses;
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
  notify_settings,
  connected_at,
  paused_at
FROM public.store_whatsapp_instances;

CREATE OR REPLACE FUNCTION public.get_store_whatsapp_instance_safe(p_store_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Sem permissão nesta loja';
  END IF;
  SELECT json_build_object(
    'id', i.id,
    'created_at', i.created_at,
    'updated_at', i.updated_at,
    'store_id', i.store_id,
    'instance_name', i.instance_name,
    'instance_id', i.instance_id,
    'status', i.status,
    'connection_state', i.connection_state,
    'profile_name', i.profile_name,
    'profile_picture_url', i.profile_picture_url,
    'owner_number', i.owner_number,
    'owner_jid', i.owner_jid,
    'notify_settings', i.notify_settings,
    'connected_at', i.connected_at,
    'paused_at', i.paused_at
  ) INTO result
  FROM public.store_whatsapp_instances i
  WHERE i.store_id = p_store_id;
  RETURN result;
END;
$$;
