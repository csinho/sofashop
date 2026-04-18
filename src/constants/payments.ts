import type { PaymentKind } from '@/types/database'

export const PAYMENT_LABEL: Record<PaymentKind, string> = {
  pix: 'Pix',
  cartao_debito: 'Cartão débito',
  cartao_credito: 'Cartão crédito',
  parcelado: 'Parcelado',
  entrada_parcelado: 'Entrada + parcelamento',
}
