import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { insforge } from '../lib/insforge'

interface ReportRow { id: string; report_date: string; title: string }

export function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.database
        .from('reports').select('id, report_date, title')
        .in('status', ['ready', 'sent'])
        .order('report_date', { ascending: false }).limit(60)
      if (error) setErr('需要有效订阅才能查看日报。')
      else setRows((data as ReportRow[]) ?? [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <p className="text-slate-500">加载中…</p>

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">日报归档</h1>
      {err ? (
        <p className="text-amber-700">{err} <Link className="text-blue-600" to="/">去订阅</Link></p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500">暂无日报。</p>
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
