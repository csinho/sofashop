/** Título padrão da aba (espelha a lógica do `vite.config` / `index.html` nos env Vite). */
export function getDefaultDocumentTitle(): string {
  const doc = import.meta.env.VITE_PWA_DOCUMENT_TITLE?.trim()
  if (doc) return doc
  const name = (import.meta.env.VITE_PWA_NAME || 'SofáShop').trim() || 'SofáShop'
  return `${name} — Catálogo online`
}

export function getPwaBrandName(): string {
  return (import.meta.env.VITE_PWA_NAME || 'SofáShop').trim() || 'SofáShop'
}
