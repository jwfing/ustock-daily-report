import { createAdminClient } from 'npm:@insforge/sdk'

const BATCH = 40 // max sends per trigger; stays under the SES hourly cap

type Lang = 'zh' | 'en'

const FROM: Record<Lang, string> = { zh: '美股日报', en: 'US Stock Daily' }

// ---------------------------------------------------------------------------
// Per-language send-selection logic. Canonical, unit-tested copy lives in
// functions/_shared/send-planning.ts. It is inlined here because InsForge
// function deploys upload a single file (no local-import bundling), mirroring
// how the Pacific-date helper below is inlined. Keep the two copies in sync.
// ---------------------------------------------------------------------------
interface ReportRow {
  id: string
  lang: Lang
  status: 'ready' | 'sent' | 'generating'
  title: string
  content_html: string | null
  content_md: string
}
interface Subscriber { user_id: string; email: string; lang: Lang }
interface DeliveryRow { report_id: string; user_id: string }
interface PlannedSend { sub: Subscriber; report: ReportRow }

function handledKeys(deliveries: DeliveryRow[]): Set<string> {
  return new Set(deliveries.map(d => `${d.report_id}:${d.user_id}`))
}

function readyReportsByLang(reports: ReportRow[]): Partial<Record<Lang, ReportRow>> {
  const out: Partial<Record<Lang, ReportRow>> = {}
  for (const r of reports) {
    if (r.status === 'ready' || r.status === 'sent') out[r.lang] = r
  }
  return out
}

function planBatch(args: {
  reports: ReportRow[]
  activeSubs: Subscriber[]
  deliveries: DeliveryRow[]
  batch: number
}): PlannedSend[] {
  const byLang = readyReportsByLang(args.reports)
  const handled = handledKeys(args.deliveries)
  const sends: PlannedSend[] = []
  for (const sub of args.activeSubs) {
    if (sends.length >= args.batch) break
    const report = byLang[sub.lang]
    if (!report) continue
    if (handled.has(`${report.id}:${sub.user_id}`)) continue
    sends.push({ sub, report })
  }
  return sends
}

function pendingByLang(args: {
  reports: ReportRow[]
  activeSubs: Subscriber[]
  deliveries: DeliveryRow[]
}): Partial<Record<Lang, number>> {
  const byLang = readyReportsByLang(args.reports)
  const handled = handledKeys(args.deliveries)
  const out: Partial<Record<Lang, number>> = {}
  for (const lang of Object.keys(byLang) as Lang[]) {
    const report = byLang[lang]!
    out[lang] = args.activeSubs.filter(
      s => s.lang === lang && !handled.has(`${report.id}:${s.user_id}`),
    ).length
  }
  return out
}

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
  const deliveries: DeliveryRow[] = delRes.data ?? []

  // Plan and send this batch.
  const sends = planBatch({ reports, activeSubs, deliveries, batch: BATCH })
  let sent = 0, failed = 0
  const failedLangs = new Set<Lang>()
  for (const { sub, report } of sends) {
    const { error } = await admin.emails.send({
      to: sub.email,
      subject: report.title,
      html: report.content_html ?? `<pre>${escapeHtml(report.content_md)}</pre>`,
      from: FROM[report.lang],
    })
    await admin.database.from('report_deliveries').insert([{
      report_id: report.id,
      user_id: sub.user_id,
      email: sub.email,
      status: error ? 'failed' : 'sent',
      error: error ? String(error.message ?? error) : null,
    }])
    if (error) { failed++; failedLangs.add(report.lang) }
    else { sent++; deliveries.push({ report_id: report.id, user_id: sub.user_id }) }
  }

  // Mark a language's report 'sent' when no subscribers of that language remain
  // pending and this run had no failures for it.
  const pending = pendingByLang({ reports, activeSubs, deliveries })
  for (const r of reports) {
    if (r.status === 'ready' && (pending[r.lang] ?? 0) === 0 && !failedLangs.has(r.lang)) {
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
