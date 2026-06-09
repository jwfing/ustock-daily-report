import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { Markdown } from '../components/Markdown'
import { ShareButtons } from '../components/ShareButtons'
import { useLang } from '../i18n/LanguageContext'
import { readingMinutes } from '../lib/text'

interface PublicReport { id: string; report_date: string; title: string; content_md: string }

export function PublicReportPage() {
  const { id } = useParams()
  const { t, lang } = useLang()
  const [report, setReport] = useState<PublicReport | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.functions.invoke('public-report', { body: { id } })
      const r = (data as { report?: PublicReport } | null)?.report
      if (error || !r) { setErr(true); return }
      setReport(r)
    })()
  }, [id])

  useEffect(() => {
    if (!report) return
    const prev = document.title
    document.title = report.title
    return () => { document.title = prev }
  }, [report])

  const mins = useMemo(() => (report ? readingMinutes(report.content_md) : 0), [report])

  if (err) return (
    <p className="text-stone">
      {t.pub.notFound} <Link className="text-ink hover:text-ink-light" to="/">{t.pub.explore}</Link>
    </p>
  )
  if (!report) return <p className="text-stone" role="status">{t.common.loading}</p>

  const shareUrl = `${window.location.origin}/r/${report.id}`

  return (
    <article className="reveal mx-auto max-w-2xl font-serif">
      <p className="text-[13px] italic text-stone">{t.pub.tagline}</p>
      <h1 className="mt-3 text-balance text-[1.75rem] font-medium leading-tight tracking-[-0.01em] text-near sm:text-[2rem]">
        {report.title}
      </h1>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-y border-line py-3">
        <span className="text-[13px] text-stone">{t.common.readTime(mins)}</span>
        <ShareButtons url={shareUrl} title={report.title} />
      </div>

      <Markdown md={report.content_md} lang={lang} className="mt-8" />

      {/* Subscribe CTA */}
      <div className="mt-10 border border-ink/20 bg-ink-tint px-5 py-7 text-center">
        <p className="text-lg text-near">{t.pub.subscribeCta}</p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-full border-[1.5px] border-ink bg-ink px-6 py-3 font-medium text-ivory transition hover:border-ink-light hover:bg-ink-light"
        >
          {t.pub.subscribeBtn}
        </Link>
      </div>
    </article>
  )
}
