import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { isPlatformAdmin } from '@/services/platformService'

/** Rota inicial após login ou ao reabrir o app com sessão ativa. */
export async function resolveAuthenticatedHomePath(): Promise<string> {
  if (await isPlatformAdmin()) return '/plataforma'

  const sb = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return '/login'

  const { data } = await sb
    .from('store_users')
    .select('store_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  return data?.store_id ? '/admin' : '/cadastro'
}
