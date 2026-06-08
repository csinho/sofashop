import { jsonResponse, optionsResponse } from '../_shared/cors.ts'
import { evolutionRequest } from '../_shared/evolution.ts'
import { ensureStoreOrdersGroup } from '../_shared/ordersGroup.ts'
import { getServiceClient } from '../_shared/supabase.ts'

const PLATFORM_KEY = 'platform'

async function handlePlatformWebhook(
  sb: ReturnType<typeof getServiceClient>,
  event: string,
  payload: { data?: { state?: string; status?: string }; state?: string },
) {
  const { data: row } = await sb
    .from('platform_whatsapp_instance')
    .select('*')
    .eq('singleton_key', PLATFORM_KEY)
    .maybeSingle()

  if (!row) return jsonResponse({ ok: true, missing: true })

  if (event === 'CONNECTION_UPDATE') {
    const state =
      payload.data?.state ??
      payload.data?.status ??
      payload.state

    if (state === 'open') {
      if (row.status !== 'paused') {
        await sb
          .from('platform_whatsapp_instance')
          .update({
            status: 'connected',
            connection_state: 'open',
            connected_at: row.connected_at ?? new Date().toISOString(),
          })
          .eq('singleton_key', PLATFORM_KEY)

        await evolutionRequest(
          `/instance/fetchInstances?instanceName=${encodeURIComponent(row.instance_name)}`,
          { apiKey: row.instance_token },
        ).then(async ({ data }) => {
          if (!data || !Array.isArray(data)) return
          const inst = data[0]?.instance ?? data[0]
          if (!inst) return
          const ownerJid = (inst.owner as string) ?? ''
          await sb
            .from('platform_whatsapp_instance')
            .update({
              profile_name: inst.profileName ?? null,
              profile_picture_url: inst.profilePictureUrl ?? null,
              owner_jid: ownerJid || null,
              owner_number: ownerJid.replace(/@.*/, '').replace(/\D/g, '') || null,
              instance_id: inst.instanceId ?? row.instance_id,
            })
            .eq('singleton_key', PLATFORM_KEY)
        })
      }
    } else if (state === 'close' && row.status !== 'paused') {
      await sb
        .from('platform_whatsapp_instance')
        .update({ status: 'disconnected', connection_state: 'close' })
        .eq('singleton_key', PLATFORM_KEY)
    }
  }

  return jsonResponse({ ok: true })
}

async function handleStoreWebhook(
  sb: ReturnType<typeof getServiceClient>,
  storeId: string,
  event: string,
  payload: { data?: { state?: string; status?: string }; state?: string },
) {
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
      payload.state

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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const url = new URL(req.url)
    const storeId = url.searchParams.get('storeId')
    const scope = url.searchParams.get('scope')

    if (!storeId && scope !== 'platform') {
      return jsonResponse({ error: 'storeId ou scope=platform obrigatório' }, 400)
    }

    const payload = await req.json() as {
      event?: string
      instance?: string
      data?: { state?: string; status?: string }
      state?: string
    }

    const event = payload.event ?? ''
    if (!['CONNECTION_UPDATE', 'QRCODE_UPDATED'].includes(event)) {
      return jsonResponse({ ok: true, ignored: true })
    }

    const sb = getServiceClient()

    if (scope === 'platform') {
      return await handlePlatformWebhook(sb, event, payload)
    }

    return await handleStoreWebhook(sb, storeId!, event, payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return jsonResponse({ error: msg }, 500)
  }
})
