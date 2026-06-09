import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { Markdown } from '../components/Markdown'
import { ShareButtons } from '../components/ShareButtons'
import { useLang } from '../i18n/LanguageContext'
import { readingMinutes } from '../lib/text'

export function ReportDetailPage() {
  const { id } = useParams()
  const { t, lang } = useLang()
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

  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = title
    return () => { document.title = prev }
  }, [title])

  const mins = useMemo(() => (md ? readingMinutes(md) : 0), [md])

  if (err) return (
    <p className="text-stone">
      {t.detail.cannotLoad}{' '}
      <Link className="text-ink hover:text-ink-light" to="/reports">{t.detail.back}</Link>
    </p>
  )
  if (md === null) return <p className="text-stone" role="status">{t.common.loading}</p>

  const shareUrl = `${window.location.origin}/r/${id}`

  return (
    <article className="reveal mx-auto max-w-2xl font-serif">
      <Link to="/reports" className="text-sm text-ink transition hover:text-ink-light">{t.detail.back}</Link>
      <h1 className="mt-4 text-balance text-[1.75rem] font-medium leading-tight tracking-[-0.01em] text-near sm:text-[2rem]">
        {title}
      </h1>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-y border-line py-3">
        <span className="text-[13px] text-stone">{t.common.readTime(mins)}</span>
        <ShareButtons url={shareUrl} title={title} />
      </div>
      <Markdown md={md} lang={lang} className="mt-8" />
    </article>
  )
}
