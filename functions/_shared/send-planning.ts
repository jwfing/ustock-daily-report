// Pure send-selection logic for the bilingual daily report. No Deno/SDK imports
// so it runs under vitest. Consumed by functions/send-daily-report.ts.

export type Lang = 'zh' | 'en'

export interface ReportRow {
  id: string
  lang: Lang
  status: string
  title: string
  content_html: string | null
  content_md: string
}

export interface Subscriber {
  user_id: string
  email: string
  lang: Lang
}

export interface DeliveryRow {
  report_id: string
  user_id: string
}

export interface PlannedSend {
  sub: Subscriber
  report: ReportRow
}

/** Index report rows by language, keeping only deliverable (ready/sent) rows. */
export function readyReportsByLang(reports: ReportRow[]): Partial<Record<Lang, ReportRow>> {
  const out: Partial<Record<Lang, ReportRow>> = {}
  for (const r of reports) {
    if (r.status === 'ready' || r.status === 'sent') out[r.lang] = r
  }
  return out
}

/**
 * Choose who to send to now, capped at `batch`. A subscriber is sendable when
 * their language has a ready report and no delivery row exists for that
 * (report_id, user_id). Subscribers whose language report is not ready are
 * skipped and retried on a later run.
 */
export function planBatch(args: {
  reports: ReportRow[]
  activeSubs: Subscriber[]
  deliveries: DeliveryRow[]
  batch: number
}): PlannedSend[] {
  const byLang = readyReportsByLang(args.reports)
  const handled = new Set(args.deliveries.map(d => `${d.report_id}:${d.user_id}`))
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

/**
 * Count, per language that has a ready report, how many active subscribers of
 * that language still lack a delivery row. A language reaching 0 (with no
 * failures this run) is fully delivered and its report can be marked 'sent'.
 */
export function pendingByLang(args: {
  reports: ReportRow[]
  activeSubs: Subscriber[]
  deliveries: DeliveryRow[]
}): Partial<Record<Lang, number>> {
  const byLang = readyReportsByLang(args.reports)
  const handled = new Set(args.deliveries.map(d => `${d.report_id}:${d.user_id}`))
  const out: Partial<Record<Lang, number>> = {}
  for (const lang of Object.keys(byLang) as Lang[]) {
    const report = byLang[lang]!
    out[lang] = args.activeSubs.filter(
      s => s.lang === lang && !handled.has(`${report.id}:${s.user_id}`),
    ).length
  }
  return out
}
