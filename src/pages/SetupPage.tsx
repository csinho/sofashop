export function SetupPage() {
  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 px-4 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-900">Configurar Supabase</h1>
      <p className="text-sm leading-relaxed text-ink-600">
        Crie o arquivo <code className="rounded bg-ink-100 px-1">.env</code> na raiz do projeto com{' '}
        <code className="rounded bg-ink-100 px-1">VITE_SUPABASE_URL</code> e{' '}
        <code className="rounded bg-ink-100 px-1">VITE_SUPABASE_ANON_KEY</code>. Copie de Project Settings →
        API no painel do Supabase. Use apenas a chave <strong>anon</strong> no frontend.
      </p>
      <p className="text-sm text-ink-600">
        Consulte <code className="rounded bg-ink-100 px-1">SUPABASE.md</code> para SQL, RLS, Storage e deploy.
      </p>
    </div>
  )
}
