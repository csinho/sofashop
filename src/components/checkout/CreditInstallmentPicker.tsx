import { formatCurrency } from '@/lib/format'
import {
  creditCardInstallmentQuote,
  creditInstallmentFeePercent,
  creditInstallmentOptions,
  formatPercentBr,
  type CreditInstallmentRate,
} from '@/lib/creditCardInstallments'

type Props = {
  subtotal: number
  selected: number
  rates: ReadonlyArray<CreditInstallmentRate>
  onSelect: (installments: number) => void
}

export function CreditInstallmentPicker({ subtotal, selected, rates, onSelect }: Props) {
  const options = creditInstallmentOptions(rates)
  const quote = creditCardInstallmentQuote(subtotal, selected, rates)

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-ink-600">Parcelas no cartão de crédito</p>
      <div className="flex flex-wrap gap-2">
        {options.map((n) => {
          const active = n === quote.installments
          const pct = formatPercentBr(creditInstallmentFeePercent(n, rates))
          return (
            <button
              key={n}
              type="button"
              title={`Parcelar em ${n}x com taxa de ${pct}.`}
              onClick={() => onSelect(n)}
              className={`flex min-w-[3.25rem] flex-col items-center justify-center rounded-xl border px-2.5 py-2 text-center transition ${
                active
                  ? 'border-[var(--cat-accent)] bg-[var(--cat-accent)]/10 text-ink-900 shadow-sm'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
              }`}
              aria-pressed={active}
              aria-label={`${n} parcela${n > 1 ? 's' : ''}, taxa ${pct}`}
            >
              <span className="text-sm font-bold leading-none">{n}x</span>
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border border-ink-200 bg-ink-50/80 px-4 py-3 text-sm text-ink-800">
        <dl className="grid gap-2 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-500">Taxa</dt>
            <dd className="font-semibold text-ink-900">{formatPercentBr(quote.percent)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">Valor da taxa</dt>
            <dd className="font-semibold text-ink-900">{formatCurrency(quote.feeAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">Total com taxa</dt>
            <dd className="font-semibold text-[var(--cat-primary)]">{formatCurrency(quote.total)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-ink-500">
          Valor base (produtos + frete): {formatCurrency(subtotal)}. Taxas conforme configuração da loja.
        </p>
      </div>
    </div>
  )
}
