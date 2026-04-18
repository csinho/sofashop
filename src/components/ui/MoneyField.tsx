import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { maskMoneyBRL, parseMoneyBRL } from '@/lib/moneyInput'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (masked: string, numeric: number) => void
}

export const MoneyField = forwardRef<HTMLInputElement, Props>(function MoneyField(
  { value, onValueChange, className, onBlur, ...props },
  ref,
) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">R$</span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn(
          'w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
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
    </div>
  )
})
