import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { CatalogOutletCtx } from '@/pages/public/catalogTypes'

export function ThankYouPage() {
  const nav = useNavigate()
  const { slug } = useOutletContext<CatalogOutletCtx>()
  const loc = useLocation() as { state?: { orderNumber?: string } }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <Card>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Pedido registrado</h1>
        <p className="mt-3 text-sm text-ink-600">
          Seu pedido <strong>{loc.state?.orderNumber ?? '—'}</strong> foi salvo. Enviamos você para o WhatsApp da loja com
          todos os detalhes.
        </p>
        <p className="mt-2 text-xs text-ink-500">Se a janela não abriu, verifique o bloqueador de pop-ups.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => nav(`/loja/${slug}`)}
            doneToast="Voltando ao catálogo."
          >
            Continuar comprando
          </Button>
        </div>
      </Card>
    </div>
  )
}
