import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthRedirectSplash } from '@/components/AuthRedirectSplash'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { useAuthenticatedHomePath } from '@/hooks/useAuthenticatedHomePath'
import { resolveAuthenticatedHomePath } from '@/lib/authHomePath'
import { isRecoveryInUrl } from '@/lib/authRecovery'
import { notifyOk } from '@/lib/notify'
import { BRAND_ASSETS } from '@/lib/brandAssets'
import { getPwaBrandName } from '@/lib/documentTitle'

export function LoginPage() {
  const nav = useNavigate()
  const { homePath, loading: authRedirectLoading } = useAuthenticatedHomePath()

  useEffect(() => {
    document.title = `${getPwaBrandName()} — Entrar`
  }, [])

  useEffect(() => {
    if (isRecoveryInUrl()) {
      nav(`/redefinir-senha${window.location.hash}${window.location.search}`, { replace: true })
    }
  }, [nav])

  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      await signIn(email, password)
      const path = await resolveAuthenticatedHomePath()
      notifyOk(
        path === '/plataforma' ? 'Login realizado. Painel da plataforma.' : 'Login realizado.',
      )
      nav(path, { replace: true })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  if (authRedirectLoading) {
    return <AuthRedirectSplash />
  }

  if (homePath) {
    return <Navigate to={homePath} replace />
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 flex w-full justify-center px-1">
        <img
          src={BRAND_ASSETS.logoFull}
          alt=""
          className="h-16 w-full max-w-md object-contain sm:h-[4.5rem] md:h-20"
        />
      </div>
      <Link to="/" className="mb-6 text-sm font-medium text-brand-700 hover:underline">
        ← Voltar
      </Link>
      <Card>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Entrar</h1>
        <p className="mt-1 text-sm text-ink-500">Lojas: use o e-mail da loja. Admin da plataforma: o mesmo login leva ao painel geral.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-xs font-medium text-ink-600">E-mail</label>
            <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Senha</label>
            <Input
              className="mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <Button type="submit" className="w-full" loading={loading}>
            Entrar
          </Button>
          <Link
            to="/recuperar-senha"
            className="block w-full text-center text-sm font-medium text-brand-700 hover:underline"
          >
            Esqueci minha senha
          </Link>
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-ink-600">
        Ainda não tem loja?{' '}
        <Link className="font-semibold text-brand-700 hover:underline" to="/cadastro">
          Cadastre-se
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-ink-500">
        <Link className="font-medium text-ink-600 underline decoration-ink-300 hover:text-brand-700" to="/plataforma">
          Acesso direto ao painel da plataforma
        </Link>
        {' '}(já autenticado)
      </p>
    </div>
  )
}
