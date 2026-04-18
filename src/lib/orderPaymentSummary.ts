import { formatCurrency } from '@/lib/format'
import { PAYMENT_LABEL } from '@/constants/payments'
import type { PaymentDetails, PaymentKind } from '@/types/database'

/** Texto legível para painel (detalhe do pedido, financeiro), sem JSON. */
export function formatOrderPaymentSummary(
  kind: PaymentKind,
  details: PaymentDetails | Record<string, unknown> | null | undefined,
): string[] {
  const d = (details ?? {}) as PaymentDetails & Record<string, unknown>
  const installments = typeof d.installments === 'number' ? d.installments : Number(d.installments)
  const downRaw: unknown = d.down_payment
  const down =
    typeof downRaw === 'number'
      ? downRaw
      : typeof downRaw === 'string'
        ? Number(downRaw.replace(',', '.'))
        : NaN

  const lines: string[] = []

  switch (kind) {
    case 'pix':
      lines.push(PAYMENT_LABEL.pix)
      break
    case 'cartao_debito':
      lines.push(PAYMENT_LABEL.cartao_debito)
      break
    case 'cartao_credito':
      if (Number.isFinite(installments) && installments > 1) {
        lines.push(`${PAYMENT_LABEL.cartao_credito} — ${installments} parcelas.`)
      } else {
        lines.push(`${PAYMENT_LABEL.cartao_credito} — à vista.`)
      }
      break
    case 'parcelado':
      if (Number.isFinite(installments) && installments >= 2) {
        lines.push(`${PAYMENT_LABEL.parcelado} — ${installments} parcelas.`)
      } else {
        lines.push(PAYMENT_LABEL.parcelado)
      }
      break
    case 'entrada_parcelado': {
      const parts: string[] = [PAYMENT_LABEL.entrada_parcelado]
      if (Number.isFinite(down) && down > 0) parts.push(`entrada ${formatCurrency(down)}`)
      if (Number.isFinite(installments) && installments >= 2) parts.push(`${installments} parcelas no saldo`)
      lines.push(parts.join(' — '))
      break
    }
    default:
      lines.push(PAYMENT_LABEL[kind] ?? String(kind))
  }

  return lines
}
