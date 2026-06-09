import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useLang } from '../i18n/LanguageContext'
import type { Lang } from '../i18n/translations'

interface ReportRow { id: string; report_date: string; title: string }

// "Name｜2026-06-08" -> "Name". The date lives in its own column; don't repeat it.
function headline(title: string): string {
  return title.split(/[｜|]/)[0].trim() || title
}

// Editorial dateline from the authoritative report_date (UTC-stable, locale-aware).
function dateline(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: lang === 'zh' ? 'long' : 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

function SkeletonList({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <ul className="divide-y divide-line border-y border-line" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center justify-between gap-5 py-4">
            <span className="h-4 w-2/3 animate-pulse rounded bg-sand" />
            <span className="h-3 w-20 animate-pulse rounded bg-sand" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ReportsPage() {
  const { t, lang } = useLang()
  const [rows, setRows] = useState<ReportRow[]>([])
  const [err, setErr] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setErr(false)
      const { data, error } = await insforge.database
        .from('reports').select('id, report_date, title')
        .eq('lang', lang)
        .in('status', ['ready', 'sent'])
        .order('report_date', { ascending: false }).limit(60)
      if (!active) return // a newer language request superseded this one
      if (error) setErr(true)
      else setRows((data as ReportRow[]) ?? [])
      setLoading(false)
    })()
    return () => { active = false }
  }, [lang])

  return (
    <div className="reveal mx-auto max-w-2xl font-serif">
      <header className="mb-7">
        <h1 className="text-balance text-[1.75rem] font-medium tracking-[-0.01em] text-near sm:text-[2rem]">
          {t.reports.title}
        </h1>
        <p className="mt-2 text-near/75">{t.reports.subtitle}</p>
      </header>

      {loading ? (
        <SkeletonList label={t.common.loading} />
      ) : err ? (
        <p className="text-stone">
          {t.reports.needSub}{' '}
          <Link className="text-ink underline-offset-4 transition hover:text-ink-light hover:underline" to="/">
            {t.reports.goSubscribe}
          </Link>
        </p>
      ) : rows.length === 0 ? (
        <p className="text-stone">{t.reports.empty}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map(r => (
            <li key={r.id}>
              <Link
                to={`/reports/${r.id}`}
                className="group flex items-baseline justify-between gap-5 py-3.5 transition-colors"
              >
                <span className="text-near transition-colors group-hover:text-ink">{headline(r.title)}</span>
                <span className="shrink-0 text-[13px] tabular-nums text-stone">{dateline(r.report_date, lang)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
