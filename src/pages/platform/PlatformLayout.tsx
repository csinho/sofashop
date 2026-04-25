import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { isPlatformAdmin } from '@/services/platformService'
import { BRAND_ASSETS } from '@/lib/brandAssets'
import { getPwaBrandName } from '@/lib/documentTitle'
import { notifyErr, notifyOk } from '@/lib/notify'

export function PlatformLayout() {
  const { user, loading: authLoading, signOut } = useAuth()
  const loc = useLocation()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (authLoading || !user) {
        setChecking(false)
        return
      }
      try {
        const ok = await isPlatformAdmin()
        if (alive) {
          setAllowed(ok)
        }
      } catch {
        if (alive) setAllowed(false)
      } finally {
        if (alive) setChecking(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [user, authLoading])

  if (!authLoading && !user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }

  if (authLoading || checking) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-ink-50 text-ink-500">
        Verificando acesso…
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-ink-600">
          Esta área é exclusiva para a equipe da plataforma. Se precisar de acesso, peça a inclusão do seu usuário em
          <code className="mx-1 rounded bg-ink-100 px-1 text-xs">platform_admins</code> no banco.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-brand-700 hover:underline">
          Ir ao início
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-svh min-w-0 bg-ink-100">
      <header className="min-w-0 border-b border-ink-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src={BRAND_ASSETS.logoFull} alt="" className="h-10 w-40 object-contain object-left" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Plataforma</p>
              <h1 className="font-display text-lg font-semibold text-ink-900">{getPwaBrandName()}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 shadow-sm hover:bg-ink-50"
            >
              Site
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                try {
                  await signOut()
                  notifyOk('Sessão encerrada.')
                } catch {
                  notifyErr('Não foi possível sair.')
                }
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
