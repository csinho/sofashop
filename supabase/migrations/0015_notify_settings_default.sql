-- Garante DEFAULT em notify_settings quando a Edge não envia o campo no INSERT

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
