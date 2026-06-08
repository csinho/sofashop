import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const fn = process.argv[2]
if (!fn) {
  console.error('usage: node read-mcp-deploy-args.mjs <whatsapp-admin|whatsapp-webhook>')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, `../mcp-deploy-${fn}.json`)
const args = JSON.parse(fs.readFileSync(file, 'utf8'))
process.stdout.write(JSON.stringify({
  project_id: args.project_id,
  name: args.name,
  entrypoint_path: args.entrypoint_path,
  verify_jwt: args.verify_jwt,
  files: args.files,
}))
