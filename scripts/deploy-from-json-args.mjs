/**
 * Republica whatsapp-admin a partir de deploy-args-temp.json (gerado pelo bundle).
 * Uso:
 *   node scripts/bundle-whatsapp-edge.mjs whatsapp-admin
 *   node scripts/mcp-deploy-from-bundle.mjs whatsapp-admin
 *   node -e "const fs=require('fs'); fs.copyFileSync('mcp-deploy-whatsapp-admin.json','deploy-args-temp.json')"
 *   $env:SUPABASE_ACCESS_TOKEN = "sbp_..." ; node scripts/deploy-from-json-args.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { deployEdgeFromBundle } from './lib/deploy-edge-multipart.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const argsPath = path.join(root, 'deploy-args-temp.json')

if (!fs.existsSync(argsPath)) {
  console.error('Arquivo deploy-args-temp.json não encontrado. Gere o bundle primeiro.')
  process.exit(1)
}

const args = JSON.parse(fs.readFileSync(argsPath, 'utf8'))
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim() || process.argv[2]?.trim()

if (!token) {
  console.error('Defina SUPABASE_ACCESS_TOKEN ou passe o token como argumento.')
  console.error('Gere em: https://supabase.com/dashboard/account/tokens')
  process.exit(2)
}

const bundle = {
  project_id: args.project_id,
  name: args.name,
  entrypoint_path: args.entrypoint_path,
  verify_jwt: args.verify_jwt,
  files: args.files,
}

const { ok, status, text } = await deployEdgeFromBundle(bundle, token)
if (!ok) {
  console.error('Falha', status, text)
  process.exit(1)
}
console.log('OK', args.name, text)
