import { corsHeaders, jsonResponse, optionsResponse } from '../_shared/cors.ts'
import { notifyOrderStatusWhatsApp } from '../_shared/orderWhatsAppNotify.ts'
import { notifyOrderStatusToStoreGroup } from '../_shared/storeOrderGroupNotify.ts'
import { isErrorResponse, requireStoreMember } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = await req.json() as {
      storeId?: string
      orderId?: string
      newStatus?: string
      previousStatus?: string
    }
    const { storeId, orderId, newStatus, previousStatus } = body

    if (!storeId || !orderId || !newStatus) {
      return jsonResponse({ error: 'storeId, orderId e newStatus são obrigatórios' }, 400)
    }

    const auth = await requireStoreMember(req, storeId)
    if (isErrorResponse(auth)) {
      return new Response(await auth.text(), {
        status: auth.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const customer = await notifyOrderStatusWhatsApp(storeId, orderId, newStatus, previousStatus)
    const group = await notifyOrderStatusToStoreGroup(storeId, orderId, newStatus)

    if ('ok' in customer && !customer.ok) {
      return jsonResponse({ error: customer.error, details: customer.details, customer, group }, 502)
    }

    return jsonResponse({ customer, group })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return jsonResponse({ error: msg }, 500)
  }
})
