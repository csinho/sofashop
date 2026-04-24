import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type CartLine = {
  key: string
  storeId: string
  productId: string
  variantId: string | null
  name: string
  sku: string
  qty: number
  unitPrice: number
  imageUrl?: string
  colorName?: string
  variantLabel?: string
  warranty?: string
}

type CartCtx = {
  storeId: string | null
  lines: CartLine[]
  setStore: (id: string) => void
  addLine: (line: Omit<CartLine, 'key'>) => void
  updateQty: (key: string, qty: number) => void
  removeLine: (key: string) => void
  clear: () => void
  subtotal: number
}

const Ctx = createContext<CartCtx | null>(null)

function storageKey(storeId: string) {
  return `sofas_cart_${storeId}`
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [storeId, setStoreIdState] = useState<string | null>(null)
  const [lines, setLines] = useState<CartLine[]>([])

  const setStore = useCallback((id: string) => {
    setStoreIdState(id)
    try {
      const raw = localStorage.getItem(storageKey(id))
      setLines(raw ? (JSON.parse(raw) as CartLine[]) : [])
    } catch {
      setLines([])
    }
  }, [])

  useEffect(() => {
    if (!storeId) return
    try {
      localStorage.setItem(storageKey(storeId), JSON.stringify(lines))
    } catch {
      /* ignore */
    }
  }, [storeId, lines])

  const addLine = useCallback((line: Omit<CartLine, 'key'>) => {
    if (!line.storeId) return
    const key = `${line.productId}:${line.variantId ?? 'base'}`
    setLines((prev) => {
      const sameStore = prev.length === 0 || prev[0]!.storeId === line.storeId
      const base = sameStore ? prev : []
      const idx = base.findIndex((l) => l.key === key)
      if (idx >= 0) {
        const next = [...base]
        const cur = next[idx]!
        next[idx] = {
          ...cur,
          qty: cur.qty + line.qty,
          unitPrice: line.unitPrice,
          sku: line.sku,
          imageUrl: line.imageUrl,
          colorName: line.colorName,
          variantLabel: line.variantLabel,
          warranty: line.warranty,
        }
        return next
      }
      return [...base, { ...line, key }]
    })
    setStoreIdState(line.storeId)
  }, [])

  const updateQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: Math.max(1, qty) } : l))
        .filter((l) => l.qty > 0),
    )
  }, [])

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }, [])

  const clear = useCallback(() => {
    setLines([])
    if (storeId) {
      try {
        localStorage.removeItem(storageKey(storeId))
      } catch {
        /* ignore */
      }
    }
  }, [storeId])

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0), [lines])

  const value = useMemo<CartCtx>(
    () => ({
      storeId,
      lines,
      setStore,
      addLine,
      updateQty,
      removeLine,
      clear,
      subtotal,
    }),
    [storeId, lines, setStore, addLine, updateQty, removeLine, clear, subtotal],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCart fora do CartProvider')
  return v
}
