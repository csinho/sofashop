/**
 * Publica Edge Function usando bundle + SUPABASE_ACCESS_TOKEN.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { deployEdgeFromBundle } from './lib/deploy-edge-multipart.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fn = process.argv[2]

function readToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim()
  const home = os.homedir()
  for (const p of [
    path.join(home, '.supabase', 'access-token'),
    path.join(home, 'AppData', 'Roaming', 'supabase', 'access-token'),
  ]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  }
  return null
}

const token = readToken()
if (!fn) {
  console.error('Uso: node scripts/publish-edge-from-bundle.mjs <funcao>')
  process.exit(1)
}
if (!token) {
  console.error('Token não encontrado. Defina SUPABASE_ACCESS_TOKEN ou: npx supabase login --token sbp_...')
  process.exit(1)
}

const bundlePath = path.join(__dirname, `../supabase/functions/.bundle/deploy-${fn}.args.json`)
const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'))

const idx = bundle.files?.find((f) => f.name === 'index.ts')
if (fn === 'whatsapp-send' && idx && !idx.content?.includes('notifyOrderStatusToStoreGroup')) {
  console.error('Bundle whatsapp-send desatualizado (falta notifyOrderStatusToStoreGroup)')
  process.exit(1)
}
if (bundle.files?.find((f) => f.name === '_shared/orderWhatsAppNotify.ts')?.content?.includes('notify_statuses')) {
  console.error('Bundle contém orderWhatsAppNotify antigo (notify_statuses)')
  process.exit(1)
}

const { ok, status, text } = await deployEdgeFromBundle(bundle, token)
if (!ok) {
  console.error('Falha', status, text)
  process.exit(1)
}
console.log('OK', fn, text)
