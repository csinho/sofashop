const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export function getSupabaseConfig() {
  if (!url || !anon) {
    throw new Error(
      'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (veja .env.example).',
    )
  }
  return { url, anonKey: anon }
}
