import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type Props = {
  show: boolean
  page: number
  pageCount: number
  total: number
  onPrev: () => void
  onNext: () => void
  itemSingular: string
  itemPlural: string
  'ariaLabel'?: string
}

export function ListPaginationBar({
  show,
  page,
  pageCount,
  total,
  onPrev,
  onNext,
  itemSingular,
  itemPlural,
  'ariaLabel': ariaLabel = 'Paginação',
}: Props) {
  if (!show) return null
  return (
    <div
      className="flex flex-col items-center justify-between gap-3 sm:flex-row sm:justify-end"
      aria-label={ariaLabel}
    >
      <p className="order-2 text-xs text-ink-500 sm:order-1 sm:mr-auto">
        Página {page} de {pageCount} · {total} {total === 1 ? itemSingular : itemPlural}
      </p>
      <div className="order-1 flex items-center gap-1 sm:order-2">
        <Button
          type="button"
          variant="secondary"
          className="!px-2.5 !py-1.5"
          disabled={page <= 1}
          onClick={onPrev}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="!px-2.5 !py-1.5"
          disabled={page >= pageCount}
          onClick={onNext}
          aria-label="Próxima página"
        >
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
