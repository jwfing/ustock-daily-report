import { createAdminClient } from 'npm:@insforge/sdk'

const BATCH = 40 // max sends per trigger; stays under the SES hourly cap

// Pacific report-date. Canonical, unit-tested copy: functions/_shared/report-date.ts.
function pacificDateStr(now: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export default async function (req: Request): Promise<Response> {
  if (req.headers.get('X-Cron-Secret') !== Deno.env.get('CRON_SECRET')) {
    return json({ error: 'forbidden' }, 403)
  }

  const admin = createAdminClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    apiKey: Deno.env.get('API_KEY'),
  })

  const dateStr = new URL(req.url).searchParams.get('date') ?? pacificDateStr(new Date())

  // Today's report must be fully generated (status 'ready'); 'sent' means done,
  // 'generating' means not ready yet.
  const rep = await admin.database
    .from('reports').select('*').eq('report_date', dateStr).limit(1)
  if (rep.error) return json({ error: rep.error.message }, 500)
  const report = rep.data?.[0]
  if (!report) return json({ skipped: 'no report for date', date: dateStr })
  if (report.status === 'generating') return json({ skipped: 'report still generating', date: dateStr })
  if (report.status === 'sent') return json({ done: true, date: dateStr, remaining: 0 })

  // Active subscribers.
  const subs = await admin.database
    .from('subscriptions').select('user_id, email').eq('status', 'active')
  if (subs.error) return json({ error: subs.error.message }, 500)
  const activeSubs: Array<{ user_id: string; email: string }> = subs.data ?? []

  // Already-handled recipients (any delivery row counts; failed is not auto-retried).
  const dels = await admin.database
    .from('report_deliveries').select('user_id').eq('report_id', report.id)
  if (dels.error) return json({ error: dels.error.message }, 500)
  const handled = new Set((dels.data ?? []).map((d: { user_id: string }) => d.user_id))

  const pending = activeSubs.filter(s => !handled.has(s.user_id))

  if (pending.length === 0) {
    await admin.database.from('reports').update({ status: 'sent' }).eq('id', report.id)
    return json({ done: true, date: dateStr, remaining: 0 })
  }

  const batch = pending.slice(0, BATCH)
  let sent = 0, failed = 0
  for (const sub of batch) {
    const { error } = await admin.emails.send({
      to: sub.email,
      subject: report.title,
      html: report.content_html ?? `<pre>${escapeHtml(report.content_md)}</pre>`,
      from: '美股日报',
    })
    await admin.database.from('report_deliveries').insert([{
      report_id: report.id,
      user_id: sub.user_id,
      email: sub.email,
      status: error ? 'failed' : 'sent',
      error: error ? String(error.message ?? error) : null,
    }])
    if (error) failed++; else sent++
  }

  const remaining = pending.length - batch.length
  if (remaining === 0 && failed === 0) {
    await admin.database.from('reports').update({ status: 'sent' }).eq('id', report.id)
  }
  return json({ date: dateStr, sent, failed, remaining })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
