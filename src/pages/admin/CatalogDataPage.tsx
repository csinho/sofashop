import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { ColorField } from '@/components/ui/ColorField'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { notifyErr, notifyOk } from '@/lib/notify'
import type { AdminOutletCtx } from '@/pages/admin/adminOutlet'

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60)
}

type ColorRow = { id: string; name: string; hex: string }
type CatRow = { id: string; name: string; slug: string; sort_order: number; is_active: boolean }
type ModelTypeRow = { id: string; name: string; sort_order: number }

export function CatalogDataPage() {
  const { store } = useOutletContext<AdminOutletCtx>()
  const [colors, setColors] = useState<ColorRow[]>([])
  const [categories, setCategories] = useState<CatRow[]>([])
  const [modelTypes, setModelTypes] = useState<ModelTypeRow[]>([])

  const [cName, setCName] = useState('')
  const [cHex, setCHex] = useState('#334155')
  const [catName, setCatName] = useState('')
  const [mtName, setMtName] = useState('')

  const load = useCallback(async () => {
    const sb = getSupabaseBrowserClient()
    const [co, ca, mt] = await Promise.all([
      sb.from('colors').select('id, name, hex').eq('store_id', store.id).order('name'),
      sb.from('categories').select('id, name, slug, sort_order, is_active').eq('store_id', store.id).order('sort_order'),
      sb.from('product_model_types').select('id, name, sort_order').eq('store_id', store.id).order('sort_order'),
    ])
    if (co.error) notifyErr(co.error.message)
    else setColors((co.data as ColorRow[]) ?? [])
    if (ca.error) notifyErr(ca.error.message)
    else setCategories((ca.data as CatRow[]) ?? [])
    if (mt.error) notifyErr(mt.error.message)
    else setModelTypes((mt.data as ModelTypeRow[]) ?? [])
  }, [store.id])

  useEffect(() => {
    void load()
  }, [load])

  async function addColor() {
    if (!cName.trim()) {
      notifyErr('Informe o nome da cor.')
      return
    }
    const sb = getSupabaseBrowserClient()
    const { error } = await sb.from('colors').insert({
      store_id: store.id,
      name: cName.trim(),
      hex: /^#[0-9A-Fa-f]{6}$/.test(cHex) ? cHex : '#334155',
    })
    if (error) notifyErr(error.message)
    else {
      notifyOk('Cor adicionada.')
      setCName('')
      setCHex('#334155')
      void load()
    }
  }

  async function removeColor(id: string) {
    const sb = getSupabaseBrowserClient()
    const { error } = await sb.from('colors').delete().eq('id', id).eq('store_id', store.id)
    if (error) notifyErr(error.message)
    else {
      notifyOk('Cor removida.')
      void load()
    }
  }

  async function addCategory() {
    if (!catName.trim()) {
      notifyErr('Informe o nome da categoria.')
      return
    }
    const sb = getSupabaseBrowserClient()
    const slug = slugify(catName)
    const { error } = await sb.from('categories').insert({
      store_id: store.id,
      name: catName.trim(),
      slug,
      sort_order: categories.length,
      is_active: true,
    })
    if (error) notifyErr(error.message)
    else {
      notifyOk('Categoria criada.')
      setCatName('')
      void load()
    }
  }

  async function toggleCategory(cat: CatRow) {
    const sb = getSupabaseBrowserClient()
    const { error } = await sb.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    if (error) notifyErr(error.message)
    else {
      notifyOk(cat.is_active ? 'Categoria oculta no catálogo.' : 'Categoria ativada no catálogo.')
      void load()
    }
  }

  async function updateCategoryName(cat: CatRow, name: string) {
    const sb = getSupabaseBrowserClient()
    const { error } = await sb
      .from('categories')
      .update({ name: name.trim(), slug: slugify(name) })
      .eq('id', cat.id)
    if (error) notifyErr(error.message)
    else {
      notifyOk('Categoria atualizada.')
      void load()
    }
  }

  async function addModelType() {
    if (!mtName.trim()) {
      notifyErr('Informe o nome do tipo.')
      return
    }
    const sb = getSupabaseBrowserClient()
    const { error } = await sb.from('product_model_types').insert({
      store_id: store.id,
      name: mtName.trim(),
      sort_order: modelTypes.length,
    })
    if (error) notifyErr(error.message)
    else {
      notifyOk('Tipo de produto criado.')
      setMtName('')
      void load()
    }
  }

  async function removeModelType(id: string) {
    const sb = getSupabaseBrowserClient()
    const { error } = await sb.from('product_model_types').delete().eq('id', id).eq('store_id', store.id)
    if (error) notifyErr(error.message)
    else {
      notifyOk('Tipo removido.')
      void load()
    }
  }

  async function updateModelName(row: ModelTypeRow, name: string) {
    const sb = getSupabaseBrowserClient()
    const { error } = await sb.from('product_model_types').update({ name: name.trim() }).eq('id', row.id)
    if (error) notifyErr(error.message)
    else {
      notifyOk('Tipo atualizado.')
      void load()
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink-900">Dados do catálogo</h2>
        <p className="mt-1 text-sm text-ink-600">
          Gerencie cores (para variações), categorias e tipos de modelo usados nos produtos e filtros do catálogo público.
        </p>
      </div>

      <Card className="space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink-900">Cores</h3>
          <p className="mt-1 text-xs text-ink-500">
            Cada cor tem nome e código hexadecimal. Elas aparecem nas variações do produto e no filtro por cor do catálogo.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="text-xs font-medium text-ink-600">Nome</label>
            <Input className="mt-1" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="ex: Linho cinza" />
          </div>
          <ColorField label="Hex" value={cHex} onChange={setCHex} />
          <Button type="button" variant="secondary" onClick={() => void addColor()}>
            Adicionar cor
          </Button>
        </div>
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
          {colors.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-lg ring-1 ring-ink-200" style={{ background: c.hex }} />
                <span className="font-medium text-ink-900">{c.name}</span>
                <code className="text-xs text-ink-500">{c.hex}</code>
              </span>
              <Button type="button" variant="ghost" className="text-red-600" onClick={() => void removeColor(c.id)}>
                Remover
              </Button>
            </li>
          ))}
          {colors.length === 0 ? <li className="px-3 py-4 text-sm text-ink-500">Nenhuma cor cadastrada.</li> : null}
        </ul>
      </Card>

      <Card className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-ink-900">Categorias</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input className="w-full sm:max-w-md" placeholder="Nome da nova categoria" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => void addCategory()}>
            Nova categoria
          </Button>
        </div>
        <ul className="space-y-3">
          {categories.map((c) => (
            <li key={c.id} className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
              <CategoryNameEditor cat={c} onSave={(name) => void updateCategoryName(c, name)} />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-ink-400">{c.slug}</span>
                <Button type="button" variant="ghost" className="text-xs" onClick={() => void toggleCategory(c)}>
                  {c.is_active ? 'Ocultar' : 'Ativar'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink-900">Tipos de produto (modelo)</h3>
          <p className="mt-1 text-xs text-ink-500">
            Ex.: &quot;Sofá retrátil&quot;. O mesmo conjunto é usado no cadastro de produtos e no filtro &quot;Tipo / modelo&quot; do catálogo.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input className="w-full sm:max-w-md" placeholder="Nome do tipo" value={mtName} onChange={(e) => setMtName(e.target.value)} />
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => void addModelType()}>
            Novo tipo
          </Button>
        </div>
        <ul className="space-y-3">
          {modelTypes.map((m) => (
            <li key={m.id} className="rounded-xl border border-ink-100 p-3">
              <ModelNameEditor row={m} onSave={(name) => void updateModelName(m, name)} />
              <div className="mt-2 flex justify-end">
                <Button type="button" variant="ghost" className="text-red-600" onClick={() => void removeModelType(m.id)}>
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function CategoryNameEditor({ cat, onSave }: { cat: CatRow; onSave: (name: string) => void }) {
  const [v, setV] = useState(cat.name)
  useEffect(() => {
    setV(cat.name)
  }, [cat.id, cat.name])
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input className="w-full sm:min-w-[200px] sm:flex-1" value={v} onChange={(e) => setV(e.target.value)} />
      <Button type="button" variant="secondary" className="w-full text-xs sm:w-auto" onClick={() => onSave(v)}>
        Salvar
      </Button>
    </div>
  )
}

function ModelNameEditor({ row, onSave }: { row: ModelTypeRow; onSave: (name: string) => void }) {
  const [v, setV] = useState(row.name)
  useEffect(() => {
    setV(row.name)
  }, [row.id, row.name])
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input className="w-full sm:min-w-[200px] sm:flex-1" value={v} onChange={(e) => setV(e.target.value)} />
      <Button type="button" variant="secondary" className="w-full text-xs sm:w-auto" onClick={() => onSave(v)}>
        Salvar
      </Button>
    </div>
  )
}
