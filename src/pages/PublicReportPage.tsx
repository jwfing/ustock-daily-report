import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { Markdown } from '../components/Markdown'
import { ShareButtons } from '../components/ShareButtons'
import { useLang } from '../i18n/LanguageContext'

interface PublicReport { id: string; report_date: string; title: string; content_md: string }

export function PublicReportPage() {
  const { id } = useParams()
  const { t } = useLang()
  const [report, setReport] = useState<PublicReport | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.functions.invoke('public-report', { body: { id } })
      const r = (data as { report?: PublicReport } | null)?.report
      if (error || !r) { setErr(true); return }
      setReport(r)
      document.title = r.title
    })()
  }, [id])

  if (err) return (
    <p className="text-stone">
      {t.pub.notFound} <Link className="text-ink hover:text-ink-light" to="/">{t.pub.explore}</Link>
    </p>
  )
  if (!report) return <p className="text-stone">{t.common.loading}</p>

  const shareUrl = `${window.location.origin}/r/${report.id}`

  return (
    <article className="font-serif">
      <p className="text-xs uppercase tracking-[0.15em] text-stone">{t.pub.tagline}</p>
      <h1 className="my-3 text-2xl font-medium text-near">{report.title}</h1>
      <div className="mb-5 border-y border-line py-3">
        <ShareButtons url={shareUrl} title={report.title} />
      </div>

      <Markdown md={report.content_md} />

      {/* Subscribe CTA */}
      <div className="mt-8 rounded-lg border border-ink/20 bg-ink-tint px-5 py-6 text-center">
        <p className="text-lg text-near">{t.pub.subscribeCta}</p>
        <Link to="/" className="mt-4 inline-block rounded-full border-[1.5px] border-ink bg-ink px-6 py-3 font-medium text-ivory transition hover:bg-ink-light hover:border-ink-light">
          {t.pub.subscribeBtn}
        </Link>
      </div>
    </article>
  )
}
