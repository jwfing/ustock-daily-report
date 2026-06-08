import { createAdminClient } from 'npm:@insforge/sdk'

// Public, unauthenticated read of a SINGLE report by id (for share links).
// Only returns reports that are 'ready' or 'sent'. Does not expose the archive
// listing — callers must know the report's UUID.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  let id = new URL(req.url).searchParams.get('id')
  if (!id && req.method === 'POST') {
    try { id = (await req.json())?.id ?? null } catch { /* ignore */ }
  }
  if (!id) return json({ error: 'missing id' }, 400)

  const admin = createAdminClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    apiKey: Deno.env.get('API_KEY'),
  })

  const { data, error } = await admin.database
    .from('reports')
    .select('id, report_date, title, content_html, content_md, status')
    .eq('id', id).limit(1)
  if (error) return json({ error: error.message }, 500)

  const r = data?.[0]
  if (!r || (r.status !== 'ready' && r.status !== 'sent')) {
    return json({ error: 'not found' }, 404)
  }

  return json({
    report: {
      id: r.id, report_date: r.report_date, title: r.title,
      content_html: r.content_html, content_md: r.content_md,
    },
  })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
