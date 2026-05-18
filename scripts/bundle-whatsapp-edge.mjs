/**
 * Gera JSON de deploy para Edge Functions WhatsApp (MCP deploy_edge_function ou CI).
 * Uso: node scripts/bundle-whatsapp-edge.mjs whatsapp-admin
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../supabase/functions')
const PROJECT_ID = 'hacpynysbnetrsxaekxz'

const DEPS = {
  'whatsapp-admin': [
    'cors.ts',
    'evolution.ts',
    'evolutionParse.ts',
    'templates.ts',
    'supabase.ts',
    'messageTemplate.ts',
    'ordersGroup.ts',
    'storeAssets.ts',
  ],
  'whatsapp-send': [
    'cors.ts',
    'evolution.ts',
    'templates.ts',
    'supabase.ts',
    'messageTemplate.ts',
    'orderWhatsAppNotify.ts',
    'storeAssets.ts',
    'storeOrderGroupNotify.ts',
  ],
  'whatsapp-notify-checkout': [
    'cors.ts',
    'evolution.ts',
    'templates.ts',
    'supabase.ts',
    'messageTemplate.ts',
    'orderWhatsAppNotify.ts',
    'storeAssets.ts',
    'storeOrderGroupNotify.ts',
  ],
  'whatsapp-webhook': ['cors.ts', 'evolution.ts', 'supabase.ts', 'ordersGroup.ts', 'templates.ts', 'storeAssets.ts'],
}

const JWT = {
  'whatsapp-admin': true,
  'whatsapp-send': true,
  'whatsapp-notify-checkout': false,
  'whatsapp-webhook': false,
}

function fixImports(content) {
  return content.replace(/from '\.\.\/_shared\//g, "from './_shared/")
}

function readShared(name) {
  return fixImports(fs.readFileSync(path.join(ROOT, '_shared', name), 'utf8'))
}

function bundle(name) {
  const deps = DEPS[name]
  if (!deps) throw new Error(`Função desconhecida: ${name}`)
  const indexPath = path.join(ROOT, name, 'index.ts')
  const files = [{ name: 'index.ts', content: fixImports(fs.readFileSync(indexPath, 'utf8')) }]
  for (const d of deps) {
    files.push({ name: `_shared/${d}`, content: readShared(d) })
  }
  return {
    project_id: PROJECT_ID,
    name,
    entrypoint_path: 'index.ts',
    verify_jwt: JWT[name],
    files,
  }
}

const fn = process.argv[2]
if (!fn) {
  console.error('Informe o nome: whatsapp-admin | whatsapp-send | whatsapp-notify-checkout | whatsapp-webhook')
  process.exit(1)
}

const outDir = path.join(ROOT, '.bundle')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, `deploy-${fn}.args.json`)
fs.writeFileSync(out, JSON.stringify(bundle(fn)))
console.log(`Gerado: ${out}`)
