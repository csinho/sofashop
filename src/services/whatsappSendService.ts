import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { readEdgeFunctionError } from '@/services/whatsappInvokeError'
import { ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import type { OrderStatus } from '@/types/database'

export type WhatsAppChannelResult = {
  sent: boolean
  skipped: boolean
  reason?: string
  error?: string
}

export type WhatsAppSendResult = {
  customer: WhatsAppChannelResult
  group: WhatsAppChannelResult
}

/** @deprecated use WhatsAppChannelResult */
export type WhatsAppSendResultLegacy = WhatsAppChannelResult

function parseChannel(data: unknown): WhatsAppChannelResult {
  const p = data as {
    ok?: boolean
    skipped?: boolean
    reason?: string
    error?: string
  }
  if (p?.error) {
    return { sent: false, skipped: false, error: p.error }
  }
  if (p?.skipped) {
    return { sent: false, skipped: true, reason: p.reason }
  }
  if (p?.ok) {
    return { sent: true, skipped: false }
  }
  return { sent: false, skipped: false }
}

function parsePayload(data: unknown): WhatsAppSendResult {
  const p = data as {
    customer?: unknown
    group?: unknown
    error?: string
    skipped?: boolean
    ok?: boolean
    reason?: string
  }

  if (p?.error && !p.customer && !p.group) {
    const err = { sent: false, skipped: false, error: p.error }
    return { customer: err, group: { sent: false, skipped: true, reason: 'not_requested' } }
  }

  if (p?.customer != null || p?.group != null) {
    return {
      customer: parseChannel(p.customer),
      group: parseChannel(p.group ?? { skipped: true, reason: 'not_requested' }),
    }
  }

  return {
    customer: parseChannel(data),
    group: { sent: false, skipped: true, reason: 'not_requested' },
  }
}

function channelUserMessage(
  channel: WhatsAppChannelResult,
  status: OrderStatus,
  target: 'cliente' | 'grupo',
): string | null {
  const label = ORDER_STATUS_LABEL[status]

  if (channel.sent) {
    return target === 'cliente'
      ? `WhatsApp enviado ao cliente (${label}).`
      : `Resumo enviado no grupo interno (${label}).`
  }

  if (channel.skipped) {
    if (channel.reason === 'notify_disabled_for_status') {
      return target === 'cliente'
        ? `WhatsApp não enviado ao cliente: notificação desativada para “${label}” nas configurações.`
        : null
    }
    if (channel.reason === 'whatsapp_not_connected') {
      return target === 'cliente'
        ? 'WhatsApp não enviado: instância da loja não está conectada.'
        : 'Grupo: WhatsApp da loja não está conectado.'
    }
    if (channel.reason === 'customer_phone_missing') {
      return 'WhatsApp não enviado: telefone do cliente inválido ou ausente.'
    }
    if (channel.reason === 'orders_group_missing') {
      return 'Grupo interno não configurado. Reconecte o WhatsApp em Configurações.'
    }
    if (channel.reason === 'status_unchanged' || channel.reason === 'not_requested') {
      return null
    }
    if (channel.reason === 'already_sent_to_group') {
      return null
    }
    return null
  }

  if (channel.error) {
    return target === 'cliente'
      ? `Falha ao enviar WhatsApp ao cliente: ${channel.error}`
      : `Falha ao enviar no grupo: ${channel.error}`
  }

  return null
}

export async function sendOrderStatusWhatsApp(opts: {
  storeId: string
  orderId: string
  newStatus: OrderStatus
  previousStatus?: OrderStatus
}): Promise<WhatsAppSendResult> {
  if (opts.previousStatus && opts.previousStatus === opts.newStatus) {
    const unchanged = { sent: false, skipped: true, reason: 'status_unchanged' }
    return { customer: unchanged, group: unchanged }
  }

  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.functions.invoke('whatsapp-send', {
    body: {
      storeId: opts.storeId,
      orderId: opts.orderId,
      newStatus: opts.newStatus,
      previousStatus: opts.previousStatus,
    },
  })

  if (error) {
    const err = { sent: false, skipped: false, error: await readEdgeFunctionError(error) }
    return { customer: err, group: { sent: false, skipped: true, reason: 'not_requested' } }
  }

  return parsePayload(data)
}

export type WhatsAppNotifyToast = { type: 'ok' | 'err'; text: string }

export function whatsAppStatusNotifyToasts(result: WhatsAppSendResult, status: OrderStatus): WhatsAppNotifyToast[] {
  const toasts: WhatsAppNotifyToast[] = []
  const customerMsg = channelUserMessage(result.customer, status, 'cliente')
  const groupMsg = channelUserMessage(result.group, status, 'grupo')

  if (customerMsg) {
    toasts.push({ type: result.customer.sent ? 'ok' : 'err', text: customerMsg })
  }
  if (groupMsg) {
    toasts.push({ type: result.group.sent ? 'ok' : 'err', text: groupMsg })
  }
  return toasts
}

/** @deprecated use whatsAppStatusNotifyToasts */
export function whatsAppSendUserMessage(result: WhatsAppSendResult, status: OrderStatus): string | null {
  const toasts = whatsAppStatusNotifyToasts(result, status)
  return toasts[0]?.text ?? null
}

export async function notifyCheckoutOrderWhatsApp(
  storeId: string,
  orderId: string,
): Promise<{ customer: WhatsAppChannelResult; group: WhatsAppChannelResult } | null> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.functions.invoke('whatsapp-notify-checkout', {
    body: { storeId, orderId },
  })

  if (error) {
    console.warn('[whatsapp-notify-checkout]', await readEdgeFunctionError(error))
    return null
  }

  const p = data as { customer?: unknown; group?: unknown; error?: string }
  if (p?.error) {
    console.warn('[whatsapp-notify-checkout]', p.error)
    return null
  }

  if (p?.customer != null || p?.group != null) {
    return {
      customer: parseChannel(p.customer),
      group: parseChannel(p.group),
    }
  }

  return { customer: parseChannel(data), group: { sent: false, skipped: true } }
}
