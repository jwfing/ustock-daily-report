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

  if (loading) return <p className="text-slate-500">{t.common.loading}</p>

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{t.reports.title}</h1>
      {err ? (
        <p className="text-amber-700">{t.reports.needSub} <Link className="text-blue-600" to="/">{t.reports.goSubscribe}</Link></p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500">{t.reports.empty}</p>
      ) : (
        <ul className="divide-y rounded border bg-white">
          {rows.map(r => (
            <li key={r.id}>
              <Link to={`/reports/${r.id}`} className="flex justify-between p-3 hover:bg-slate-50">
                <span>{r.title}</span>
                <span className="text-slate-400">{r.report_date}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
