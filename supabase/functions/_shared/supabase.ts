import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function requireStoreMember(req: Request, storeId: string): Promise<User | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 })
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401 })
  }

  const sb = getServiceClient()
  const { data: member } = await sb
    .from('store_users')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return new Response(JSON.stringify({ error: 'Sem permissão nesta loja' }), { status: 403 })
  }

  return user
}

export function isErrorResponse(v: User | Response): v is Response {
  return v instanceof Response
}

export async function requirePlatformAdmin(req: Request): Promise<User | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 })
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401 })
  }

  const sb = getServiceClient()
  const { data: adminRow } = await sb
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow) {
    return new Response(JSON.stringify({ error: 'Acesso restrito à plataforma' }), { status: 403 })
  }

  return user
}
