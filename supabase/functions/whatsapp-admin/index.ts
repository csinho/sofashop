import { corsHeaders, jsonResponse, optionsResponse } from '../_shared/cors.ts'
import { evolutionRequest, instanceNameForStore, webhookUrlForStore } from '../_shared/evolution.ts'
import {
  extractCreateInstanceId,
  extractCreateToken,
  mapConnectionStatePayload,
  normalizeFetchedInstance,
  parseConnectResponse,
  profilePatchFromEvolution,
} from '../_shared/evolutionParse.ts'
import { ensureStoreOrdersGroup } from '../_shared/ordersGroup.ts'
import { defaultNotifySettingsRecord, type NotifySettingItem } from '../_shared/messageTemplate.ts'
import { phoneToEvolutionNumber } from '../_shared/templates.ts'
import { handlePlatformWhatsAppAdmin } from '../_shared/platformWhatsAppAdminHandler.ts'
import { getServiceClient, isErrorResponse, requireStoreMember } from '../_shared/supabase.ts'

type InstanceRow = {
  id: string
  store_id: string
  instance_name: string
  instance_id: string | null
  instance_token: string
  status: string
  connection_state: string | null
  profile_name: string | null
  profile_picture_url: string | null
  owner_number: string | null
  owner_jid: string | null
  notify_settings: Record<string, NotifySettingItem>
  connected_at: string | null
  paused_at: string | null
}

async function getInstance(sb: ReturnType<typeof getServiceClient>, storeId: string) {
  const { data } = await sb
    .from('store_whatsapp_instances')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle()
  return data as InstanceRow | null
}

async function syncProfileFromEvolution(sb: ReturnType<typeof getServiceClient>, row: InstanceRow) {
  const { data } = await evolutionRequest(
    `/instance/fetchInstances?instanceName=${encodeURIComponent(row.instance_name)}`,
    { apiKey: row.instance_token },
  )
  const inst = normalizeFetchedInstance(data)
  if (!inst) return row

  const patch = profilePatchFromEvolution(inst, row)
  await sb.from('store_whatsapp_instances').update(patch).eq('id', row.id)
  return { ...row, ...patch }
}

async function linkExistingEvolutionInstance(
  sb: ReturnType<typeof getServiceClient>,
  storeId: string,
  instanceName: string,
) {
  const { data } = await evolutionRequest(
    `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
  )
  const inst = normalizeFetchedInstance(data)
  if (!inst) return null

  const token = String(inst.token ?? '')
  if (!token) return null

  const conn = String(inst.connectionStatus ?? 'close')
  const status =
    conn === 'open' ? 'connected' : conn === 'connecting' ? 'connecting' : 'disconnected'

  const { data: inserted, error } = await sb
    .from('store_whatsapp_instances')
    .insert({
      store_id: storeId,
      instance_name: instanceName,
      instance_id: String(inst.id ?? inst.instanceId ?? '') || null,
      instance_token: token,
      status,
      connection_state: conn === 'open' ? 'open' : 'close',
      notify_settings: defaultNotifySettingsRecord(),
    })
    .select('id, store_id, instance_name, status, connection_state')
    .single()

  if (error) return null
  return inserted
}

async function getStoreOrdersPhone(sb: ReturnType<typeof getServiceClient>, storeId: string) {
  const { data } = await sb.from('stores').select('whatsapp_orders_phone').eq('id', storeId).single()
  const digits = String(data?.whatsapp_orders_phone ?? '').replace(/\D/g, '')
  if (digits.length < 10) return null
  return phoneToEvolutionNumber(digits)
}

async function checkNumberOnWhatsApp(
  instanceName: string,
  apiKey: string,
  number: string,
) {
  const { ok, data } = await evolutionRequest(
    `/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`,
    {
      method: 'POST',
      apiKey,
      body: JSON.stringify({ numbers: [number] }),
    },
  )
  if (!ok) {
    return { ok: false as const, exists: false, error: 'evolution_error' as const, details: data }
  }
  const results = data as { exists?: boolean; jid?: string; number?: string }[]
  const first = Array.isArray(results) ? results[0] : null
  return {
    ok: true as const,
    exists: Boolean(first?.exists),
    jid: first?.jid ?? null,
    number: first?.number ?? number,
  }
}

async function connectWithPhone(row: InstanceRow, phone: string) {
  const path =
    `/instance/connect/${encodeURIComponent(row.instance_name)}?number=${encodeURIComponent(phone)}`
  const { ok, data } = await evolutionRequest(path, { apiKey: row.instance_token })
  if (!ok) return { ok: false as const, data }
  return { ok: true as const, ...parseConnectResponse(data) }
}

async function applyConnectionState(sb: ReturnType<typeof getServiceClient>, row: InstanceRow) {
  const { data } = await evolutionRequest(
    `/instance/connectionState/${encodeURIComponent(row.instance_name)}`,
    { apiKey: row.instance_token },
  )

  const state = mapConnectionStatePayload(data)

  if (!state) return { state: null, row }

  let status = row.status
  const updates: Record<string, unknown> = { connection_state: state }

  if (state === 'open') {
    status = row.status === 'paused' ? 'paused' : 'connected'
    updates.status = status
    if (status === 'connected') {
      updates.connected_at = row.connected_at ?? new Date().toISOString()
    }
  } else if (state === 'connecting') {
    updates.status = row.status === 'paused' ? 'paused' : 'connecting'
    status = updates.status as string
  } else if (state === 'close' && row.status !== 'paused') {
    updates.status = 'disconnected'
    status = 'disconnected'
  }

  await sb.from('store_whatsapp_instances').update(updates).eq('id', row.id)
  const updated = { ...row, ...updates, status: updates.status as string ?? status }
  if (state === 'open' && updated.status === 'connected') {
    const synced = await syncProfileFromEvolution(sb, updated as InstanceRow)
    await ensureStoreOrdersGroup(row.store_id, synced).catch(() => {
      /* grupo opcional; não bloqueia conexão */
    })
    return { state, row: synced }
  }
  return { state, row: updated as InstanceRow }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = await req.json() as {
      scope?: string
      action?: string
      storeId?: string
      connectPhone?: string
      notifyStatuses?: Record<string, boolean>
      notifySettings?: Record<string, NotifySettingItem>
      appBaseUrl?: string
    }

    if (body.scope === 'platform') {
      return handlePlatformWhatsAppAdmin(req, body)
    }

    const { action, storeId, notifyStatuses, notifySettings, appBaseUrl } = body

    if (!action || !storeId) {
      return jsonResponse({ error: 'action e storeId são obrigatórios' }, 400)
    }

    const auth = await requireStoreMember(req, storeId)
    if (isErrorResponse(auth)) {
      return new Response(await auth.text(), { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const sb = getServiceClient()
    let row = await getInstance(sb, storeId)

    switch (action) {
      case 'verifyOrdersPhone': {
        const phone = await getStoreOrdersPhone(sb, storeId)
        if (!phone) {
          return jsonResponse({
            error: 'Cadastre o WhatsApp principal para pedidos (aba Contato) antes de conectar.',
            missingPhone: true,
          }, 400)
        }
        if (!row) {
          return jsonResponse({ phone, exists: null, needsInstance: true })
        }
        const check = await checkNumberOnWhatsApp(row.instance_name, row.instance_token, phone)
        if (!check.ok) {
          return jsonResponse({ error: 'Não foi possível verificar o número na Evolution API', details: check.details }, 502)
        }
        return jsonResponse({
          phone,
          exists: check.exists,
          jid: check.jid,
          number: check.number,
        })
      }

      case 'create': {
        if (row) {
          return jsonResponse({ error: 'Esta loja já possui uma instância WhatsApp' }, 409)
        }
        const phone = await getStoreOrdersPhone(sb, storeId)
        if (!phone) {
          return jsonResponse({
            error: 'Cadastre o WhatsApp principal para pedidos (aba Contato) antes de conectar.',
            missingPhone: true,
          }, 400)
        }
        const name = instanceNameForStore(storeId)
        const webhookUrl = webhookUrlForStore(storeId)
        const { ok, status, data } = await evolutionRequest('/instance/create', {
          method: 'POST',
          body: JSON.stringify({
            instanceName: name,
            number: phone,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: false,
            syncFullHistory: false,
            groupsIgnore: false,
            readMessages: false,
            readStatus: false,
            alwaysOnline: false,
            webhook: {
              url: webhookUrl,
              byEvents: true,
              base64: false,
              events: ['CONNECTION_UPDATE', 'QRCODE_UPDATED'],
            },
          }),
        })

        let token = ok ? extractCreateToken(data) : null
        let instanceId = ok ? extractCreateInstanceId(data) : null

        if (!ok && status === 403) {
          const linked = await linkExistingEvolutionInstance(sb, storeId, name)
          if (linked) return jsonResponse({ instance: linked, recovered: true })
        }

        if (!ok) {
          const envMsg = (data as { error?: string; response?: { message?: string[] } })?.error
          const msgList = (data as { response?: { message?: string[] } })?.response?.message
          const detailMsg = Array.isArray(msgList) ? msgList.join(', ') : undefined
          return jsonResponse(
            {
              error: envMsg ?? detailMsg ?? 'Falha ao criar instância na Evolution API',
              details: data,
            },
            502,
          )
        }

        if (!token) {
          return jsonResponse({ error: 'Evolution API não retornou token da instância', details: data }, 502)
        }

        const { data: inserted, error } = await sb
          .from('store_whatsapp_instances')
          .insert({
            store_id: storeId,
            instance_name: name,
            instance_id: instanceId,
            instance_token: token,
            status: 'connecting',
            connection_state: 'close',
            notify_settings: defaultNotifySettingsRecord(),
          })
          .select('id, store_id, instance_name, status, connection_state')
          .single()

        if (error) return jsonResponse({ error: error.message }, 500)
        return jsonResponse({ instance: inserted })
      }

      case 'connect': {
        if (!row) return jsonResponse({ error: 'Instância não encontrada' }, 404)
        const phone = await getStoreOrdersPhone(sb, storeId)
        if (!phone) {
          return jsonResponse({
            error: 'Cadastre o WhatsApp principal para pedidos (aba Contato) antes de conectar.',
            missingPhone: true,
          }, 400)
        }
        const check = await checkNumberOnWhatsApp(row.instance_name, row.instance_token, phone)
        if (!check.ok) {
          return jsonResponse({ error: 'Não foi possível verificar o número', details: check.details }, 502)
        }
        if (!check.exists) {
          return jsonResponse({
            error: 'Este número não possui conta WhatsApp ativa. Confira o WhatsApp principal para pedidos na aba Contato.',
            phone,
            exists: false,
          }, 400)
        }

        const connected = await connectWithPhone(row, phone)
        if (!connected.ok) {
          return jsonResponse({ error: 'Falha ao obter QR/código', details: connected.data }, 502)
        }

        await sb
          .from('store_whatsapp_instances')
          .update({ status: 'connecting', owner_number: phone })
          .eq('id', row.id)

        return jsonResponse({
          pairingCode: connected.pairingCode,
          qrBase64: connected.qrBase64,
          qrPayload: connected.qrPayload,
          phone,
          count: connected.count,
        })
      }

      case 'connectionState': {
        if (!row) return jsonResponse({ error: 'Instância não encontrada' }, 404)
        const { state, row: updated } = await applyConnectionState(sb, row)
        return jsonResponse({
          state,
          status: updated.status,
          connection_state: updated.connection_state,
          profile_name: updated.profile_name,
          profile_picture_url: updated.profile_picture_url,
          owner_number: updated.owner_number,
        })
      }

      case 'syncProfile': {
        if (!row) return jsonResponse({ error: 'Instância não encontrada' }, 404)
        row = await syncProfileFromEvolution(sb, row)
        if (row.status === 'connected') {
          const groupResult = await ensureStoreOrdersGroup(storeId, row)
          return jsonResponse({ instance: sanitize(row), ordersGroup: groupResult })
        }
        return jsonResponse({ instance: sanitize(row) })
      }

      case 'pause': {
        if (!row) return jsonResponse({ error: 'Instância não encontrada' }, 404)
        await evolutionRequest(
          `/instance/logout/${encodeURIComponent(row.instance_name)}`,
          { method: 'DELETE', apiKey: row.instance_token },
        )
        await sb
          .from('store_whatsapp_instances')
          .update({
            status: 'paused',
            paused_at: new Date().toISOString(),
            connection_state: 'close',
          })
          .eq('id', row.id)
        return jsonResponse({ ok: true, status: 'paused' })
      }

      case 'resume': {
        if (!row) return jsonResponse({ error: 'Instância não encontrada' }, 404)
        const phone = await getStoreOrdersPhone(sb, storeId)
        if (!phone) {
          return jsonResponse({
            error: 'Cadastre o WhatsApp principal para pedidos (aba Contato) antes de conectar.',
            missingPhone: true,
          }, 400)
        }
        await sb
          .from('store_whatsapp_instances')
          .update({ status: 'connecting', paused_at: null })
          .eq('id', row.id)
        const connected = await connectWithPhone(row, phone)
        if (!connected.ok) {
          return jsonResponse({ error: 'Falha ao retomar conexão', details: connected.data }, 502)
        }
        return jsonResponse({
          pairingCode: connected.pairingCode,
          qrBase64: connected.qrBase64,
          qrPayload: connected.qrPayload,
          phone,
        })
      }

      case 'delete': {
        if (!row) return jsonResponse({ error: 'Instância não encontrada' }, 404)
        await evolutionRequest(
          `/instance/delete/${encodeURIComponent(row.instance_name)}`,
          { method: 'DELETE', apiKey: row.instance_token },
        )
        await sb.from('store_whatsapp_instances').delete().eq('id', row.id)
        return jsonResponse({ ok: true })
      }

      case 'revealToken': {
        if (!row) return jsonResponse({ error: 'Instância não encontrada' }, 404)
        return jsonResponse({ token: row.instance_token })
      }

      case 'updateNotifySettings':
      case 'updateNotifyStatuses': {
        if (!row) return jsonResponse({ error: 'Instância não encontrada' }, 404)
        let settings = notifySettings
        if (!settings && notifyStatuses && typeof notifyStatuses === 'object') {
          const current = (row.notify_settings ?? {}) as Record<string, NotifySettingItem>
          settings = Object.fromEntries(
            Object.entries(notifyStatuses).map(([k, enabled]) => [
              k,
              {
                enabled: Boolean(enabled),
                template: current[k]?.template ?? '',
              },
            ]),
          )
        }
        if (!settings || typeof settings !== 'object') {
          return jsonResponse({ error: 'notifySettings inválido' }, 400)
        }
        const { error } = await sb
          .from('store_whatsapp_instances')
          .update({ notify_settings: settings })
          .eq('id', row.id)
        if (error) return jsonResponse({ error: error.message }, 500)
        if (appBaseUrl && typeof appBaseUrl === 'string' && appBaseUrl.startsWith('http')) {
          await sb.from('stores').update({ app_base_url: appBaseUrl.replace(/\/$/, '') }).eq('id', storeId)
        }
        return jsonResponse({ ok: true, notify_settings: settings })
      }

      default:
        return jsonResponse({ error: 'Ação desconhecida' }, 400)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return jsonResponse({ error: msg }, 500)
  }
})

function sanitize(row: InstanceRow) {
  return {
    id: row.id,
    store_id: row.store_id,
    instance_name: row.instance_name,
    instance_id: row.instance_id,
    status: row.status,
    connection_state: row.connection_state,
    profile_name: row.profile_name,
    profile_picture_url: row.profile_picture_url,
    owner_number: row.owner_number,
    owner_jid: row.owner_jid,
    notify_settings: row.notify_settings,
    connected_at: row.connected_at,
    paused_at: row.paused_at,
  }
}
