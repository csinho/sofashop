export type CreditInstallmentRate = {
  installments: number
  fee_percent: number
}

export type CreditInstallmentQuote = {
  installments: number
  percent: number
  feeAmount: number
  total: number
}

/** Tabela padrão (1x–10x) usada no seed e como fallback. */
export const DEFAULT_CREDIT_INSTALLMENT_RATES: CreditInstallmentRate[] = [
  { installments: 1, fee_percent: 3.8 },
  { installments: 2, fee_percent: 5 },
  { installments: 3, fee_percent: 5.73 },
  { installments: 4, fee_percent: 6.46 },
  { installments: 5, fee_percent: 7.19 },
  { installments: 6, fee_percent: 7.92 },
  { installments: 7, fee_percent: 8.65 },
  { installments: 8, fee_percent: 9.38 },
  { installments: 9, fee_percent: 10.11 },
  { installments: 10, fee_percent: 10.84 },
]

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function normalizeCreditInstallmentRates(
  rows: ReadonlyArray<CreditInstallmentRate>,
): CreditInstallmentRate[] {
  const list = rows.length ? rows : DEFAULT_CREDIT_INSTALLMENT_RATES
  return [...list]
    .map((r) => ({
      installments: Math.max(1, Math.round(r.installments)),
      fee_percent: Number(r.fee_percent) || 0,
    }))
    .sort((a, b) => a.installments - b.installments)
}

export function creditInstallmentOptions(rates: ReadonlyArray<CreditInstallmentRate>): number[] {
  return normalizeCreditInstallmentRates(rates).map((r) => r.installments)
}

export function creditInstallmentFeePercent(
  installments: number,
  rates: ReadonlyArray<CreditInstallmentRate>,
): number {
  const n = Math.max(1, Math.round(installments))
  const sorted = normalizeCreditInstallmentRates(rates)
  const exact = sorted.find((r) => r.installments === n)
  if (exact) return exact.fee_percent
  const below = sorted.filter((r) => r.installments <= n)
  if (below.length) return below[below.length - 1].fee_percent
  return sorted[0]?.fee_percent ?? DEFAULT_CREDIT_INSTALLMENT_RATES[0].fee_percent
}

/** @param amountBeforeCardFee Subtotal dos itens + frete (base antes da taxa da maquinha). */
export function creditCardInstallmentQuote(
  amountBeforeCardFee: number,
  installments: number,
  rates: ReadonlyArray<CreditInstallmentRate>,
): CreditInstallmentQuote {
  const sorted = normalizeCreditInstallmentRates(rates)
  const allowed = sorted.map((r) => r.installments)
  const requested = Math.max(1, Math.round(installments))
  const n = allowed.includes(requested) ? requested : (allowed[allowed.length - 1] ?? requested)
  const percent = creditInstallmentFeePercent(n, sorted)
  const feeAmount = roundMoney(amountBeforeCardFee * (percent / 100))
  const total = roundMoney(amountBeforeCardFee + feeAmount)
  return { installments: n, percent, feeAmount, total }
}

export function formatPercentBr(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
}
