import { forwardRef, type InputHTMLAttributes } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { maskMoneyBRL, parseMoneyBRL } from '@/lib/moneyInput'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (masked: string, numeric: number) => void
  /** Valor em reais ao clicar nas setas (padrão 1). */
  stepReais?: number
}

export const MoneyField = forwardRef<HTMLInputElement, Props>(function MoneyField(
  { value, onValueChange, className, onBlur, stepReais = 1, ...props },
  ref,
) {
  function applyAmount(next: number) {
    const clamped = Math.max(0, next)
    const cents = Math.round(clamped * 100)
    const masked = maskMoneyBRL(String(cents))
    onValueChange(masked, clamped)
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">R$</span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn(
          'w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-10 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
          className,
        )}
        value={value}
        onChange={(e) => {
          const m = maskMoneyBRL(e.target.value)
          onValueChange(m, parseMoneyBRL(m))
        }}
        onBlur={onBlur}
        {...props}
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col gap-0 rounded-md border border-ink-200 bg-ink-50/90 p-0.5 shadow-sm">
        <button
          type="button"
          tabIndex={-1}
          className="rounded px-0.5 text-ink-600 hover:bg-white hover:text-ink-900"
          aria-label="Aumentar valor"
          onClick={() => applyAmount(parseMoneyBRL(value) + stepReais)}
        >
          <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="rounded px-0.5 text-ink-600 hover:bg-white hover:text-ink-900"
          aria-label="Diminuir valor"
          onClick={() => applyAmount(parseMoneyBRL(value) - stepReais)}
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
})
