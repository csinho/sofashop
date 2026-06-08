import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { notifyOk } from '@/lib/notify'
import { BRAND_ASSETS } from '@/lib/brandAssets'
import { getPwaBrandName } from '@/lib/documentTitle'

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = `${getPwaBrandName()} — Recuperar senha`
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!email.trim()) {
      setErr('Informe o e-mail da sua conta.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(email.trim())
      setSent(true)
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
      <Link to="/login" className="mb-6 text-sm font-medium text-brand-700 hover:underline">
        ← Voltar ao login
      </Link>
      <Card>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Recuperar senha</h1>
        <p className="mt-1 text-sm text-ink-500">
          Informe o e-mail da loja. Enviaremos um link para você criar uma nova senha.
        </p>
        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-emerald-700">
              Enviamos um link para <strong>{email.trim()}</strong>. Abra o e-mail e clique em{' '}
              <strong>Redefinir senha</strong> — você será levado à tela de redefinição.
            </p>
            <Link to="/login">
              <Button type="button" variant="secondary" className="w-full">
                Voltar ao login
              </Button>
            </Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-medium text-ink-600">E-mail</label>
              <Input
                className="mt-1"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {err ? <p className="text-sm text-red-600">{err}</p> : null}
            <Button type="submit" className="w-full" loading={loading}>
              Enviar link de recuperação
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
