import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { notifyOk } from '@/lib/notify'
import { BRAND_ASSETS } from '@/lib/brandAssets'
import { getPwaBrandName } from '@/lib/documentTitle'
import { isPlatformAdmin } from '@/services/platformService'

export function LoginPage() {
  useEffect(() => {
    document.title = `${getPwaBrandName()} — Entrar`
  }, [])

  const nav = useNavigate()
  const { signIn, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      await signIn(email, password)
      const master = await isPlatformAdmin()
      if (master) {
        notifyOk('Login realizado. Painel da plataforma.')
        nav('/plataforma/lojas', { replace: true })
        return
      }
      notifyOk('Login realizado.')
      nav('/admin', { replace: true })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  async function onRecover() {
    setErr(null)
    setRecoverMsg(null)
    if (!email.trim()) {
      setErr('Informe o e-mail para recuperação.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(email.trim())
      setRecoverMsg('Enviamos um link de recuperação para o seu e-mail.')
      notifyOk('E-mail de recuperação enviado.')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha ao solicitar recuperação.')
    } finally {
      setLoading(false)
    }
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
          {recoverMsg ? <p className="text-sm text-emerald-700">{recoverMsg}</p> : null}
          <Button type="submit" className="w-full" loading={loading}>
            Entrar
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm font-medium text-brand-700 hover:underline"
            onClick={onRecover}
          >
            Recuperar senha
          </button>
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-ink-600">
        Ainda não tem loja?{' '}
        <Link className="font-semibold text-brand-700 hover:underline" to="/cadastro">
          Cadastre-se
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-ink-500">
        <Link className="font-medium text-ink-600 underline decoration-ink-300 hover:text-brand-700" to="/plataforma/lojas">
          Acesso direto ao painel da plataforma
        </Link>
        {' '}(já autenticado)
      </p>
    </div>
  )
}
