import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react'
import { cn } from '@/lib/cn'
import { notifyOk } from '@/lib/notify'

const variants = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20 disabled:opacity-50',
  /** Catálogo público: usa --cat-accent definido no CatalogLayout. */
  catalog:
    'bg-[var(--cat-accent)] text-white hover:opacity-95 shadow-sm shadow-black/10 disabled:opacity-50 focus-visible:outline-[var(--cat-accent)]',
  secondary:
    'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 disabled:opacity-50',
  ghost: 'text-ink-700 hover:bg-ink-100 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: keyof typeof variants
    loading?: boolean
    /** Exibe toast de sucesso após o handler concluir sem erro (útil em ações rápidas). */
    doneToast?: string
  }
>(function Button({ className, variant = 'primary', loading, disabled, children, onClick, doneToast, type, ...props }, ref) {
  const btnType = type ?? 'button'

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (!doneToast) {
      onClick?.(e)
      return
    }
    const r = onClick?.(e)
    if (btnType === 'submit' && !onClick) {
      return
    }
    Promise.resolve(r).then(
      () => notifyOk(doneToast),
      () => {},
    )
  }

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      onClick={doneToast ? handleClick : onClick}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : null}
      {children}
    </button>
  )
})
