import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { notifyInfo } from '@/lib/notify'
import { BRAND_ASSETS } from '@/lib/brandAssets'
import { getDefaultDocumentTitle } from '@/lib/documentTitle'

export function LandingPage() {
  useEffect(() => {
    document.title = getDefaultDocumentTitle()
  }, [])

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-ink-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-200/50 via-transparent to-transparent" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6">
        <Link to="/" className="inline-flex min-w-0 shrink items-center py-1" aria-label="Início">
          <img
            src={BRAND_ASSETS.logoFull}
            alt="SofáShop"
            className="h-12 w-auto max-w-[min(72vw,380px)] object-contain object-left sm:h-14 sm:max-w-[420px] md:h-16 md:max-w-[480px]"
          />
        </Link>
        <div className="flex gap-2">
          <Link to="/login" onClick={() => notifyInfo('Abrindo login.')}>
            <Button variant="secondary">Entrar</Button>
          </Link>
          <Link to="/cadastro" onClick={() => notifyInfo('Abrindo cadastro da loja.')}>
            <Button>Cadastrar loja</Button>
          </Link>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-10 md:pt-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-700">Multi-loja · Catálogo + Admin</p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-ink-900 md:text-5xl">
            Catálogo premium para sofás, com pedido direto no WhatsApp.
          </h1>
          <p className="mt-5 text-lg text-ink-600">
            Cada loja com seu link, produtos isolados, checkout completo, painel financeiro e PDF profissional — pronto
            para produção com Supabase, RLS e armazenamento seguro.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/cadastro" onClick={() => notifyInfo('Abrindo cadastro.')}>
              <Button className="px-6 py-3 text-base">Começar agora</Button>
            </Link>
            <Link to="/login" onClick={() => notifyInfo('Abrindo login.')}>
              <Button variant="secondary" className="px-6 py-3 text-base">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
