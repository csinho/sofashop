import { evolutionRequest } from './evolution.ts'
import { publicStoreAssetUrl } from './storeAssets.ts'
import { phoneToEvolutionNumber } from './templates.ts'
import { getServiceClient } from './supabase.ts'

const GROUP_DESCRIPTION =
  'Grupo automático do SofáShop. Aqui você recebe o resumo de cada novo pedido do catálogo. Use o link da mensagem para abrir o pedido no painel — não é necessário responder neste grupo.'

type InstanceRow = {
  instance_name: string
  instance_token: string
  owner_number: string | null
}

type StoreRow = {
  id: string
  trade_name: string
  banner_url: string | null
  logo_url: string | null
  whatsapp_orders_group_jid: string | null
  whatsapp_orders_group_id: string | null
  whatsapp_orders_phone: string
}

function extractGroupJid(data: unknown): { jid: string | null; id: string | null } {
  if (!data || typeof data !== 'object') return { jid: null, id: null }
  const o = data as Record<string, unknown>
  const nested = o.group as Record<string, unknown> | undefined
  const jid =
    String(o.id ?? o.groupJid ?? o.jid ?? nested?.id ?? nested?.groupJid ?? '').trim() || null
  const id = String(o.groupId ?? o.id ?? nested?.groupId ?? '').trim() || null
  if (jid && jid.includes('@')) return { jid, id }
  if (jid) return { jid: `${jid}@g.us`, id }
  return { jid: null, id }
}

export async function ensureStoreOrdersGroup(
  storeId: string,
  instance: InstanceRow,
): Promise<{ ok: boolean; groupJid?: string; error?: string }> {
  const sb = getServiceClient()
  const { data: store, error: storeErr } = await sb
    .from('stores')
    .select(
      'id, trade_name, banner_url, logo_url, whatsapp_orders_group_jid, whatsapp_orders_group_id, whatsapp_orders_phone',
    )
    .eq('id', storeId)
    .single()

  if (storeErr || !store) return { ok: false, error: 'Loja não encontrada' }
  const s = store as StoreRow
  const subject = `Pedidos da loja ${s.trade_name}`

  let groupJid = s.whatsapp_orders_group_jid

  if (!groupJid) {
    const participant =
      instance.owner_number?.replace(/\D/g, '') ||
      phoneToEvolutionNumber(s.whatsapp_orders_phone.replace(/\D/g, ''))
    if (!participant || participant.length < 10) {
      return { ok: false, error: 'Número da loja indisponível para criar grupo' }
    }

    const { ok, data } = await evolutionRequest(
      `/group/create/${encodeURIComponent(instance.instance_name)}`,
      {
        method: 'POST',
        apiKey: instance.instance_token,
        body: JSON.stringify({
          subject,
          description: GROUP_DESCRIPTION,
          participants: [participant],
        }),
      },
    )

    if (!ok) {
      console.error('group create failed', data)
      return { ok: false, error: 'Falha ao criar grupo na Evolution API' }
    }

    const parsed = extractGroupJid(data)
    groupJid = parsed.jid
    if (!groupJid) {
      console.error('group jid missing', data)
      return { ok: false, error: 'Evolution não retornou ID do grupo' }
    }

    await sb
      .from('stores')
      .update({
        whatsapp_orders_group_jid: groupJid,
        whatsapp_orders_group_id: parsed.id,
        whatsapp_orders_group_created_at: new Date().toISOString(),
      })
      .eq('id', storeId)
  }

  await evolutionRequest(
    `/group/updateGroupSubject/${encodeURIComponent(instance.instance_name)}?groupJid=${encodeURIComponent(groupJid)}`,
    {
      method: 'POST',
      apiKey: instance.instance_token,
      body: JSON.stringify({ subject }),
    },
  )

  await evolutionRequest(
    `/group/updateGroupDescription/${encodeURIComponent(instance.instance_name)}?groupJid=${encodeURIComponent(groupJid)}`,
    {
      method: 'POST',
      apiKey: instance.instance_token,
      body: JSON.stringify({ description: GROUP_DESCRIPTION }),
    },
  )

  const imageUrl = publicStoreAssetUrl(s.banner_url) ?? publicStoreAssetUrl(s.logo_url)
  if (imageUrl) {
    await evolutionRequest(
      `/group/updateGroupPicture/${encodeURIComponent(instance.instance_name)}?groupJid=${encodeURIComponent(groupJid)}`,
      {
        method: 'POST',
        apiKey: instance.instance_token,
        body: JSON.stringify({ image: imageUrl }),
      },
    )
  }

  return { ok: true, groupJid }
}
