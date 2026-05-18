import { ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import { applyMessageTemplate, DEFAULT_STATUS_TEMPLATES } from '@/lib/messageTemplate'
import type { OrderStatus } from '@/types/database'

/** Pré-visualização local do texto (envio real ocorre na Edge Function). */
export function buildOrderStatusMessagePreview(opts: {
  customerName: string
  orderNumber: string
  status: OrderStatus
  template?: string
}) {
  const tpl = (opts.template ?? '').trim() || DEFAULT_STATUS_TEMPLATES[opts.status] || DEFAULT_STATUS_TEMPLATES.novo
  return applyMessageTemplate(tpl, {
    NOME_CLIENTE: opts.customerName,
    NUMERO_PEDIDO: opts.orderNumber,
    STATUS_PEDIDO: ORDER_STATUS_LABEL[opts.status],
  })
}
