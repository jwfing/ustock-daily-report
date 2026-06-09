import { createAdminClient } from 'npm:@insforge/sdk'

const BATCH = 40 // max sends per trigger; stays under the SES hourly cap

type Lang = 'zh' | 'en'

const FROM: Record<Lang, string> = { zh: '美股日报', en: 'US Stock Daily' }

// Frontend origin for the email's "view in browser" / "manage subscription"
// links. Set the SITE_URL secret to override the deployed default.
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://4s425rbh.insforge.site').replace(/\/+$/, '')

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
    const fragment = report.content_html ?? `<pre>${escapeHtml(report.content_md)}</pre>`
    const html = renderReportEmail({
      lang: report.lang,
      title: report.title,
      bodyHtml: fragment,
      viewUrl: `${SITE_URL}/r/${report.id}`,
      manageUrl: `${SITE_URL}/`,
    })
    const { error } = await admin.emails.send({
      to: sub.email,
      subject: report.title,
      html,
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

// ---------------------------------------------------------------------------
// Branded HTML email wrapper. Canonical, unit-tested copy lives in
// functions/_shared/email-template.ts; it is inlined here because function
// deploys upload a single file. Keep the two copies in sync.
// kami · 紙 — parchment canvas, ivory card, ink-blue accent, Georgia serif.
// ---------------------------------------------------------------------------
interface EmailParts {
  lang: Lang; title: string; bodyHtml: string; viewUrl: string; manageUrl: string
}
interface EmailCopy {
  brand: string; disclaimer: string; viewOnline: string; manage: string; preheader: string
}
const EMAIL_COPY: Record<Lang, EmailCopy> = {
  zh: {
    brand: '美股日报',
    disclaimer: '本邮件内容由 AI 生成，仅供参考，不构成任何投资建议。市场有风险，决策需谨慎。',
    viewOnline: '在浏览器中查看', manage: '管理订阅',
    preheader: '每个交易日收盘后的美股复盘，关键数据标注来源。',
  },
  en: {
    brand: 'US Stock Daily',
    disclaimer: 'This email is AI-generated and for reference only; it is not investment advice. Markets carry risk; invest with care.',
    viewOnline: 'View in browser', manage: 'Manage subscription',
    preheader: 'Your US-market recap after every close, with sources cited.',
  },
}
const PINE = '#2f6e4f'
const OXBLOOD = '#a3392f'
const SIGNED_FIG = /^[+-]\d[\d.,]*\s*(%|bps|pts|pt|points|个点|点)?$/i

function colorizeFigures(html: string, lang: Lang): string {
  const gain = lang === 'zh' ? OXBLOOD : PINE
  const loss = lang === 'zh' ? PINE : OXBLOOD
  return html.replace(/<td([^>]*)>([^<]+)<\/td>/g, (m, attrs: string, inner: string) => {
    const text = inner.trim()
    if (!SIGNED_FIG.test(text)) return m
    const color = text.startsWith('-') ? loss : gain
    return `<td${attrs}><span style="color:${color};font-weight:600">${inner}</span></td>`
  })
}

const HAN = '\\u4e00-\\u9fff\\u3400-\\u4dbf\\uf900-\\ufaff'
const HAN_THEN_LATIN = new RegExp(`([${HAN}])([A-Za-z0-9(\\[])`, 'g')
const LATIN_THEN_HAN = new RegExp(`([A-Za-z0-9%)\\]])([${HAN}])`, 'g')
function panguText(s: string): string {
  return s.replace(HAN_THEN_LATIN, '$1 $2').replace(LATIN_THEN_HAN, '$1 $2')
}
function panguHtml(html: string): string {
  let depth = 0
  return html.split(/(<[^>]+>)/).map((tok) => {
    if (tok.startsWith('<')) {
      if (/^<(pre|code)[\s>]/i.test(tok)) depth++
      else if (/^<\/(pre|code)>/i.test(tok)) depth = Math.max(0, depth - 1)
      return tok
    }
    return depth > 0 ? tok : panguText(tok)
  }).join('')
}

function renderReportEmail(p: EmailParts): string {
  const c = EMAIL_COPY[p.lang]
  const htmlLang = p.lang === 'zh' ? 'zh-CN' : 'en'
  let body = colorizeFigures(p.bodyHtml, p.lang)
  if (p.lang === 'zh') body = panguHtml(body)
  const safeTitle = escapeHtml(p.title)

  return `<!doctype html>
<html lang="${htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${safeTitle}</title>
<style>
  body { margin:0; padding:0; width:100%; background:#f5f4ed; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  img { border:0; outline:none; text-decoration:none; }
  table { border-collapse:collapse; }
  a { color:#1B365D; }
  .article { font-family:Georgia,'Times New Roman',serif; color:#141413; font-size:16px; line-height:1.65; }
  .article h1 { margin:0 0 18px; font-size:24px; line-height:1.25; font-weight:600; color:#141413; letter-spacing:-0.01em; }
  .article h2 { margin:28px 0 10px; padding-bottom:6px; border-bottom:1px solid #e8e6dc; font-size:19px; line-height:1.3; font-weight:600; color:#141413; }
  .article h3 { margin:20px 0 8px; font-size:16px; font-weight:600; color:#1B365D; }
  .article p { margin:0 0 14px; }
  .article a { color:#1B365D; text-decoration:underline; }
  .article ul, .article ol { margin:0 0 14px; padding-left:22px; }
  .article li { margin:5px 0; }
  .article blockquote { margin:16px 0; padding:0; border:0; font-style:italic; color:#1B365D; }
  .article hr { border:0; border-top:1px solid #d8d5c8; margin:24px 0; }
  .article code { background:#eef2f7; padding:2px 5px; border-radius:4px; font-size:14px; }
  .article table { width:100%; margin:16px 0; font-size:14px; }
  .article th, .article td { border-bottom:1px solid #d8d5c8; padding:8px 10px; text-align:left; vertical-align:top; }
  .article thead th { color:#6b6a64; font-weight:600; font-size:13px; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .gutter { padding-left:22px !important; padding-right:22px !important; }
    .article h1 { font-size:22px !important; }
  }
</style>
</head>
<body>
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${escapeHtml(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ed;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#faf9f5;border:1px solid #d8d5c8;">
    <tr><td class="gutter" style="padding:18px 32px;border-bottom:1px solid #d8d5c8;font-family:Georgia,'Times New Roman',serif;">
      <span style="font-size:18px;font-weight:600;color:#1B365D;letter-spacing:-0.01em;">${c.brand}</span>
    </td></tr>
    <tr><td class="gutter article" style="padding:30px 32px;">
      <h1>${safeTitle}</h1>
      ${body}
    </td></tr>
    <tr><td class="gutter" style="padding:22px 32px;border-top:1px solid #d8d5c8;font-family:Georgia,'Times New Roman',serif;font-size:12px;line-height:1.6;color:#6b6a64;">
      <p style="margin:0 0 12px;">${escapeHtml(c.disclaimer)}</p>
      <p style="margin:0;"><a href="${p.viewUrl}" style="color:#1B365D;">${c.viewOnline}</a> &nbsp;&middot;&nbsp; <a href="${p.manageUrl}" style="color:#1B365D;">${c.manage}</a></p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}
