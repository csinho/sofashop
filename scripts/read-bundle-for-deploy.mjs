import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const fn = process.argv[2]
if (!fn) {
  console.error('Uso: node scripts/read-bundle-for-deploy.mjs <funcao>')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const bundlePath = path.join(__dirname, `../supabase/functions/.bundle/deploy-${fn}.args.json`)
const b = JSON.parse(fs.readFileSync(bundlePath, 'utf8'))

const payload = {
  project_id: b.project_id,
  name: b.name,
  entrypoint_path: b.entrypoint_path,
  verify_jwt: b.verify_jwt,
  files: b.files,
}

process.stdout.write(JSON.stringify(payload))
