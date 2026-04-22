import type { CatalogStoreRow } from '@/types/database'

export type CatalogOutletCtx = {
  store: CatalogStoreRow
  slug: string
  cartCount: number
  setBannerImageUrl: (url: string | null) => void
}
