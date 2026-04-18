import type { CatalogStoreRow, CheckoutPaymentConfig, PaymentKind } from '@/types/database'

const ALL: PaymentKind[] = [
  'pix',
  'cartao_debito',
  'cartao_credito',
  'parcelado',
  'entrada_parcelado',
]

export function defaultCheckoutPaymentConfig(): CheckoutPaymentConfig {
  return {
    accepted_methods: [...ALL],
    card_fee_credit_percent: 0,
    card_fee_debit_percent: 0,
  }
}

export function resolveCheckoutConfig(store: CatalogStoreRow | null | undefined): CheckoutPaymentConfig {
  const c = store?.checkout_payment_config
  if (c && Array.isArray(c.accepted_methods)) {
    return {
      accepted_methods: c.accepted_methods.length ? c.accepted_methods : defaultCheckoutPaymentConfig().accepted_methods,
      card_fee_credit_percent: Number(c.card_fee_credit_percent) || 0,
      card_fee_debit_percent: Number(c.card_fee_debit_percent) || 0,
    }
  }
  return defaultCheckoutPaymentConfig()
}
