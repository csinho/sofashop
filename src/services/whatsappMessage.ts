import { formatCurrency, formatDateTime } from '@/lib/format'
import { PAYMENT_LABEL } from '@/constants/payments'
import type { PaymentKind } from '@/types/database'
import type { CartLine } from '@/contexts/CartContext'

export type WhatsAppOrderSummary = {
  orderNumber: string
  customerName: string
  customerPhone: string
  addressLines: string[]
  lines: CartLine[]
  subtotal: number
  paymentKind: PaymentKind
  paymentDetails: Record<string, unknown>
  notes: string
  createdAtIso: string
}

function paymentHuman(kind: PaymentKind, details: Record<string, unknown>) {
  const base = PAYMENT_LABEL[kind]
  if (kind === 'parcelado' && details.installments) {
    return `${base} (${details.installments}x)`
  }
  if (kind === 'entrada_parcelado') {
    const down = details.down_payment as number | undefined
    const inst = details.installments as number | undefined
    return `${base} — entrada ${down != null ? formatCurrency(down) : '-'} + ${inst ?? '-'}x`
  }
  return base
}

export function buildWhatsAppMessage(s: WhatsAppOrderSummary) {
  const header = `✨ *Novo pedido — ${s.orderNumber}*`
  const when = `📅 ${formatDateTime(s.createdAtIso)}`
  const cust = [
    `👤 *Cliente:* ${s.customerName}`,
    `📞 *Telefone:* ${s.customerPhone}`,
    `📍 *Endereço:*`,
    ...s.addressLines.map((l) => `   ${l}`),
  ].join('\n')

  const items = s.lines
    .map((l, i) => {
      const bits = [
        `${i + 1}. *${l.name}*`,
        `   SKU: ${l.sku}`,
        l.colorName ? `   Cor: ${l.colorName}` : '',
        l.variantLabel ? `   Variação: ${l.variantLabel}` : '',
        `   Qtd: ${l.qty} × ${formatCurrency(l.unitPrice)} = *${formatCurrency(l.unitPrice * l.qty)}*`,
      ]
        .filter(Boolean)
        .join('\n')
      return bits
    })
    .join('\n\n')

  const pay = `💳 *Pagamento:* ${paymentHuman(s.paymentKind, s.paymentDetails)}`
  const tot = `💰 *Total:* ${formatCurrency(s.subtotal)}`
  const obs = s.notes.trim()
    ? `📝 *Observações:*\n${s.notes.trim()}`
    : ''

  return [header, when, '', cust, '', '*Itens:*', items, '', pay, tot, obs].filter(Boolean).join('\n')
}

export function openWhatsApp(phoneDigits: string, text: string) {
  const n = phoneDigits.replace(/\D/g, '')
  const url = `https://wa.me/55${n}?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
