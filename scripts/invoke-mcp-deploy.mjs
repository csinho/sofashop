/**
 * Lê deploy-args-temp.json e imprime payload para deploy_edge_function (MCP Supabase).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const argsPath = path.join(root, 'deploy-args-temp.json')
const args = JSON.parse(fs.readFileSync(argsPath, 'utf8'))
process.stdout.write(
  JSON.stringify({
    project_id: args.project_id,
    name: args.name,
    entrypoint_path: args.entrypoint_path,
    verify_jwt: args.verify_jwt,
    files: args.files,
  }),
)
