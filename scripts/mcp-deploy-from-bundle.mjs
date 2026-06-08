/**
 * Lê bundle e imprime argumentos para deploy_edge_function (MCP Supabase).
 * Uso: node scripts/mcp-deploy-from-bundle.mjs whatsapp-admin
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const fn = process.argv[2]
if (!fn) {
  console.error('Uso: node scripts/mcp-deploy-from-bundle.mjs <funcao>')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const bundlePath = path.join(__dirname, `../supabase/functions/.bundle/deploy-${fn}.args.json`)
const b = JSON.parse(fs.readFileSync(bundlePath, 'utf8'))

const out = {
  project_id: b.project_id,
  name: b.name,
  entrypoint_path: b.entrypoint_path,
  verify_jwt: b.verify_jwt,
  files: b.files,
}

fs.writeFileSync(path.join(__dirname, `../mcp-deploy-${fn}.json`), JSON.stringify(out))
console.log(`mcp-deploy-${fn}.json`)
