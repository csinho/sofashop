-- Corrige isolamento: view sem RLS expunha todas as lojas. Leitura segura via RPC.

REVOKE SELECT ON public.store_whatsapp_instances_safe FROM authenticated;

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
    'notify_statuses', i.notify_statuses,
    'connected_at', i.connected_at,
    'paused_at', i.paused_at
  ) INTO result
  FROM public.store_whatsapp_instances i
  WHERE i.store_id = p_store_id;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_whatsapp_instance_safe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_whatsapp_instance_safe(uuid) TO authenticated;
