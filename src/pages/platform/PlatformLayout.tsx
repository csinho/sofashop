import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, LogOut, Menu, Settings, Store, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { isPlatformAdmin } from '@/services/platformService'
import { BRAND_ASSETS } from '@/lib/brandAssets'
import { getDefaultDocumentTitle, getPwaBrandName } from '@/lib/documentTitle'
import { notifyErr, notifyOk } from '@/lib/notify'

const nav = [
  { to: '/plataforma', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/plataforma/lojas', label: 'Lojas', icon: Store },
  { to: '/plataforma/configuracoes', label: 'Configurações', icon: Settings },
]

export function PlatformLayout() {
  const { user, loading: authLoading, signOut } = useAuth()
  const loc = useLocation()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [loc.pathname])

  useEffect(() => {
    document.title = `${getPwaBrandName()} — Plataforma`
    return () => {
      document.title = getDefaultDocumentTitle()
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (authLoading || !user) {
        setChecking(false)
        return
      }
      try {
        const ok = await isPlatformAdmin()
        if (alive) setAllowed(ok)
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
    <div className="flex min-h-svh flex-col bg-ink-50 lg:h-svh lg:min-h-0 lg:flex-row lg:overflow-hidden">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-svh w-64 shrink-0 flex-col border-r border-ink-200 bg-white transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="relative z-20 flex h-12 shrink-0 items-center justify-between gap-1.5 border-b border-ink-100 px-2 lg:h-14 lg:px-3">
          <Link to="/plataforma" className="relative flex min-w-0 flex-1 items-center overflow-visible" aria-label="Dashboard">
            <img
              src={BRAND_ASSETS.logoFull}
              alt=""
              className="h-10 w-full max-w-[calc(100%-2.5rem)] origin-left scale-[1.42] object-contain object-left sm:h-11 sm:scale-[1.36] lg:h-12 lg:scale-[1.3] lg:max-w-none"
            />
          </Link>
          <button type="button" className="rounded-lg p-2 hover:bg-ink-100 lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Plataforma</p>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {nav.map((item) => {
            const isActive = item.end
              ? loc.pathname === '/plataforma' || loc.pathname === '/plataforma/'
              : loc.pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-700 hover:bg-ink-100',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="shrink-0 border-t border-ink-100 p-3">
          <Link
            to="/"
            className="mb-2 block px-1 text-xs font-medium text-brand-700 hover:underline"
          >
            Site público
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-2 text-ink-600"
            onClick={async () => {
              try {
                await signOut()
                notifyOk('Sessão encerrada.')
              } catch {
                notifyErr('Não foi possível sair.')
              }
            }}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 bg-white/90 px-4 backdrop-blur lg:h-16 lg:px-8">
          <button type="button" className="rounded-lg p-2 hover:bg-ink-100 lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm font-medium text-ink-600 lg:hidden">Plataforma</p>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
