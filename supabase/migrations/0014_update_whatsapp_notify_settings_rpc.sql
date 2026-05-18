-- Salvar notify_settings + app_base_url sem depender da Edge whatsapp-admin

CREATE OR REPLACE FUNCTION public.update_store_whatsapp_notify_settings(
  p_store_id uuid,
  p_settings jsonb,
  p_app_base_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Sem permissão nesta loja';
  END IF;

  UPDATE public.store_whatsapp_instances
  SET notify_settings = p_settings
  WHERE store_id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instância WhatsApp não encontrada';
  END IF;

  IF p_app_base_url IS NOT NULL AND trim(p_app_base_url) <> '' THEN
    UPDATE public.stores
    SET app_base_url = rtrim(trim(p_app_base_url), '/')
    WHERE id = p_store_id;
  END IF;

  RETURN json_build_object('ok', true, 'notify_settings', p_settings);
END;
$$;

REVOKE ALL ON FUNCTION public.update_store_whatsapp_notify_settings(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_store_whatsapp_notify_settings(uuid, jsonb, text) TO authenticated;
