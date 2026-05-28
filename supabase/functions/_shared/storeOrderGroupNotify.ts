import { evolutionRequest } from './evolution.ts'
import { resolveStatusTemplate, type NotifySettingItem } from './messageTemplate.ts'
import { appPublicBaseUrl, buildOrderAdminUrl } from './storeAssets.ts'
import { getServiceClient } from './supabase.ts'

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  em_producao: 'Em produção',
  pronto_entrega: 'Pronto para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const PAYMENT_LABEL: Record<string, string> = {
  pix: 'Pix',
  cartao_debito: 'Cartão débito',
  cartao_credito: 'Cartão crédito',
  parcelado: 'Parcelado',
  entrada_parcelado: 'Entrada + parcelado',
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function paymentHuman(kind: string, details: Record<string, unknown>) {
  const base = PAYMENT_LABEL[kind] ?? kind
  if (kind === 'cartao_credito' && details.installments) {
    const inst = details.installments
    const fee = details.fee_amount as number | undefined
    if (fee != null && fee > 0) return `${base} (${inst}x, taxa ${formatBRL(fee)})`
    return `${base} (${inst}x)`
  }
  if (kind === 'parcelado' && details.installments) return `${base} (${details.installments}x)`
  if (kind === 'entrada_parcelado') {
    const down = details.down_payment as number | undefined
    const inst = details.installments as number | undefined
    return `${base} — entrada ${down != null ? formatBRL(down) : '-'} + ${inst ?? '-'}x`
  }
  return base
}

function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, '')
  const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return digits
}

type OrderItem = {
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  line_total: number
  options_snapshot: Record<string, unknown> | null
}

export function buildStoreGroupOrderMessage(opts: {
  orderNumber: string
  customerName: string
  customerPhone: string
  customerPhoneSecondary?: string
  addressLines: string[]
  items: OrderItem[]
  paymentKind: string
  paymentDetails: Record<string, unknown>
  total: number
  notes: string
}): string {
  const header = `✨ *Novo pedido — ${opts.orderNumber}*`
  const cust = [
    `👤 *Cliente:* ${opts.customerName}`,
    `📞 *Telefone:* ${formatPhone(opts.customerPhone)}`,
    ...(opts.customerPhoneSecondary?.trim()
      ? [`📞 *Telefone 2:* ${formatPhone(opts.customerPhoneSecondary)}`]
      : []),
    `📍 *Endereço:*`,
    ...opts.addressLines.map((l) => `   ${l}`),
  ].join('\n')

  const items = opts.items
    .map((it, i) => {
      const snap = it.options_snapshot ?? {}
      const color = snap.color_name ? `   Cor: ${snap.color_name}` : ''
      const variant = snap.variant_label ? `   Variação: ${snap.variant_label}` : ''
      return [
        `${i + 1}. *${it.product_name}*`,
        `   SKU: ${it.sku}`,
        color,
        variant,
        `   Qtd: ${it.quantity} × ${formatBRL(Number(it.unit_price))} = *${formatBRL(Number(it.line_total))}*`,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  const pay = `💳 *Pagamento:* ${paymentHuman(opts.paymentKind, opts.paymentDetails)}`
  const tot = `💰 *Total:* ${formatBRL(opts.total)}`
  const obs = opts.notes.trim() ? `📝 *Observações:*\n${opts.notes.trim()}` : ''

  return [header, '', cust, '', '*Itens:*', items, '', pay, tot, obs].filter(Boolean).join('\n')
}

function extractMessageKey(data: unknown): { id: string; remoteJid: string } | null {
  if (!data || typeof data !== 'object') return null
  const o = data as { key?: { id?: string; remoteJid?: string } }
  const id = o.key?.id
  const remoteJid = o.key?.remoteJid
  if (id && remoteJid) return { id, remoteJid }
  return null
}

export type StoreGroupNotifyResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string; details?: unknown }
  | { skipped: true; reason: string }

export async function notifyNewOrderToStoreGroup(
  storeId: string,
  orderId: string,
): Promise<StoreGroupNotifyResult> {
  const sb = getServiceClient()

  const { data: instance } = await sb
    .from('store_whatsapp_instances')
    .select('instance_name, instance_token, status')
    .eq('store_id', storeId)
    .maybeSingle()

  if (!instance || instance.status !== 'connected') {
    return { skipped: true, reason: 'whatsapp_not_connected' }
  }

  const { data: store } = await sb
    .from('stores')
    .select('whatsapp_orders_group_jid, app_base_url, trade_name')
    .eq('id', storeId)
    .single()

  const groupJid = store?.whatsapp_orders_group_jid
  if (!groupJid) return { skipped: true, reason: 'orders_group_missing' }

  const { data: dup } = await sb
    .from('whatsapp_message_log')
    .select('id')
    .eq('order_id', orderId)
    .eq('order_status', 'novo')
    .eq('recipient_kind', 'store_group')
    .eq('delivery_status', 'sent')
    .maybeSingle()

  if (dup) return { skipped: true, reason: 'already_sent_to_group' }

  const { data: order } = await sb
    .from('orders')
    .select(
      `id, order_number, total, payment_kind, payment_details, notes,
       customer_snapshot, shipping_snapshot,
       order_items ( product_name, sku, quantity, unit_price, line_total, options_snapshot )`,
    )
    .eq('id', orderId)
    .eq('store_id', storeId)
    .single()

  if (!order) return { ok: false, error: 'Pedido não encontrado' }

  const snapshot = (order.customer_snapshot ?? {}) as {
    full_name?: string
    phone?: string
    phone_secondary?: string
  }
  const shipping = (order.shipping_snapshot ?? {}) as {
    street?: string
    number?: string
    complement?: string
    district?: string
    city?: string
    state?: string
    cep?: string
  }

  const addressLines = [
    `${shipping.street ?? ''}, ${shipping.number ?? ''}${shipping.complement ? ' — ' + shipping.complement : ''}`.trim(),
    `${shipping.district ?? ''} — ${shipping.city ?? ''}/${shipping.state ?? ''} — CEP ${shipping.cep ?? ''}`.trim(),
  ].filter((l) => l.replace(/[,—\s]/g, '').length > 0)

  const items = (order.order_items ?? []) as OrderItem[]
  const text = buildStoreGroupOrderMessage({
    orderNumber: order.order_number,
    customerName: snapshot.full_name ?? 'Cliente',
    customerPhone: snapshot.phone ?? '',
    customerPhoneSecondary: snapshot.phone_secondary,
    addressLines,
    items,
    paymentKind: order.payment_kind,
    paymentDetails: (order.payment_details ?? {}) as Record<string, unknown>,
    total: Number(order.total),
    notes: order.notes ?? '',
  })

  const adminUrl = buildOrderAdminUrl(appPublicBaseUrl(store?.app_base_url), orderId)
  const linkLine = `🔗 Ver pedido no painel:\n${adminUrl}`

  const { ok, data } = await evolutionRequest(
    `/message/sendText/${encodeURIComponent(instance.instance_name)}`,
    {
      method: 'POST',
      apiKey: instance.instance_token,
      body: JSON.stringify({ number: groupJid, text }),
    },
  )

  const mainKey = extractMessageKey(data)
  const evolutionId = mainKey?.id ?? (data as { messageId?: string })?.messageId ?? null

  if (!ok) {
    await sb.from('whatsapp_message_log').insert({
      store_id: storeId,
      order_id: orderId,
      customer_phone: groupJid,
      order_status: 'novo',
      message_text: text,
      delivery_status: 'failed',
      error_message: JSON.stringify(data),
      recipient_kind: 'store_group',
    })
    return { ok: false, error: 'Falha ao enviar resumo no grupo', details: data }
  }

  let linkSent = false
  if (mainKey) {
    const linkRes = await evolutionRequest(
      `/message/sendText/${encodeURIComponent(instance.instance_name)}`,
      {
        method: 'POST',
        apiKey: instance.instance_token,
        body: JSON.stringify({
          number: groupJid,
          text: linkLine,
          quoted: {
            key: { id: mainKey.id, remoteJid: mainKey.remoteJid, fromMe: true },
            message: { conversation: text.slice(0, 500) },
          },
        }),
      },
    )
    linkSent = linkRes.ok
  }

  if (!linkSent) {
    await evolutionRequest(
      `/message/sendText/${encodeURIComponent(instance.instance_name)}`,
      {
        method: 'POST',
        apiKey: instance.instance_token,
        body: JSON.stringify({ number: groupJid, text: `\n${linkLine}` }),
      },
    )
  }

  await sb.from('whatsapp_message_log').insert({
    store_id: storeId,
    order_id: orderId,
    customer_phone: groupJid,
    order_status: 'novo',
    message_text: `${text}\n\n${linkLine}`,
    evolution_message_id: evolutionId,
    delivery_status: 'sent',
    error_message: null,
    recipient_kind: 'store_group',
  })

  return { ok: true, messageId: evolutionId }
}

export async function notifyOrderStatusToStoreGroup(
  storeId: string,
  orderId: string,
  newStatus: string,
): Promise<StoreGroupNotifyResult> {
  const sb = getServiceClient()

  const { data: instance } = await sb
    .from('store_whatsapp_instances')
    .select('instance_name, instance_token, status, notify_settings')
    .eq('store_id', storeId)
    .maybeSingle()

  if (!instance || instance.status !== 'connected') {
    return { skipped: true, reason: 'whatsapp_not_connected' }
  }

  const settings = (instance.notify_settings as Record<string, NotifySettingItem>) ?? {}
  const { enabled } = resolveStatusTemplate(settings, newStatus)
  if (!enabled) {
    return { skipped: true, reason: 'notify_disabled_for_status' }
  }

  const { data: store } = await sb
    .from('stores')
    .select('whatsapp_orders_group_jid, app_base_url')
    .eq('id', storeId)
    .single()

  const groupJid = store?.whatsapp_orders_group_jid
  if (!groupJid) return { skipped: true, reason: 'orders_group_missing' }

  const { data: dup } = await sb
    .from('whatsapp_message_log')
    .select('id')
    .eq('order_id', orderId)
    .eq('order_status', newStatus)
    .eq('recipient_kind', 'store_group')
    .eq('delivery_status', 'sent')
    .maybeSingle()

  if (dup) return { skipped: true, reason: 'already_sent_to_group' }

  const { data: order } = await sb
    .from('orders')
    .select('order_number')
    .eq('id', orderId)
    .eq('store_id', storeId)
    .single()

  if (!order) return { ok: false, error: 'Pedido não encontrado' }

  const statusLabel = STATUS_LABELS[newStatus] ?? newStatus
  const adminUrl = buildOrderAdminUrl(appPublicBaseUrl(store?.app_base_url), orderId)
  const text = `📦 *Pedido ${order.order_number}* — status: *${statusLabel}*\n\n🔗 Ver pedido no painel:\n${adminUrl}`

  const { ok, data } = await evolutionRequest(
    `/message/sendText/${encodeURIComponent(instance.instance_name)}`,
    {
      method: 'POST',
      apiKey: instance.instance_token,
      body: JSON.stringify({ number: groupJid, text }),
    },
  )

  const evolutionId =
    (data as { key?: { id?: string } })?.key?.id ??
    (data as { messageId?: string })?.messageId ??
    null

  if (!ok) {
    await sb.from('whatsapp_message_log').insert({
      store_id: storeId,
      order_id: orderId,
      customer_phone: groupJid,
      order_status: newStatus,
      message_text: text,
      delivery_status: 'failed',
      error_message: JSON.stringify(data),
      recipient_kind: 'store_group',
    })
    return { ok: false, error: 'Falha ao enviar atualização no grupo', details: data }
  }

  await sb.from('whatsapp_message_log').insert({
    store_id: storeId,
    order_id: orderId,
    customer_phone: groupJid,
    order_status: newStatus,
    message_text: text,
    evolution_message_id: evolutionId,
    delivery_status: 'sent',
    error_message: null,
    recipient_kind: 'store_group',
  })

  return { ok: true, messageId: evolutionId }
}
