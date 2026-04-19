import { useNavigate, useOutletContext } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { IntegerField } from '@/components/ui/IntegerField'
import { formatCurrency } from '@/lib/format'
import { notifyOk } from '@/lib/notify'
import { useCart } from '@/contexts/CartContext'
import type { CatalogOutletCtx } from '@/pages/public/catalogTypes'

export function CartPage() {
  const nav = useNavigate()
  const { slug } = useOutletContext<CatalogOutletCtx>()
  const { lines, updateQty, removeLine, subtotal } = useCart()
  const storeLines = lines.filter((l) => l.storeId)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-[var(--cat-primary)]">Carrinho</h1>
      {storeLines.length === 0 ? (
        <Card className="mt-8 text-center text-sm text-ink-600">
          Seu carrinho está vazio.
          <div className="mt-4">
            <Button type="button" variant="secondary" onClick={() => nav(`/loja/${slug}`)} doneToast="Voltando ao catálogo.">
              Ver produtos
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {storeLines.map((l) => (
            <Card key={l.key} className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {l.imageUrl ? (
                <img src={l.imageUrl} alt="" className="h-24 w-32 rounded-xl object-cover ring-1 ring-ink-200" />
              ) : (
                <div className="flex h-24 w-32 items-center justify-center rounded-xl bg-ink-100 text-xs text-ink-400">
                  Sem foto
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-ink-900">{l.name}</h2>
                <p className="text-xs text-ink-500">SKU {l.sku}</p>
                {l.colorName ? <p className="text-xs text-ink-600">Cor: {l.colorName}</p> : null}
                {l.variantLabel ? <p className="text-xs text-ink-600">Var.: {l.variantLabel}</p> : null}
                <p className="mt-2 text-sm font-bold text-[var(--cat-accent)]">{formatCurrency(l.unitPrice)}</p>
              </div>
              <div className="flex items-center gap-3">
                <IntegerField
                  className="w-16 !py-1.5"
                  min={1}
                  value={String(l.qty)}
                  onValueChange={(d) => updateQty(l.key, Math.max(1, Number(d) || 1))}
                />
                <button
                  type="button"
                  className="text-xs font-medium text-red-600 hover:underline"
                  onClick={() => {
                    removeLine(l.key)
                    notifyOk('Item removido do carrinho.')
                  }}
                >
                  Remover
                </button>
              </div>
            </Card>
          ))}
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-ink-600">Subtotal</p>
              <p className="text-2xl font-bold text-[var(--cat-accent)]">{formatCurrency(subtotal)}</p>
            </div>
            <Button
              type="button"
              variant="catalog"
              className="w-full px-8 py-3 sm:w-auto"
              onClick={() => nav(`/loja/${slug}/checkout`)}
              doneToast="Indo para o checkout."
            >
              Finalizar pedido
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}
