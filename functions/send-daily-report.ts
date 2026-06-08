import { createAdminClient } from 'npm:@insforge/sdk'
import { planBatch, pendingByLang, type Lang, type ReportRow, type Subscriber } from './_shared/send-planning.ts'

const BATCH = 40 // max sends per trigger; stays under the SES hourly cap

const FROM: Record<Lang, string> = { zh: '美股日报', en: 'US Stock Daily' }

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

  // All language rows for the date.
  const rep = await admin.database
    .from('reports').select('*').eq('report_date', dateStr)
  if (rep.error) return json({ error: rep.error.message }, 500)
  const reports: ReportRow[] = rep.data ?? []
  if (reports.length === 0) return json({ skipped: 'no report for date', date: dateStr })
  const anyReady = reports.some(r => r.status === 'ready' || r.status === 'sent')
  if (!anyReady) return json({ skipped: 'report still generating', date: dateStr })

  // Active subscribers (with language preference).
  const subsRes = await admin.database
    .from('subscriptions').select('user_id, email, lang').eq('status', 'active')
  if (subsRes.error) return json({ error: subsRes.error.message }, 500)
  const activeSubs: Subscriber[] = subsRes.data ?? []

  // Existing deliveries for these reports.
  const reportIds = reports.map(r => r.id)
  const delRes = await admin.database
    .from('report_deliveries').select('report_id, user_id').in('report_id', reportIds)
  if (delRes.error) return json({ error: delRes.error.message }, 500)
  const deliveries = delRes.data ?? []

  // Plan and send this batch.
  const sends = planBatch({ reports, activeSubs, deliveries, batch: BATCH })
  let sent = 0, failed = 0
  const failedLangs = new Set<Lang>()
  for (const { sub, report } of sends) {
    const { error } = await admin.emails.send({
      to: sub.email,
      subject: report.title,
      html: report.content_html ?? `<pre>${escapeHtml(report.content_md)}</pre>`,
      from: FROM[report.lang as Lang],
    })
    await admin.database.from('report_deliveries').insert([{
      report_id: report.id,
      user_id: sub.user_id,
      email: sub.email,
      status: error ? 'failed' : 'sent',
      error: error ? String(error.message ?? error) : null,
    }])
    if (error) { failed++; failedLangs.add(report.lang as Lang) }
    else { sent++; deliveries.push({ report_id: report.id, user_id: sub.user_id }) }
  }

  // Mark a language's report 'sent' when no subscribers of that language remain
  // pending and this run had no failures for it.
  const pending = pendingByLang({ reports, activeSubs, deliveries })
  for (const r of reports) {
    const lang = r.lang as Lang
    if ((r.status === 'ready') && (pending[lang] ?? 0) === 0 && !failedLangs.has(lang)) {
      await admin.database.from('reports').update({ status: 'sent' }).eq('id', r.id)
    }
  }

  const remaining = Object.values(pending).reduce((a, b) => a + (b ?? 0), 0)
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
