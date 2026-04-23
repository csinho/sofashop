import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from '@/integrations/supabase/env'

let browserClient: SupabaseClient | null = null

function getAdminAuthStorageKey() {
  const { url } = getSupabaseConfig()
  const host = new URL(url).host.replace(/\./g, '-')
  return `vender.auth.admin.${host}`
}

/**
 * Chave antiga do supabase-js no mesmo localStorage. Copia uma vez para a
 * chave `vender.auth.*` evitando logout de todos após a mudança.
 */
function tryMigrateAdminSessionFromLegacy() {
  if (typeof localStorage === 'undefined') return
  const newKey = getAdminAuthStorageKey()
  if (localStorage.getItem(newKey)) return
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith('sb-') && k.includes('auth')) {
      const v = localStorage.getItem(k)
      if (v) {
        localStorage.setItem(newKey, v)
        break
      }
    }
  }
}

const catalogAuthMemory = (() => {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  }
})()

/** Cliente principal: sessão do painel / dono da loja (persistSession padrão). */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    tryMigrateAdminSessionFromLegacy()
    const { url, anonKey } = getSupabaseConfig()
    browserClient = createClient(url, anonKey, {
      auth: {
        storageKey: getAdminAuthStorageKey(),
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return browserClient
}

let catalogClient: SupabaseClient | null = null

/**
 * Cliente só com JWT anon — catálogo público sem vazar sessão do admin
 * em consultas à view segura e tabelas com RLS para `anon`.
 */
export function getSupabaseCatalogClient(): SupabaseClient {
  if (!catalogClient) {
    const { url, anonKey } = getSupabaseConfig()
    catalogClient = createClient(url, anonKey, {
      auth: {
        storage: catalogAuthMemory,
        storageKey: 'vender.auth.catalog',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'X-Client-Info': 'sofas-catalog',
        },
      },
    })
  }
  return catalogClient
}
