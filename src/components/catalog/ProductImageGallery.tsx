import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type Props = {
  urls: string[]
  alt?: string
  className?: string
  accentVar?: string
}

export function ProductImageGallery({ urls, alt = '', className, accentVar = '--cat-accent' }: Props) {
  const list = urls.filter(Boolean)
  const [idx, setIdx] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    setIdx(0)
  }, [urls.join('|')])

  const go = useCallback(
    (d: number) => {
      if (!list.length) return
      setIdx((i) => (i + d + list.length) % list.length)
    },
    [list.length],
  )

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, go])

  if (!list.length) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-3xl bg-ink-100 text-ink-400">
        Sem imagem
      </div>
    )
  }

  const accent = `var(${accentVar})`

  return (
    <>
      <div className={cn('relative overflow-hidden rounded-3xl bg-ink-100 ring-1 ring-ink-200/80', className)}>
        <button
          type="button"
          className="relative block aspect-square w-full"
          onClick={() => setLightbox(true)}
          aria-label="Ampliar imagem"
        >
          <img src={list[idx]} alt={alt} className="h-full w-full object-cover" />
        </button>
        {list.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-800 shadow-md backdrop-blur transition hover:bg-white"
              onClick={(e) => {
                e.stopPropagation()
                go(-1)
              }}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-800 shadow-md backdrop-blur transition hover:bg-white"
              onClick={(e) => {
                e.stopPropagation()
                go(1)
              }}
              aria-label="Próxima"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {list.map((u, i) => (
                <button
                  key={u + i}
                  type="button"
                  className={cn(
                    'h-2 w-2 rounded-full transition',
                    i === idx ? 'w-6' : 'opacity-50',
                  )}
                  style={{ background: i === idx ? accent : '#cbd5e1' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIdx(i)
                  }}
                  aria-label={`Imagem ${i + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-[min(96vw,1100px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute -right-1 -top-12 z-10 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
              onClick={() => setLightbox(false)}
            >
              <X className="h-4 w-4" />
              Fechar
            </button>
            <img
              src={list[idx]}
              alt={alt}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            {list.length > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-lg hover:bg-white"
                  onClick={() => go(-1)}
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-7 w-7" />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-lg hover:bg-white"
                  onClick={() => go(1)}
                  aria-label="Próxima"
                >
                  <ChevronRight className="h-7 w-7" />
                </button>
              </>
            ) : null}
            <p className="mt-3 text-center text-sm text-white/80">
              {idx + 1} / {list.length} — use as setas do teclado
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
