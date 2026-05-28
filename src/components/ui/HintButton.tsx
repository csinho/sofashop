import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Texto exibido ao passar o mouse (obrigatório para ações). */
  tooltip: string
}

/** Botão nativo com dica de ação (title) padronizada. */
export const HintButton = forwardRef<HTMLButtonElement, Props>(function HintButton(
  { tooltip, title, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      title={tooltip ?? title}
      className={cn(className)}
      {...props}
    />
  )
})
