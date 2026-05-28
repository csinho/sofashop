/** Percentual de taxa da maquinha por quantidade de parcelas no cartão de crédito. */
export const CREDIT_INSTALLMENT_FEE_PERCENT: Record<number, number> = {
  1: 3.8,
  2: 5,
  3: 5.73,
  4: 6.46,
  5: 7.19,
  6: 7.92,
  7: 8.65,
  8: 9.38,
  9: 10.11,
  10: 10.84,
}

export const CREDIT_INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export type CreditInstallmentQuote = {
  installments: number
  percent: number
  feeAmount: number
  total: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function creditInstallmentFeePercent(installments: number): number {
  const n = Math.min(10, Math.max(1, Math.round(installments)))
  return CREDIT_INSTALLMENT_FEE_PERCENT[n] ?? CREDIT_INSTALLMENT_FEE_PERCENT[10]
}

/** @param amountBeforeCardFee Subtotal dos itens + frete (base antes da taxa da maquinha). */
export function creditCardInstallmentQuote(amountBeforeCardFee: number, installments: number): CreditInstallmentQuote {
  const n = Math.min(10, Math.max(1, Math.round(installments)))
  const percent = creditInstallmentFeePercent(n)
  const feeAmount = roundMoney(amountBeforeCardFee * (percent / 100))
  const total = roundMoney(amountBeforeCardFee + feeAmount)
  return { installments: n, percent, feeAmount, total }
}

export function formatPercentBr(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
}
