import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatCurrency } from '@/lib/format'
import type { CartPriceChange } from '@/services/cartPriceValidation'

type Props = {
  open: boolean
  changes: CartPriceChange[]
  busy?: boolean
  onAccept: () => void
  onReject: () => void
}

export function CartPriceChangeDialog({ open, changes, busy, onAccept, onReject }: Props) {
  const totalOld = changes.reduce((s, c) => s + c.oldPrice * c.qty, 0)
  const totalNew = changes.reduce((s, c) => s + c.newPrice * c.qty, 0)
  const diff = totalNew - totalOld

  return (
    <ConfirmDialog
      open={open}
      title="Preços atualizados"
      confirmLabel="Aceito os novos valores"
      cancelLabel="Não aceito — voltar ao carrinho"
      confirmVariant="primary"
      busy={busy}
      onClose={onReject}
      onConfirm={onAccept}
      description={
        <div className="space-y-3">
          <p>
            Um ou mais produtos do seu carrinho tiveram o preço alterado na loja. Confira abaixo e escolha se deseja
            continuar com os valores atuais.
          </p>
          <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-ink-200 bg-ink-50/80 p-3 text-xs">
            {changes.map((c) => (
              <li key={c.key}>
                <p className="font-medium text-ink-900">{c.name}</p>
                {c.variantLabel ? <p className="text-ink-600">Var.: {c.variantLabel}</p> : null}
                <p className="text-ink-700">
                  {formatCurrency(c.oldPrice)} → <strong>{formatCurrency(c.newPrice)}</strong>
                  {c.qty > 1 ? ` (${c.qty} un.)` : ''}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium text-ink-800">
            Diferença no carrinho: {diff >= 0 ? '+' : ''}
            {formatCurrency(diff)}
          </p>
          <p className="text-xs text-ink-500">
            Se não aceitar, volte ao carrinho e remova ou ajuste os itens antes de finalizar o pedido.
          </p>
        </div>
      }
    />
  )
}
