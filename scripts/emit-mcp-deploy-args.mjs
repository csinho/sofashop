/**
 * Emite argumentos para deploy_edge_function (MCP) a partir do bundle.
 * Uso: node scripts/emit-mcp-deploy-args.mjs whatsapp-admin > args.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fn = process.argv[2] || 'whatsapp-admin'
const payloadPath = path.join(__dirname, `.mcp-deploy-payload.json`)

if (!fs.existsSync(payloadPath)) {
  const bundlePath = path.join(__dirname, `../mcp-deploy-${fn}.json`)
  if (!fs.existsSync(bundlePath)) {
    console.error('Rode: node scripts/mcp-deploy-from-bundle.mjs', fn)
    process.exit(1)
  }
  fs.copyFileSync(bundlePath, payloadPath)
}

const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
process.stdout.write(JSON.stringify({
  project_id: payload.project_id,
  name: payload.name,
  entrypoint_path: payload.entrypoint_path,
  verify_jwt: payload.verify_jwt,
  files: payload.files,
}))
