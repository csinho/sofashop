import { jsonResponse, optionsResponse } from '../_shared/cors.ts'
import { notifyOrderStatusWhatsApp } from '../_shared/orderWhatsAppNotify.ts'
import { notifyNewOrderToStoreGroup } from '../_shared/storeOrderGroupNotify.ts'
import { getServiceClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = await req.json() as { storeId?: string; orderId?: string }
    const { storeId, orderId } = body

    if (!storeId || !orderId) {
      return jsonResponse({ error: 'storeId e orderId são obrigatórios' }, 400)
    }

    const sb = getServiceClient()

    const { data: already } = await sb
      .from('whatsapp_message_log')
      .select('id')
      .eq('order_id', orderId)
      .eq('order_status', 'novo')
      .eq('delivery_status', 'sent')
      .maybeSingle()

    if (already) {
      return jsonResponse({ skipped: true, reason: 'already_sent' })
    }

    const { data: order } = await sb
      .from('orders')
      .select('id, status, created_at, store_id')
      .eq('id', orderId)
      .eq('store_id', storeId)
      .maybeSingle()

    if (!order) return jsonResponse({ error: 'Pedido não encontrado' }, 404)

    if (order.status !== 'novo') {
      return jsonResponse({ skipped: true, reason: 'order_not_novo' })
    }

    const ageMs = Date.now() - new Date(order.created_at).getTime()
    if (ageMs > 15 * 60 * 1000) {
      return jsonResponse({ error: 'Pedido expirado para notificação automática' }, 400)
    }

    const customerResult = await notifyOrderStatusWhatsApp(storeId, orderId, 'novo')
    const groupResult = await notifyNewOrderToStoreGroup(storeId, orderId)

    if ('ok' in customerResult && !customerResult.ok) {
      return jsonResponse({ error: customerResult.error, details: customerResult.details, group: groupResult }, 502)
    }
    return jsonResponse({ customer: customerResult, group: groupResult })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return jsonResponse({ error: msg }, 500)
  }
})
