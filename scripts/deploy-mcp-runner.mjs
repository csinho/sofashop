/**
 * Lê payload de deploy e publica via Management API (multipart).
 * Usa SUPABASE_ACCESS_TOKEN ou token salvo pelo supabase login.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { deployEdgeFromBundle } from './lib/deploy-edge-multipart.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fn = process.argv[2] || 'whatsapp-admin'

function readToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim()
  const home = os.homedir()
  for (const p of [
    path.join(home, '.supabase', 'access-token'),
    path.join(home, 'AppData', 'Roaming', 'supabase', 'access-token'),
  ]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  }
  const envFile = path.join(__dirname, '../.env')
  if (fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, 'utf8').match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*["']?([^"'\s#]+)["']?\s*$/m)
    if (m) return m[1].trim()
  }
  return null
}

const payloadPath = path.join(__dirname, `.mcp-deploy-payload.json`)
if (!fs.existsSync(payloadPath)) {
  console.error('Rode antes: node scripts/mcp-deploy-from-bundle.mjs', fn)
  process.exit(1)
}

const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
const token = readToken()
if (!token) {
  console.error('Token não encontrado para deploy via CLI.')
  process.exit(2)
}

const bundle = {
  project_id: payload.project_id,
  name: payload.name,
  entrypoint_path: payload.entrypoint_path,
  verify_jwt: payload.verify_jwt,
  files: payload.files,
}

const { ok, status, text } = await deployEdgeFromBundle(bundle, token)
if (!ok) {
  console.error('Falha', status, text)
  process.exit(1)
}
console.log('OK', payload.name, text)
