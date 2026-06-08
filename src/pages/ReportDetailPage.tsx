import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { Markdown } from '../components/Markdown'
import { ShareButtons } from '../components/ShareButtons'
import { useLang } from '../i18n/LanguageContext'

export function ReportDetailPage() {
  const { id } = useParams()
  const { t } = useLang()
  const [md, setMd] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [err, setErr] = useState(false)

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.database
        .from('reports').select('title, content_md').eq('id', id).limit(1)
      if (error || !data?.[0]) { setErr(true); return }
      setTitle(data[0].title as string)
      setMd(data[0].content_md as string)
    })()
  }, [id])

  if (err) return <p className="text-stone">{t.detail.cannotLoad} <Link className="text-ink hover:text-ink-light" to="/reports">{t.detail.back}</Link></p>
  if (md === null) return <p className="text-stone">{t.common.loading}</p>

  const shareUrl = `${window.location.origin}/r/${id}`

  return (
    <article className="font-serif">
      <Link to="/reports" className="text-sm text-ink hover:text-ink-light">{t.detail.back}</Link>
      <h1 className="my-3 text-2xl font-medium text-near">{title}</h1>
      <div className="mb-5 border-y border-line py-3">
        <ShareButtons url={shareUrl} title={title} />
      </div>
      <Markdown md={md} />
    </article>
  )
}
