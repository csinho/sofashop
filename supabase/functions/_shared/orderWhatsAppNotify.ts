import { evolutionRequest } from './evolution.ts'
import { applyMessageTemplate, resolveStatusTemplate, type NotifySettingItem } from './messageTemplate.ts'
import { getServiceClient } from './supabase.ts'
import { phoneToEvolutionNumber } from './templates.ts'

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  em_producao: 'Em produção',
  pronto_entrega: 'Pronto para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export type NotifyOrderResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string; details?: unknown }
  | { skipped: true; reason: string }

export async function notifyOrderStatusWhatsApp(
  storeId: string,
  orderId: string,
  newStatus: string,
  previousStatus?: string,
): Promise<NotifyOrderResult> {
  if (previousStatus && previousStatus === newStatus) {
    return { skipped: true, reason: 'status_unchanged' }
  }

  const sb = getServiceClient()

  const { data: instance } = await sb
    .from('store_whatsapp_instances')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle()

  if (!instance || instance.status !== 'connected') {
    await logMessage(sb, {
      store_id: storeId,
      order_id: orderId,
      customer_phone: '',
      order_status: newStatus,
      message_text: '',
      delivery_status: 'skipped',
      error_message: 'whatsapp_not_connected',
    })
    return { skipped: true, reason: 'whatsapp_not_connected' }
  }

  const settings = (instance.notify_settings as Record<string, NotifySettingItem>) ?? {}
  const { enabled, template } = resolveStatusTemplate(settings, newStatus)
  if (!enabled) {
    await logMessage(sb, {
      store_id: storeId,
      order_id: orderId,
      customer_phone: '',
      order_status: newStatus,
      message_text: '',
      delivery_status: 'skipped',
      error_message: 'notify_disabled_for_status',
    })
    return { skipped: true, reason: 'notify_disabled_for_status' }
  }

  const { data: order } = await sb
    .from('orders')
    .select(`
      id, order_number, status, customer_snapshot,
      customers ( full_name, phone_normalized, phone )
    `)
    .eq('id', orderId)
    .eq('store_id', storeId)
    .single()

  if (!order) return { ok: false, error: 'Pedido não encontrado' }

  const snapshot = order.customer_snapshot as { full_name?: string; phone?: string } | null
  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
  const customerName =
    snapshot?.full_name ??
    (customer as { full_name?: string } | null)?.full_name ??
    'Cliente'
  const phoneDigits =
    (customer as { phone_normalized?: string } | null)?.phone_normalized ??
    snapshot?.phone?.replace(/\D/g, '') ??
    (customer as { phone?: string } | null)?.phone?.replace(/\D/g, '') ??
    ''

  if (!phoneDigits || phoneDigits.replace(/\D/g, '').length < 10) {
    await logMessage(sb, {
      store_id: storeId,
      order_id: orderId,
      customer_phone: phoneDigits,
      order_status: newStatus,
      message_text: '',
      delivery_status: 'failed',
      error_message: 'customer_phone_missing',
    })
    return { skipped: true, reason: 'customer_phone_missing' }
  }

  const statusLabel = STATUS_LABELS[newStatus] ?? newStatus
  const text = applyMessageTemplate(template, {
    NOME_CLIENTE: customerName,
    NUMERO_PEDIDO: order.order_number,
    STATUS_PEDIDO: statusLabel,
  })

  const number = phoneToEvolutionNumber(phoneDigits)
  const { ok, data } = await evolutionRequest(
    `/message/sendText/${encodeURIComponent(instance.instance_name)}`,
    {
      method: 'POST',
      apiKey: instance.instance_token,
      body: JSON.stringify({ number, text }),
    },
  )

  const evolutionId =
    (data as { key?: { id?: string } })?.key?.id ??
    (data as { messageId?: string })?.messageId ??
    null

  if (!ok) {
    await logMessage(sb, {
      store_id: storeId,
      order_id: orderId,
      customer_phone: number,
      order_status: newStatus,
      message_text: text,
      delivery_status: 'failed',
      error_message: JSON.stringify(data),
    })
    return { ok: false, error: 'Falha ao enviar mensagem na Evolution API', details: data }
  }

    await logMessage(sb, {
      store_id: storeId,
      order_id: orderId,
      customer_phone: number,
      order_status: newStatus,
      message_text: text,
      evolution_message_id: evolutionId,
      delivery_status: 'sent',
      error_message: null,
      recipient_kind: 'customer',
    })

  return { ok: true, messageId: evolutionId }
}

async function logMessage(
  sb: ReturnType<typeof getServiceClient>,
  row: {
    store_id: string
    order_id: string
    customer_phone: string
    order_status: string
    message_text: string
    evolution_message_id?: string | null
    delivery_status: 'sent' | 'failed' | 'skipped'
    error_message: string | null
    recipient_kind?: 'customer' | 'store_group'
  },
) {
  await sb.from('whatsapp_message_log').insert({
    recipient_kind: 'customer',
    ...row,
  })
}
