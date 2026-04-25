import { useEffect, useMemo, useState } from 'react'

/** 10 itens por página; paginação visível só com 11+ itens (regra do admin / plataforma). */
export const LIST_PAGE_SIZE = 10

export function useListPagination<T>(items: T[]) {
  const [page, setPage] = useState(1)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE))
  const showPagination = total >= 11
  const pageClamped = Math.min(Math.max(1, page), pageCount)

  const pageItems = useMemo(() => {
    const start = (pageClamped - 1) * LIST_PAGE_SIZE
    return items.slice(start, start + LIST_PAGE_SIZE)
  }, [items, pageClamped])

  useEffect(() => {
    setPage((p) => {
      const last = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE))
      if (p > last) return last
      if (p < 1) return 1
      return p
    })
  }, [items.length])

  return {
    pageItems,
    page: pageClamped,
    setPage,
    pageCount,
    showPagination,
    total,
  }
}
