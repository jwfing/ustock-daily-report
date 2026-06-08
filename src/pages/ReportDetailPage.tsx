import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { Markdown } from '../components/Markdown'

export function ReportDetailPage() {
  const { id } = useParams()
  const [md, setMd] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.database
        .from('reports').select('title, content_md').eq('id', id).limit(1)
      if (error || !data?.[0]) { setErr('无法加载该日报（需有效订阅）。'); return }
      setTitle(data[0].title as string)
      setMd(data[0].content_md as string)
    })()
  }, [id])

  if (err) return <p className="text-amber-700">{err} <Link className="text-blue-600" to="/reports">返回</Link></p>
  if (md === null) return <p className="text-slate-500">加载中…</p>

  return (
    <article>
      <Link to="/reports" className="text-sm text-blue-600">← 返回归档</Link>
      <h1 className="my-3 text-xl font-semibold">{title}</h1>
      <Markdown md={md} />
    </article>
  )
}
