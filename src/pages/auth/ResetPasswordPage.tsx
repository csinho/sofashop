import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { isRecoveryInUrl } from '@/lib/authRecovery'
import { notifyOk } from '@/lib/notify'
import { BRAND_ASSETS } from '@/lib/brandAssets'
import { getPwaBrandName } from '@/lib/documentTitle'
import { isPlatformAdmin } from '@/services/platformService'

export function ResetPasswordPage() {
  const nav = useNavigate()
  const { updatePassword, session, loading: authLoading, recoveryPending, clearRecoveryMode } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = `${getPwaBrandName()} — Redefinir senha`
  }, [])

  const canReset = Boolean(session) || recoveryPending || isRecoveryInUrl()

  useEffect(() => {
    if (!authLoading && !canReset) {
      clearRecoveryMode()
    }
  }, [authLoading, canReset, clearRecoveryMode])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)

    if (!canReset) {
      setErr('Use o link enviado por e-mail ou solicite um novo.')
      return
    }

    if (password.length < 6) {
      setErr('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setErr('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      await updatePassword(password)
      notifyOk('Senha redefinida com sucesso.')
      const master = await isPlatformAdmin()
      nav(master ? '/plataforma/lojas' : '/admin', { replace: true })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível redefinir a senha.')
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
        <h1 className="font-display text-2xl font-semibold text-ink-900">Redefinir senha</h1>

        {authLoading ? (
          <p className="mt-4 text-sm text-ink-500">Validando link de recuperação…</p>
        ) : canReset ? (
          <>
            <p className="mt-1 text-sm text-ink-500">Escolha uma nova senha para a sua conta.</p>
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="text-xs font-medium text-ink-600">Nova senha</label>
                <Input
                  className="mt-1"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600">Confirmar nova senha</label>
                <Input
                  className="mt-1"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
              {err ? <p className="text-sm text-red-600">{err}</p> : null}
              <Button type="submit" className="w-full" loading={loading}>
                Salvar nova senha
              </Button>
            </form>
          </>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-ink-600">
              Para redefinir a senha, abra o link que enviamos para o seu e-mail. Se o link expirou ou você
              ainda não solicitou, peça um novo abaixo.
            </p>
            <Link to="/recuperar-senha">
              <Button type="button" className="w-full">
                Solicitar link de recuperação
              </Button>
            </Link>
            <Link to="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">
              Voltar ao login
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}
