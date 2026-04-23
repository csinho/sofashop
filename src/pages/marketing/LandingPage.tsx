import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageCircle,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { notifyInfo } from '@/lib/notify'
import { BRAND_ASSETS } from '@/lib/brandAssets'
import { getDefaultDocumentTitle } from '@/lib/documentTitle'
import { getPreferredPwaStartPath, isStandaloneDisplay } from '@/lib/pwaEntry'

export function LandingPage() {
  useEffect(() => {
    document.title = getDefaultDocumentTitle()
  }, [])

  if (isStandaloneDisplay()) {
    const start = getPreferredPwaStartPath()
    if (start) {
      return <Navigate to={start} replace />
    }
  }

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
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-8 md:pt-12">
        <section className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              <Sparkles className="h-3.5 w-3.5" />
              Plataforma para lojas de estofados
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-ink-900 md:text-5xl">
              Venda mais e organize sua loja de estofados em um único sistema.
            </h1>
            <p className="mt-4 text-base text-ink-600 md:text-lg">
              Catálogo online para seus clientes comprarem com facilidade e painel completo para você controlar produtos, pedidos,
              clientes e financeiro.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/cadastro" onClick={() => notifyInfo('Abrindo cadastro.')}>
                <Button className="px-6 py-3 text-base">
                  Criar minha loja
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="https://sofashop.digital/loja/do-bras" target="_blank" rel="noreferrer" onClick={() => notifyInfo('Abrindo demonstração.')}>
                <Button type="button" variant="secondary" className="px-6 py-3 text-base">
                  Ver demonstração
                </Button>
              </a>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-ink-600 md:max-w-xl md:grid-cols-3">
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Link próprio da loja
              </p>
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Pedidos organizados
              </p>
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                PDF do pedido
              </p>
            </div>
          </div>

          <Card className="overflow-hidden border-brand-100 bg-white p-0 shadow-md">
            <div className="grid grid-cols-2 gap-0.5 bg-ink-100">
              <div className="bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Catálogo online</p>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl bg-ink-50 p-2 text-xs text-ink-600">Produtos com variações</div>
                  <div className="rounded-xl bg-ink-50 p-2 text-xs text-ink-600">Carrinho e checkout</div>
                  <div className="rounded-xl bg-ink-50 p-2 text-xs text-ink-600">Pedido pelo WhatsApp</div>
                </div>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Painel da loja</p>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl bg-ink-50 p-2 text-xs text-ink-600">Produtos e variações</div>
                  <div className="rounded-xl bg-ink-50 p-2 text-xs text-ink-600">Gestão de clientes</div>
                  <div className="rounded-xl bg-ink-50 p-2 text-xs text-ink-600">Financeiro e relatórios</div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Store, title: 'Catálogo profissional', text: 'Mostre todos os estofados com mais clareza e valor.' },
            { icon: ClipboardList, title: 'Pedidos organizados', text: 'Acompanhe cada etapa da venda sem perder informações.' },
            { icon: Users, title: 'Clientes centralizados', text: 'Tenha histórico e relacionamento em um só lugar.' },
            { icon: FileText, title: 'PDF do pedido', text: 'Formalize o pedido e passe mais confiança no atendimento.' },
          ].map((item) => (
            <Card key={item.title} className="p-4">
              <item.icon className="h-5 w-5 text-brand-700" />
              <p className="mt-3 font-semibold text-ink-900">{item.title}</p>
              <p className="mt-1 text-sm text-ink-600">{item.text}</p>
            </Card>
          ))}
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">Você não precisa escolher entre vender e organizar</h2>
          <p className="mt-2 max-w-2xl text-ink-600">
            O SofáShop une as duas partes da operação: experiência de compra para o cliente final e gestão para a sua equipe.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                <Smartphone className="h-4 w-4" />
                Para seu cliente final
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ink-700">
                <li>• Navega no catálogo da sua loja com visual moderno.</li>
                <li>• Escolhe variações, adiciona ao carrinho e finaliza pedido.</li>
                <li>• Recebe atendimento mais rápido e organizado.</li>
              </ul>
            </Card>
            <Card className="p-5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                <LayoutDashboard className="h-4 w-4" />
                Para sua operação
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ink-700">
                <li>• Cadastra produtos, modelos, cores e preços com facilidade.</li>
                <li>• Acompanha pedidos por etapa em visual de quadro.</li>
                <li>• Controla clientes, financeiro e documentos em um só sistema.</li>
              </ul>
            </Card>
          </div>
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-3">
          <Card className="p-5">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
              <ShoppingCart className="h-4 w-4" />
              Catálogo que converte
            </p>
            <p className="mt-3 text-sm text-ink-700">
              Produtos com imagens, variações e preços claros para facilitar a decisão de compra.
            </p>
          </Card>
          <Card className="p-5">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
              <BarChart3 className="h-4 w-4" />
              Gestão de ponta a ponta
            </p>
            <p className="mt-3 text-sm text-ink-700">
              Do cadastro ao fechamento do pedido, sua equipe ganha controle e previsibilidade.
            </p>
          </Card>
          <Card className="p-5">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
              <MessageCircle className="h-4 w-4" />
              Atendimento mais profissional
            </p>
            <p className="mt-3 text-sm text-ink-700">
              Menos retrabalho, mais confiança para o cliente e mais tempo para vender.
            </p>
          </Card>
        </section>

        <section className="mt-14 rounded-3xl border border-ink-200 bg-white p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">Perguntas frequentes</h2>
          <div className="mt-5 space-y-4">
            {[
              {
                q: 'O SofáShop serve apenas para lojas de sofá?',
                a: 'Não. A plataforma atende lojas de estofados em geral: sofás, poltronas, puffs, cabeceiras, colchões e outros produtos relacionados.',
              },
              {
                q: 'Meu cliente consegue fazer pedido pelo catálogo?',
                a: 'Sim. Ele navega pelos produtos, adiciona ao carrinho e envia o pedido de forma organizada.',
              },
              {
                q: 'Eu consigo gerenciar a operação da loja no painel?',
                a: 'Sim. Você controla produtos, pedidos, clientes, financeiro e ainda gera PDF do pedido.',
              },
              {
                q: 'Funciona bem no celular?',
                a: 'Sim. O catálogo e o painel foram desenhados com foco mobile-first para uso no dia a dia.',
              },
            ].map((item) => (
              <Card key={item.q} className="p-4">
                <p className="font-semibold text-ink-900">{item.q}</p>
                <p className="mt-1.5 text-sm text-ink-600">{item.a}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-3xl bg-ink-900 px-6 py-10 text-white md:px-10">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-200">
            <BadgeCheck className="h-4 w-4" />
            Pronto para profissionalizar sua loja?
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-4xl">
            Transforme seu catálogo em vendas e sua operação em resultado.
          </h2>
          <p className="mt-3 max-w-2xl text-white/80">
            Crie sua loja no SofáShop e tenha catálogo online + sistema administrativo completo em um só lugar.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/cadastro" onClick={() => notifyInfo('Abrindo cadastro.')}>
              <Button className="px-6 py-3 text-base">Criar minha loja agora</Button>
            </Link>
            <Link to="/login" onClick={() => notifyInfo('Abrindo login.')}>
              <Button variant="secondary" className="px-6 py-3 text-base">
                Já sou cliente
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
