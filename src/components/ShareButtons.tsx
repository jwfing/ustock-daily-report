import { useState } from 'react'
import { useLang } from '../i18n/LanguageContext'

interface Props { url: string; title: string }

const btn = 'inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm text-near transition hover:border-ink hover:text-ink'

export function ShareButtons({ url, title }: Props) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function nativeShare() {
    try { await navigator.share({ title, url }) } catch { /* user cancelled */ }
  }

  function shareX() {
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(t.share.tweet(title))}&url=${encodeURIComponent(url)}`
    window.open(u, '_blank', 'noopener,noreferrer')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canNativeShare && (
        <button onClick={nativeShare} className={btn} aria-label={t.share.share}>
          <span aria-hidden>↗</span> {t.share.share}
        </button>
      )}
      <button onClick={shareX} className={btn} aria-label={t.share.shareOnX}>
        <span aria-hidden className="font-medium">𝕏</span> {t.share.shareOnX}
      </button>
      <button onClick={copy} className={btn} aria-label={t.share.copy}>
        <span aria-hidden>{copied ? '✓' : '🔗'}</span> {copied ? t.share.copied : t.share.copy}
      </button>
    </div>
  )
}
