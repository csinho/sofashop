/**
 * Deploy Edge Function via Management API (multipart/form-data).
 * @see https://supabase.com/docs/reference/api/v1-deploy-a-function
 */
export async function deployEdgeFromBundle(bundle, token) {
  const form = new FormData()
  const metadata = {
    name: bundle.name,
    entrypoint_path: bundle.entrypoint_path ?? 'index.ts',
    verify_jwt: bundle.verify_jwt ?? true,
  }
  form.append('metadata', JSON.stringify(metadata))

  for (const file of bundle.files) {
    const name = String(file.name).replace(/\\/g, '/')
    const content = typeof file.content === 'string' ? file.content : ''
    form.append('file', new Blob([content], { type: 'application/typescript' }), name)
  }

  const slug = encodeURIComponent(bundle.name)
  const url = `https://api.supabase.com/v1/projects/${bundle.project_id}/functions/deploy?slug=${slug}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  const text = await res.text()
  return { ok: res.ok, status: res.status, text }
}
