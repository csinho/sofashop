import { formatCurrency } from '@/lib/format'
import { PAYMENT_LABEL } from '@/constants/payments'
import type { PaymentDetails, PaymentKind, ShippingSnapshot } from '@/types/database'

/** Texto legível para painel (detalhe do pedido, financeiro), sem JSON. */
export function formatOrderPaymentSummary(
  kind: PaymentKind,
  details: PaymentDetails | Record<string, unknown> | null | undefined,
  shipping?: ShippingSnapshot | Record<string, unknown> | null,
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

  const ship = (shipping ?? {}) as ShippingSnapshot
  const deliveryRaw: unknown = ship.delivery_fee
  if (deliveryRaw != null && deliveryRaw !== '') {
  const deliveryFee = typeof deliveryRaw === 'number' ? deliveryRaw : Number(deliveryRaw)
  if (Number.isFinite(deliveryFee)) {
    const cityKey = String(ship.delivery_city_key ?? '').trim()
    const found = ship.delivery_found
    lines.push(
      found === false
        ? `Frete: ${formatCurrency(deliveryFee)} (cidade não cadastrada — taxa padrão)`
        : `Frete: ${formatCurrency(deliveryFee)}${cityKey ? ` — ${cityKey.replace(/_/g, ' ')}` : ''}`,
    )
  }
  }

  switch (kind) {
    case 'pix':
      lines.push(PAYMENT_LABEL.pix)
      break
    case 'cartao_debito':
      lines.push(PAYMENT_LABEL.cartao_debito)
      break
    case 'cartao_credito': {
      const feePct = typeof d.fee_percent === 'number' ? d.fee_percent : Number(d.fee_percent)
      const feeAmt = typeof d.fee_amount === 'number' ? d.fee_amount : Number(d.fee_amount)
      const instLabel =
        Number.isFinite(installments) && installments >= 1
          ? `${installments}x`
          : 'à vista'
      lines.push(`${PAYMENT_LABEL.cartao_credito} — ${instLabel}`)
      if (Number.isFinite(feePct) && feePct > 0 && Number.isFinite(feeAmt) && feeAmt > 0) {
        lines.push(`Taxa ${feePct.toLocaleString('pt-BR')}% (${formatCurrency(feeAmt)})`)
      }
      break
    }
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
