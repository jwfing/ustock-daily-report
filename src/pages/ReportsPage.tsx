import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useLang } from '../i18n/LanguageContext'

interface ReportRow { id: string; report_date: string; title: string }

export function ReportsPage() {
  const { t } = useLang()
  const [rows, setRows] = useState<ReportRow[]>([])
  const [err, setErr] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.database
        .from('reports').select('id, report_date, title')
        .in('status', ['ready', 'sent'])
        .order('report_date', { ascending: false }).limit(60)
      if (error) setErr(true)
      else setRows((data as ReportRow[]) ?? [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <p className="text-stone">{t.common.loading}</p>

  return (
    <div className="font-serif">
      <h1 className="mb-5 text-2xl font-medium text-near">{t.reports.title}</h1>
      {err ? (
        <p className="text-stone">{t.reports.needSub} <Link className="text-ink hover:text-ink-light" to="/">{t.reports.goSubscribe}</Link></p>
      ) : rows.length === 0 ? (
        <p className="text-stone">{t.reports.empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-ivory">
          {rows.map(r => (
            <li key={r.id}>
              <Link to={`/reports/${r.id}`} className="flex justify-between p-3.5 transition hover:bg-parchment">
                <span className="text-near">{r.title}</span>
                <span className="text-stone tabular-nums">{r.report_date}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
