/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Nome completo do app (manifest PWA, título da aba se não usar VITE_PWA_DOCUMENT_TITLE). */
  readonly VITE_PWA_NAME?: string
  /** Nome curto na tela inicial / splash (padrão: igual a VITE_PWA_NAME). */
  readonly VITE_PWA_SHORT_NAME?: string
  /** Descrição para meta description e manifest. */
  readonly VITE_PWA_DESCRIPTION?: string
  /** Título completo da aba (padrão: «nome» — Catálogo online). */
  readonly VITE_PWA_DOCUMENT_TITLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
