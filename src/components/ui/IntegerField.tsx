import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'inputMode'> & {
  value: string
  onValueChange: (digits: string) => void
}

/**
 * Inteiros com setas nativas do navegador (`type="number"`).
 * O estado no pai continua em string (ex.: qty, dias, cm).
 */
export const IntegerField = forwardRef<HTMLInputElement, Props>(function IntegerField(
  { value, onValueChange, className, maxLength: _omitMaxLen, step, min, max, ...props },
  ref,
) {
  const n = value === '' ? NaN : Number(value)
  const display = value === '' || Number.isNaN(n) ? '' : n

  return (
    <input
      ref={ref}
      type="number"
      step={step ?? 1}
      min={min}
      max={max}
      autoComplete="off"
      className={cn(
        'w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100',
        className,
      )}
      value={display === '' ? '' : display}
      onChange={(e) => {
        const t = e.target.value
        if (t === '') {
          onValueChange('')
          return
        }
        const parsed = e.target.valueAsNumber
        if (!Number.isFinite(parsed)) return
        onValueChange(String(Math.trunc(parsed)))
      }}
      {...props}
    />
  )
})
