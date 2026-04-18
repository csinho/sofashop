import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { onlyDigits } from '@/lib/format'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string
  onValueChange: (digits: string) => void
}

/** Apenas dígitos (quantidade, parcelas, dias, etc.). */
export const IntegerField = forwardRef<HTMLInputElement, Props>(function IntegerField(
  { value, onValueChange, className, maxLength, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={maxLength}
      className={cn(
        'w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
        className,
      )}
      value={value}
      onChange={(e) => onValueChange(onlyDigits(e.target.value))}
      {...props}
    />
  )
})
