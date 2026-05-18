-- Preenche notify_settings quando INSERT vier com NULL (Edge antiga ou cliente explícito)

CREATE OR REPLACE FUNCTION public.trg_store_whatsapp_instances_notify_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.notify_settings IS NULL THEN
    NEW.notify_settings := '{
      "novo": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi registrado. Status: {{STATUS_PEDIDO}}."},
      "em_analise": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está em análise. Status: {{STATUS_PEDIDO}}."},
      "aprovado": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi aprovado. Status: {{STATUS_PEDIDO}}."},
      "em_producao": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está em produção. Status: {{STATUS_PEDIDO}}."},
      "pronto_entrega": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está pronto para entrega. Status: {{STATUS_PEDIDO}}."},
      "entregue": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi entregue. Status: {{STATUS_PEDIDO}}."},
      "cancelado": {"enabled": false, "template": "Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi cancelado. Status: {{STATUS_PEDIDO}}."}
    }'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_whatsapp_instances_notify_defaults ON public.store_whatsapp_instances;
CREATE TRIGGER store_whatsapp_instances_notify_defaults
  BEFORE INSERT ON public.store_whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_store_whatsapp_instances_notify_defaults();
