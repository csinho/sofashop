import type { CatalogStoreRow } from '@/types/database'

export type CatalogOutletCtx = {
  store: CatalogStoreRow
  slug: string
}
