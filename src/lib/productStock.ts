export type VariantStockRow = {
  id: string
  stock: number | null
  is_active?: boolean
}

/** Soma o estoque alocado nas variações (ignora stock null). */
export function allocatedStock(variants: VariantStockRow[], excludeId?: string | null): number {
  return variants.reduce((sum, v) => {
    if (excludeId && v.id === excludeId) return sum
    if (v.stock == null) return sum
    return sum + v.stock
  }, 0)
}

/** Estoque livre para alocar em uma nova/edição de variação. */
export function freeStock(
  productStock: number | null | undefined,
  variants: VariantStockRow[],
  excludeId?: string | null,
): number | null {
  if (productStock == null) return null
  const allocated = allocatedStock(variants, excludeId)
  return Math.max(productStock - allocated, 0)
}

export function parseStockInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed.replace(/\D/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

export function catalogAvailableQty(opts: {
  productStock: number | null | undefined
  hasVariants: boolean
  variantStock: number | null | undefined
}): number | null {
  const { productStock, hasVariants, variantStock } = opts
  if (productStock == null) return null
  if (hasVariants) {
    if (variantStock == null) return 0
    return variantStock
  }
  return productStock
}
