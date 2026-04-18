import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from '@/integrations/supabase/env'

let browserClient: SupabaseClient | null = null

/** Cliente principal: sessão do painel / dono da loja (persistSession padrão). */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { url, anonKey } = getSupabaseConfig()
    browserClient = createClient(url, anonKey, {
      auth: {
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
