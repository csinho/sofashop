import { cn } from '@/lib/cn'
import type { HTMLAttributes } from 'react'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-200/80 bg-white p-5 shadow-sm shadow-ink-900/5',
        className,
      )}
      {...props}
    />
  )
}
