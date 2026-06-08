import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { getPwaBrandName } from '@/lib/documentTitle'

export function RefundPolicyPage() {
  useEffect(() => {
    document.title = `${getPwaBrandName()} — Política de reembolso`
  }, [])

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <Link to="/admin/plano" className="text-sm text-brand-700 hover:underline">
          ← Voltar ao plano
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">Política de reembolso</h1>
      </div>
      <Card className="prose prose-sm max-w-none text-ink-700">
        <h2 className="font-display text-lg font-semibold text-ink-900">Prazo e valores</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Até o 10º dia</strong> (inclusive) após a confirmação do pagamento: reembolso{' '}
            <strong>integral</strong> do valor pago.
          </li>
          <li>
            <strong>A partir do 11º dia:</strong> reembolso <strong>parcial</strong>, proporcional aos dias restantes
            do ciclo de 30 dias (valor ÷ 30 × dias restantes).
          </li>
        </ul>
        <h2 className="mt-6 font-display text-lg font-semibold text-ink-900">Após o estorno</h2>
        <p className="mt-2">
          O plano passa para <strong>pendente</strong> e o catálogo pode ser pausado até um novo pagamento. O estorno é
          processado pelo painel Woovi/OpenPix; o status é atualizado automaticamente via webhook.
        </p>
        <h2 className="mt-6 font-display text-lg font-semibold text-ink-900">Como solicitar</h2>
        <p className="mt-2">
          Entre em contato com o suporte da plataforma SofáShop informando a loja e a data do pagamento. O valor
          sugerido de estorno aparece no painel da plataforma para referência.
        </p>
      </Card>
    </div>
  )
}
