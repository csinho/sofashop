import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { IntegerField } from '@/components/ui/IntegerField'
import { formatCurrency } from '@/lib/format'
import { notifyOk } from '@/lib/notify'
import { useCart } from '@/contexts/CartContext'
import type { CatalogOutletCtx } from '@/pages/public/catalogTypes'
import { fetchCartPriceChanges, type CartPriceChange } from '@/services/cartPriceValidation'
import { useStoreCatalogRealtime } from '@/hooks/useStoreCatalogRealtime'

export function CartPage() {
  const nav = useNavigate()
  const { store, slug } = useOutletContext<CatalogOutletCtx>()
  const { lines, updateQty, removeLine, updateLinePrices, subtotal } = useCart()
  const storeLines = lines.filter((l) => l.storeId === store.id)
  const [priceChanges, setPriceChanges] = useState<CartPriceChange[]>([])

  const checkPrices = useCallback(async () => {
    if (!storeLines.length) {
      setPriceChanges([])
      return
    }
    try {
      const changes = await fetchCartPriceChanges(store.id, storeLines)
      setPriceChanges(changes)
    } catch {
      /* rede: não bloqueia carrinho */
    }
  }, [store.id, storeLines])

  useEffect(() => {
    void checkPrices()
  }, [checkPrices])

  useStoreCatalogRealtime(store.id, () => {
    void checkPrices()
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-[var(--cat-primary)]">Carrinho</h1>
      {storeLines.length === 0 ? (
        <Card className="mt-8 text-center text-sm text-ink-600">
          Seu carrinho está vazio.
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              tooltip="Voltar ao catálogo para continuar comprando."
              onClick={() => nav(`/loja/${slug}`)}
              doneToast="Voltando ao catálogo."
            >
              Ver produtos
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {priceChanges.length > 0 ? (
            <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Preços atualizados na loja</p>
              <p className="mt-1 text-xs">
                Alguns itens mudaram de valor desde que entraram no carrinho. Atualize para ver o total correto antes do
                checkout.
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {priceChanges.map((c) => (
                  <li key={c.key}>
                    {c.name}: {formatCurrency(c.oldPrice)} → <strong>{formatCurrency(c.newPrice)}</strong>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  tooltip="Aplicar os preços atuais da loja aos itens do carrinho."
                  onClick={() => {
                    updateLinePrices(priceChanges.map((c) => ({ key: c.key, unitPrice: c.newPrice })))
                    setPriceChanges([])
                  }}
                >
                  Atualizar preços no carrinho
                </Button>
                <Link to={`/loja/${slug}`} className="text-xs font-medium text-amber-900 underline">
                  Voltar ao catálogo
                </Link>
              </div>
            </Card>
          ) : null}
          {storeLines.map((l) => (
            <Card key={l.key} className="flex items-start gap-3 p-3 sm:gap-4 sm:p-5">
              {l.imageUrl ? (
                <img src={l.imageUrl} alt="" className="h-24 w-24 rounded-xl object-cover ring-1 ring-ink-200 sm:h-24 sm:w-32" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-ink-100 text-xs text-ink-400 sm:w-32">
                  Sem foto
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-ink-900">{l.name}</h2>
                <p className="text-xs text-ink-500">SKU {l.sku}</p>
                {l.colorName ? <p className="text-xs text-ink-600">Cor: {l.colorName}</p> : null}
                {l.variantLabel ? <p className="text-xs text-ink-600">Var.: {l.variantLabel}</p> : null}
                <p className="mt-2 text-sm font-bold" style={{ color: '#000000' }}>
                  {formatCurrency(l.unitPrice)}
                </p>
                <p className="mt-1 text-xs text-ink-600">
                  {l.qty} x {formatCurrency(l.unitPrice)} = <strong>{formatCurrency(l.qty * l.unitPrice)}</strong>
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  className="hidden h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50 sm:inline-flex"
                  title="Remover este item do carrinho."
                  onClick={() => {
                    removeLine(l.key)
                    notifyOk('Item removido do carrinho.')
                  }}
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="hidden items-center gap-3 sm:flex">
                  <IntegerField
                    className="w-16 !py-1.5"
                    min={1}
                    max={l.maxQty}
                    value={String(l.qty)}
                    onValueChange={(d) => updateQty(l.key, Math.max(1, Number(d) || 1))}
                  />
                  <button
                    type="button"
                    className="text-xs font-medium text-red-600 hover:underline"
                    title="Remover este item do carrinho."
                    onClick={() => {
                      removeLine(l.key)
                      notifyOk('Item removido do carrinho.')
                    }}
                  >
                    Remover
                  </button>
                </div>

                <div className="inline-flex items-center rounded-full border border-ink-200 bg-white sm:hidden">
                  {l.qty <= 1 ? (
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center text-red-500"
                      title="Remover este item do carrinho."
                      onClick={() => {
                        removeLine(l.key)
                        notifyOk('Item removido do carrinho.')
                      }}
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center text-ink-700"
                      title="Diminuir a quantidade deste item."
                      onClick={() => updateQty(l.key, l.qty - 1)}
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <span className="min-w-7 text-center text-sm font-semibold text-ink-900">{String(l.qty).padStart(2, '0')}</span>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center text-ink-700"
                    title="Aumentar a quantidade deste item."
                    onClick={() => updateQty(l.key, l.qty + 1)}
                    disabled={l.maxQty != null && l.qty >= l.maxQty}
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-ink-600">Subtotal</p>
              <p className="text-2xl font-bold" style={{ color: '#000000' }}>
                {formatCurrency(subtotal)}
              </p>
            </div>
            <Button
              type="button"
              variant="catalog"
              className="w-full bg-[var(--cat-primary)] px-8 py-3 hover:opacity-95 focus-visible:outline-[var(--cat-primary)] sm:w-auto"
              tooltip="Ir para o checkout com os itens do carrinho."
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
