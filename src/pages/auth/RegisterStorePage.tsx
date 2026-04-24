import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { maskCep, maskCpfCnpj, maskPhone } from '@/lib/masks'
import { onlyDigits } from '@/lib/format'
import { validateCpfCnpj } from '@/lib/validators/cpfCnpj'
import { validateBrazilPhone } from '@/lib/validators/phone'
import { fetchAddressByCep } from '@/integrations/viacep'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { notifyOk } from '@/lib/notify'
import { BRAND_ASSETS } from '@/lib/brandAssets'
import { getPwaBrandName } from '@/lib/documentTitle'

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 48)
}

export function RegisterStorePage() {
  useEffect(() => {
    document.title = `${getPwaBrandName()} — Cadastrar loja`
  }, [])

  const nav = useNavigate()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [legalName, setLegalName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [slug, setSlug] = useState('')
  const [doc, setDoc] = useState('')
  const [phoneMain, setPhoneMain] = useState('')
  const [wa1, setWa1] = useState('')
  const [wa2, setWa2] = useState('')
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [stateUf, setStateUf] = useState('SP')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)

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
      setErr('CEP não encontrado ou indisponível.')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)

    if (password !== password2) {
      setErr('As senhas não conferem.')
      return
    }
    if (password.length < 6) {
      setErr('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    const dv = validateCpfCnpj(doc)
    if (!dv.ok || !dv.kind) {
      setErr(dv.message ?? 'Documento inválido.')
      return
    }

    const p1 = validateBrazilPhone(phoneMain)
    const p2 = validateBrazilPhone(wa1)
    if (!p1.ok || !p2.ok) {
      setErr(p1.message ?? p2.message ?? 'Telefone inválido.')
      return
    }
    if (wa2.trim() && !validateBrazilPhone(wa2).ok) {
      setErr('WhatsApp 2 inválido.')
      return
    }

    const sl = slug.trim() || slugify(tradeName)
    if (sl.length < 3) {
      setErr('Slug / identificador do link muito curto (mín. 3 caracteres).')
      return
    }

    setLoading(true)
    try {
      const sb = getSupabaseBrowserClient()
      const { data: authData, error: signErr } = await sb.auth.signUp({
        email: email.trim(),
        password,
      })
      if (signErr) throw signErr
      if (!authData.session) {
        throw new Error(
          'Confirme o e-mail enviado pelo Supabase antes de concluir o cadastro (ou desative confirmação de e-mail no Auth para desenvolvimento).',
        )
      }

      const { data: storeId, error: rpcErr } = await sb.rpc('register_store', {
        p_slug: sl,
        p_legal_name: legalName.trim(),
        p_trade_name: tradeName.trim(),
        p_document_kind: dv.kind,
        p_document: onlyDigits(doc),
        p_phone_main: phoneMain,
        p_whatsapp_1: wa1,
        p_whatsapp_2: wa2.trim() || '',
        p_email_contact: email.trim(),
        p_cep: onlyDigits(cep),
        p_street: street.trim(),
        p_number: number.trim(),
        p_complement: complement.trim(),
        p_district: district.trim(),
        p_city: city.trim(),
        p_state: stateUf,
        p_logo_url: null,
        p_whatsapp_orders_phone: onlyDigits(wa1),
      })

      if (rpcErr) throw rpcErr
      const id = storeId as unknown as string

      if (logoFile && id) {
        void (async () => {
          const ext = logoFile.name.split('.').pop() || 'png'
          const path = `${id}/logo-${Date.now()}.${ext}`
          const up = await sb.storage.from('store-assets').upload(path, logoFile, { upsert: false })
          if (!up.error) {
            const pub = sb.storage.from('store-assets').getPublicUrl(path)
            await sb.from('stores').update({ logo_url: pub.data.publicUrl }).eq('id', id)
          }
        })()
      }

      notifyOk('Loja criada. Bem-vindo ao painel.')
      nav('/admin')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao cadastrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex w-full justify-center px-1">
        <img
          src={BRAND_ASSETS.logoFull}
          alt=""
          className="h-16 w-full max-w-xl object-contain sm:h-[4.5rem] md:h-20 md:max-w-2xl"
        />
      </div>
      <Link to="/" className="mt-6 inline-block text-sm font-medium text-brand-700 hover:underline">
        ← Voltar
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink-900">Cadastro da loja</h1>
      <p className="mt-1 text-sm text-ink-600">Preencha os dados da sua empresa. Todos os campos marcados são obrigatórios.</p>

      <Card className="mt-8">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-ink-600">Nome da loja (razão social)</label>
            <Input className="mt-1" value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Nome fantasia</label>
            <Input className="mt-1" value={tradeName} onChange={(e) => setTradeName(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Link público (slug)</label>
            <Input
              className="mt-1"
              placeholder="ex: minha-loja"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-500">Deixe em branco para gerar a partir do nome fantasia.</p>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-ink-600">CPF ou CNPJ</label>
            <Input
              className="mt-1"
              value={doc}
              onChange={(e) => setDoc(maskCpfCnpj(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Telefone principal</label>
            <Input className="mt-1" value={phoneMain} onChange={(e) => setPhoneMain(maskPhone(e.target.value))} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">WhatsApp 1</label>
            <Input className="mt-1" value={wa1} onChange={(e) => setWa1(maskPhone(e.target.value))} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">WhatsApp 2</label>
            <Input className="mt-1" value={wa2} onChange={(e) => setWa2(maskPhone(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">CEP</label>
            <Input
              className="mt-1"
              value={cep}
              onChange={(e) => setCep(maskCep(e.target.value))}
              onBlur={onCepBlur}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Estado</label>
            <Input className="mt-1" maxLength={2} value={stateUf} onChange={(e) => setStateUf(e.target.value.toUpperCase())} required />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-ink-600">Rua</label>
            <Input className="mt-1" value={street} onChange={(e) => setStreet(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Número</label>
            <Input className="mt-1" value={number} onChange={(e) => setNumber(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Complemento</label>
            <Input className="mt-1" value={complement} onChange={(e) => setComplement(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-ink-600">Bairro</label>
            <Input className="mt-1" value={district} onChange={(e) => setDistrict(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Cidade</label>
            <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-ink-600">E-mail de acesso</label>
            <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Senha</label>
            <Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Confirmar senha</label>
            <Input className="mt-1" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-ink-600">Logo da loja</label>
            <input
              className="mt-2 block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800"
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {err ? <p className="md:col-span-2 text-sm text-red-600">{err}</p> : null}

          <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
            <Button type="submit" loading={loading}>
              Criar loja
            </Button>
            <Button type="button" variant="secondary" onClick={() => nav('/login')} doneToast="Indo para o login.">
              Já tenho conta
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
