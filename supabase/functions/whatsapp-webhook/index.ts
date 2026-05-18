import { jsonResponse, optionsResponse } from '../_shared/cors.ts'
import { evolutionRequest } from '../_shared/evolution.ts'
import { ensureStoreOrdersGroup } from '../_shared/ordersGroup.ts'
import { getServiceClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const url = new URL(req.url)
    const storeId = url.searchParams.get('storeId')
    if (!storeId) {
      return jsonResponse({ error: 'storeId obrigatório' }, 400)
    }

    const payload = await req.json() as {
      event?: string
      instance?: string
      data?: { state?: string; status?: string }
    }

    const event = payload.event ?? ''
    if (!['CONNECTION_UPDATE', 'QRCODE_UPDATED'].includes(event)) {
      return jsonResponse({ ok: true, ignored: true })
    }

    const sb = getServiceClient()
    const { data: row } = await sb
      .from('store_whatsapp_instances')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle()

    if (!row) return jsonResponse({ ok: true, missing: true })

    if (event === 'CONNECTION_UPDATE') {
      const state =
        payload.data?.state ??
        payload.data?.status ??
        (payload as { state?: string }).state

      if (state === 'open') {
        if (row.status !== 'paused') {
          await sb
            .from('store_whatsapp_instances')
            .update({
              status: 'connected',
              connection_state: 'open',
              connected_at: row.connected_at ?? new Date().toISOString(),
            })
            .eq('id', row.id)

          await evolutionRequest(
            `/instance/fetchInstances?instanceName=${encodeURIComponent(row.instance_name)}`,
            { apiKey: row.instance_token },
          ).then(async ({ data }) => {
            if (!data || !Array.isArray(data)) return
            const inst = data[0]?.instance ?? data[0]
            if (!inst) return
            const ownerJid = (inst.owner as string) ?? ''
            await sb
              .from('store_whatsapp_instances')
              .update({
                profile_name: inst.profileName ?? null,
                profile_picture_url: inst.profilePictureUrl ?? null,
                owner_jid: ownerJid || null,
                owner_number: ownerJid.replace(/@.*/, '').replace(/\D/g, '') || null,
                instance_id: inst.instanceId ?? row.instance_id,
              })
              .eq('id', row.id)
          })

          await ensureStoreOrdersGroup(storeId, {
            instance_name: row.instance_name,
            instance_token: row.instance_token,
            owner_number: row.owner_number,
          }).catch(() => {
            /* não bloqueia webhook */
          })
        }
      } else if (state === 'close' && row.status !== 'paused') {
        await sb
          .from('store_whatsapp_instances')
          .update({ status: 'disconnected', connection_state: 'close' })
          .eq('id', row.id)
      }
    }

    return jsonResponse({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return jsonResponse({ error: msg }, 500)
  }
})
