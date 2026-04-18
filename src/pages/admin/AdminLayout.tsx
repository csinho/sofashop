import { useEffect } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  Armchair,
  Copy,
  CreditCard,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useMyStore } from '@/hooks/useMyStore'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { notifyErr, notifyOk } from '@/lib/notify'

const nav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/produtos', label: 'Produtos', icon: Package },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/financeiro', label: 'Financeiro', icon: CreditCard },
  { to: '/admin/dados-catalogo', label: 'Dados do catálogo', icon: Database },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
]

export function AdminLayout() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { store, loading: storeLoading } = useMyStore()
  const loc = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [loc.pathname])

  if (!authLoading && !user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }

  if (!authLoading && !storeLoading && user && !store) {
    return <Navigate to="/cadastro" replace />
  }

  if (authLoading || storeLoading || !store) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-ink-50 text-ink-500">
        Carregando painel…
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
        <div className="flex h-14 items-center justify-between border-b border-ink-100 px-4 lg:h-16">
          <Link to="/admin" className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
            <Armchair className="h-6 w-6 text-brand-600" />
            SofáShop
          </Link>
          <button type="button" className="rounded-lg p-2 hover:bg-ink-100 lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const isActive = item.end ? loc.pathname === '/admin' : loc.pathname.startsWith(item.to)
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
          <p className="truncate px-1 text-xs font-medium text-ink-600">{store.trade_name}</p>
          <Button
            variant="ghost"
            className="mt-2 w-full justify-start gap-2 px-2 text-ink-600"
            onClick={async () => {
              try {
                await signOut()
                notifyOk('Sessão encerrada.')
              } catch {
                notifyErr('Não foi possível sair. Tente novamente.')
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:ml-0">
        <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 bg-white/90 px-4 backdrop-blur lg:h-16 lg:px-8">
          <button type="button" className="rounded-lg p-2 hover:bg-ink-100 lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <a
              href={`${window.location.origin}/loja/${store.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Catálogo da Loja
            </a>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-800 shadow-sm hover:bg-ink-50"
              onClick={async () => {
                const url = `${window.location.origin}/loja/${store.slug}`
                try {
                  await navigator.clipboard.writeText(url)
                  notifyOk('Link do catálogo copiado.')
                } catch {
                  notifyErr('Não foi possível copiar o link.')
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar link
            </button>
          </div>
        </header>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Outlet context={{ store }} />
          </div>
        </main>
      </div>
    </div>
  )
}
