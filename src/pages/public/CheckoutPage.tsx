import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { maskCep, maskPhone } from '@/lib/masks'
import { onlyDigits } from '@/lib/format'
import { validateBrazilPhone } from '@/lib/validators/phone'
import { fetchAddressByCep } from '@/integrations/viacep'
import { useCart } from '@/contexts/CartContext'
import { resolveCatalogCustomer, submitCheckout, type ResolvedCatalogCustomer } from '@/services/checkoutService'
import { loadCheckoutIdentity, saveCheckoutIdentity } from '@/lib/catalogCheckoutStorage'
import { buildWhatsAppMessage, openWhatsApp } from '@/services/whatsappMessage'
import type { PaymentKind } from '@/types/database'
import type { CatalogOutletCtx } from '@/pages/public/catalogTypes'
import { formatCurrency } from '@/lib/format'
import { resolveCheckoutConfig } from '@/lib/checkoutConfig'
import { MoneyField } from '@/components/ui/MoneyField'
import { parseMoneyBRL } from '@/lib/moneyInput'
import { PAYMENT_LABEL } from '@/constants/payments'
import { IntegerField } from '@/components/ui/IntegerField'
import { notifyOk } from '@/lib/notify'

export function CheckoutPage() {
  const { store, slug } = useOutletContext<CatalogOutletCtx>()
  const nav = useNavigate()
  const { lines, subtotal, clear } = useCart()
  const storeLines = lines.filter((l) => l.storeId === store.id)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneSecondary, setPhoneSecondary] = useState('')
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [stateUf, setStateUf] = useState('SP')
  const [notes, setNotes] = useState('')

  const [payKind, setPayKind] = useState<PaymentKind>('pix')
  const [installments, setInstallments] = useState('6')
  const [down, setDown] = useState('')

  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const payCfg = useMemo(() => resolveCheckoutConfig(store), [store.id, store.checkout_payment_config])

  const applyResolved = useCallback((r: ResolvedCatalogCustomer) => {
    setFullName(r.full_name)
    setPhone(maskPhone(r.phone))
    setPhoneSecondary(r.phone_secondary ? maskPhone(r.phone_secondary) : '')
    setCep(maskCep(r.cep))
    setStreet(r.street)
    setNumber(r.number)
    setComplement(r.complement)
    setDistrict(r.district)
    setCity(r.city)
    setStateUf((r.state || 'SP').slice(0, 2).toUpperCase())
  }, [])

  useEffect(() => {
    let cancelled = false
    const saved = loadCheckoutIdentity(store.id)
    if (saved) {
      setFullName(saved.fullName)
      setPhone(maskPhone(saved.phone))
      setPhoneSecondary(saved.phoneSecondary ? maskPhone(saved.phoneSecondary) : '')
      setCep(maskCep(saved.cep))
      setStreet(saved.street)
      setNumber(saved.number)
      setComplement(saved.complement)
      setDistrict(saved.district)
      setCity(saved.city)
      setStateUf((saved.state || 'SP').slice(0, 2).toUpperCase())
    }
    if (saved?.customerId) {
      void (async () => {
        try {
          const r = await resolveCatalogCustomer(store.id, { customerId: saved.customerId })
          if (cancelled || !r) return
          applyResolved(r)
        } catch {
          /* rede indisponível: mantém dados do armazenamento local */
        }
      })()
    }
    return () => {
      cancelled = true
    }
  }, [store.id, applyResolved])

  useEffect(() => {
    if (!payCfg.accepted_methods.includes(payKind)) {
      setPayKind(payCfg.accepted_methods[0] ?? 'pix')
    }
  }, [store.id, payCfg, payKind])

  const tryResolveByPhone = useCallback(async () => {
    const pv = validateBrazilPhone(phone)
    if (!pv.ok) return
    try {
      const r = await resolveCatalogCustomer(store.id, { phone })
      if (r) applyResolved(r)
    } catch {
      /* silencioso */
    }
  }, [store.id, phone, applyResolved])

  async function onCepBlur() {
    const c = onlyDigits(cep)
    if (c.length !== 8) return
    try {
      const a = await fetchAddressByCep(c)
      setStreet(a.logradouro || '')
      setDistrict(a.bairro || '')
      setCity(a.localidade || '')
      setStateUf(a.uf || 'SP')
    } catch {
      setErr('CEP inválido ou não encontrado.')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (storeLines.length === 0) {
      setErr('Seu carrinho está vazio.')
      return
    }
    const pv = validateBrazilPhone(phone)
    if (!pv.ok) {
      setErr(pv.message ?? 'Telefone inválido')
      return
    }
    const secTrim = phoneSecondary.trim()
    if (secTrim) {
      const pv2 = validateBrazilPhone(phoneSecondary)
      if (!pv2.ok) {
        setErr(pv2.message ?? 'Telefone alternativo inválido')
        return
      }
    }

    const paymentDetails: Record<string, number> = {}
    if (payKind === 'parcelado') {
      paymentDetails.installments = Math.max(2, Number(installments.replace(/\D/g, '')) || 2)
    }
    if (payKind === 'entrada_parcelado') {
      const dp = parseMoneyBRL(down)
      if (dp <= 0) {
        setErr('Informe o valor da entrada.')
        return
      }
      paymentDetails.down_payment = dp
      paymentDetails.installments = Math.max(2, Number(installments.replace(/\D/g, '')) || 2)
    }

    setLoading(true)
    try {
      const result = await submitCheckout({
        storeId: store.id,
        customer: {
          full_name: fullName.trim(),
          phone,
          ...(secTrim ? { phone_secondary: phoneSecondary } : {}),
        },
        shipping: {
          cep: onlyDigits(cep),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          district: district.trim(),
          city: city.trim(),
          state: stateUf,
        },
        paymentKind: payKind,
        paymentDetails,
        notes,
        lines: storeLines,
      })

      const created = new Date().toISOString()
      const msg = buildWhatsAppMessage({
        orderNumber: result.order_number,
        customerName: fullName.trim(),
        customerPhone: phone,
        ...(secTrim ? { customerPhoneSecondary: phoneSecondary } : {}),
        addressLines: [
          `${street}, ${number}${complement ? ' — ' + complement : ''}`,
          `${district} — ${city}/${stateUf} — CEP ${onlyDigits(cep)}`,
        ],
        lines: storeLines,
        subtotal,
        paymentKind: payKind,
        paymentDetails,
        notes,
        createdAtIso: created,
      })

      notifyOk('Pedido registrado. Abrindo o WhatsApp…')
      saveCheckoutIdentity(store.id, {
        customerId: result.customer_id || null,
        fullName: fullName.trim(),
        phone,
        phoneSecondary: secTrim ? phoneSecondary : '',
        cep: onlyDigits(cep),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        district: district.trim(),
        city: city.trim(),
        state: stateUf,
      })
      clear()
      const wa = store.whatsapp_orders_phone || store.whatsapp_1
      openWhatsApp(wa, msg)
      nav(`/loja/${slug}/obrigado`, {
        state: { orderNumber: result.order_number },
      })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível finalizar o pedido.')
    } finally {
      setLoading(false)
    }
  }

  if (storeLines.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-ink-600">Não há itens no carrinho para esta loja.</p>
        <Link className="mt-4 inline-block text-brand-700" to={`/loja/${slug}`}>
          Voltar ao catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:max-w-5xl">
      <h1 className="font-display text-3xl font-semibold text-[var(--cat-primary)]">Checkout</h1>
      <p className="mt-1 text-sm text-ink-600">Preencha seus dados e a forma de pagamento. O pedido será salvo e você será direcionado ao WhatsApp.</p>

      <form className="mt-8 space-y-6" onSubmit={onSubmit}>
        <Card className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Seus dados</h2>
          <p className="text-xs text-ink-500">
            Se você já comprou neste navegador, seus dados podem ser preenchidos automaticamente. Ao informar o telefone, buscamos seu cadastro na loja para
            completar nome e endereço — você pode alterar qualquer campo.
          </p>
          <div>
            <label className="text-xs font-medium text-ink-600">Nome completo</label>
            <Input
              className="mt-1"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => void tryResolveByPhone()}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Telefone / WhatsApp</label>
            <Input
              className="mt-1"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              onBlur={() => void tryResolveByPhone()}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Outro telefone (opcional)</label>
            <p className="mt-0.5 text-xs text-ink-500">Caso não consigamos falar pelo número principal.</p>
            <Input
              className="mt-1"
              value={phoneSecondary}
              onChange={(e) => setPhoneSecondary(maskPhone(e.target.value))}
            />
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Endereço de entrega</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink-600">CEP</label>
              <Input className="mt-1" value={cep} onChange={(e) => setCep(maskCep(e.target.value))} onBlur={onCepBlur} required />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">UF</label>
              <Input className="mt-1" maxLength={2} value={stateUf} onChange={(e) => setStateUf(e.target.value.toUpperCase())} required />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Rua</label>
            <Input className="mt-1" value={street} onChange={(e) => setStreet(e.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink-600">Número</label>
              <Input className="mt-1" value={number} onChange={(e) => setNumber(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Complemento</label>
              <Input className="mt-1" value={complement} onChange={(e) => setComplement(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Bairro</label>
            <Input className="mt-1" value={district} onChange={(e) => setDistrict(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Cidade</label>
            <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Pagamento</h2>
          <Select value={payKind} onChange={(e) => setPayKind(e.target.value as PaymentKind)}>
            {payCfg.accepted_methods.map((k) => (
              <option key={k} value={k}>
                {PAYMENT_LABEL[k]}
              </option>
            ))}
          </Select>
          {(payKind === 'cartao_credito' || payKind === 'parcelado') && payCfg.card_fee_credit_percent > 0 ? (
            <p className="text-xs text-ink-500">
              Taxa estimada da maquinha (crédito / parcelado): {payCfg.card_fee_credit_percent}% — valor informativo para o fechamento do pedido.
            </p>
          ) : null}
          {payKind === 'cartao_debito' && payCfg.card_fee_debit_percent > 0 ? (
            <p className="text-xs text-ink-500">Taxa estimada da maquinha (débito): {payCfg.card_fee_debit_percent}%.</p>
          ) : null}
          {payKind === 'parcelado' || payKind === 'entrada_parcelado' ? (
            <div>
              <label className="text-xs font-medium text-ink-600">Parcelas (mín. 2)</label>
              <IntegerField
                className="mt-1"
                min={2}
                value={installments}
                onValueChange={(d) => setInstallments(d ? String(Math.max(2, Number(d) || 2)) : '2')}
              />
            </div>
          ) : null}
          {payKind === 'entrada_parcelado' ? (
            <div>
              <label className="text-xs font-medium text-ink-600">Valor da entrada</label>
              <MoneyField className="mt-1" value={down} onValueChange={(m) => setDown(m)} />
            </div>
          ) : null}
        </Card>

        <Card>
          <label className="text-xs font-medium text-ink-600">Observações do pedido</label>
          <Textarea className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </Card>

        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-ink-600">Total</p>
            <p className="text-2xl font-bold text-ink-900">{formatCurrency(subtotal)}</p>
          </div>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <Button type="submit" variant="catalog" loading={loading} className="px-8 py-3">
            Enviar pedido
          </Button>
        </Card>
      </form>
    </div>
  )
}
