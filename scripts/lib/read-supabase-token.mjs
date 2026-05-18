import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

function readTokenFromEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null
  const text = fs.readFileSync(filePath, 'utf8')
  const m = text.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*["']?([^"'\s#]+)["']?\s*$/m)
  return m?.[1]?.trim() || null
}

export function readToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim()

  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const fromEnv = readTokenFromEnvFile(path.join(root, '.env'))
  if (fromEnv) return fromEnv

  for (const p of [
    path.join(os.homedir(), '.supabase', 'access-token'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'supabase', 'access-token'),
  ]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  }
  return null
}
