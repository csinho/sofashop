import { formatCurrency, formatDateTime } from '@/lib/format'
import { formatBrazilPhoneDisplay, toBrazilStorageDigits } from '@/lib/phoneBr'
import { PAYMENT_LABEL } from '@/constants/payments'
import type { PaymentKind } from '@/types/database'
import type { CartLine } from '@/contexts/CartContext'

export type WhatsAppOrderSummary = {
  orderNumber: string
  customerName: string
  customerPhone: string
  /** Telefone alternativo (opcional), exibido na mensagem se preenchido. */
  customerPhoneSecondary?: string
  addressLines: string[]
  lines: CartLine[]
  /** Soma dos itens (sem frete nem taxa de cartão). */
  itemsSubtotal: number
  deliveryFee?: number
  total: number
  paymentKind: PaymentKind
  paymentDetails: Record<string, unknown>
  notes: string
  createdAtIso: string
}

function paymentHuman(kind: PaymentKind, details: Record<string, unknown>) {
  const base = PAYMENT_LABEL[kind]
  if (kind === 'cartao_credito' && details.installments) {
    const inst = details.installments
    const fee = details.fee_amount as number | undefined
    if (fee != null && fee > 0) {
      return `${base} (${inst}x, taxa ${formatCurrency(fee)})`
    }
    return `${base} (${inst}x)`
  }
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
    `📞 *Telefone:* ${formatBrazilPhoneDisplay(s.customerPhone)}`,
    ...(s.customerPhoneSecondary?.trim()
      ? [`📞 *Telefone 2:* ${formatBrazilPhoneDisplay(s.customerPhoneSecondary)}`]
      : []),
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
  const freight =
    s.deliveryFee != null && s.deliveryFee > 0 ? `🚚 *Frete:* ${formatCurrency(s.deliveryFee)}` : ''
  const tot = `💰 *Total:* ${formatCurrency(s.total)}`
  const obs = s.notes.trim()
    ? `📝 *Observações:*\n${s.notes.trim()}`
    : ''

  return [header, when, '', cust, '', '*Itens:*', items, '', pay, freight, tot, obs].filter(Boolean).join('\n')
}

export function openWhatsApp(phoneDigits: string, text: string) {
  const n = toBrazilStorageDigits(phoneDigits)
  const url = `https://wa.me/${n}?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
