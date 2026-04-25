import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Store, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { PlatformStoreSummary } from '@/services/platformService'

export type StoreToggleConfirmState = { row: PlatformStoreSummary; willActivate: boolean }

export function StoreToggleConfirmModal({
  state,
  busy,
  onClose,
  onConfirm,
}: {
  state: StoreToggleConfirmState
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const { row, willActivate } = state
  const title = willActivate ? 'Ativar loja' : 'Desativar loja'
  const body = willActivate
    ? `A loja «${row.trade_name}» voltará a contar na plataforma. Se o catálogo estiver publicado, os clientes poderão acessá-lo; o time da loja retorna ao painel.`
    : `A loja «${row.trade_name}» deixará de exibir o catálogo e o acesso ao painel administrativo fica bloqueado até a reativação.`

  useEffect(() => {
    const id = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', id)
    return () => window.removeEventListener('keydown', id)
  }, [busy, onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal
      aria-labelledby="store-toggle-dialog-title"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 id="store-toggle-dialog-title" className="font-display text-lg font-semibold text-ink-900">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={willActivate ? 'primary' : 'danger'}
            className="w-full sm:w-auto"
            loading={busy}
            onClick={onConfirm}
          >
            {willActivate ? 'Sim, ativar' : 'Sim, desativar'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
