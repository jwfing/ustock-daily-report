import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Lang } from '../i18n/translations'

// A table cell whose entire text is a signed figure, e.g. "+1.23%", "-0.5", "-12 bps".
const SIGNED_CELL = /^[+-]\d[\d.,]*\s*(%|bps|pts|pt|points|个点|点)?$/i

// "Pangu" spacing: insert a half-width space where Han characters meet Latin
// letters, digits, %, or half-width brackets. Improves the cramped feel of
// mixed CN/EN/number text. Idempotent (existing spaces block a re-match).
const HAN = '\\u4e00-\\u9fff\\u3400-\\u4dbf\\uf900-\\ufaff'
const HAN_THEN_LATIN = new RegExp(`([${HAN}])([A-Za-z0-9(\\[])`, 'g')
const LATIN_THEN_HAN = new RegExp(`([A-Za-z0-9%)\\]])([${HAN}])`, 'g')

function spaceHanLatin(s: string): string {
  return s.replace(HAN_THEN_LATIN, '$1 $2').replace(LATIN_THEN_HAN, '$1 $2')
}

/**
 * Sanitise the model's Markdown, then enrich the safe DOM:
 *  - wrap wide tables so they scroll instead of breaking the layout
 *  - colour signed figures in table cells, respecting locale convention
 *    (EN: green up / red down · ZH: red up / green down), paired with the sign
 *  - open cited external sources in a new tab, safely
 *  - (ZH only) add pangu spacing between Han characters and Latin/numbers
 */
function enrich(cleanHtml: string, lang: Lang): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return cleanHtml
  const doc = new DOMParser().parseFromString(cleanHtml, 'text/html')

  const gainClass = lang === 'zh' ? 'fig-red' : 'fig-green'
  const lossClass = lang === 'zh' ? 'fig-green' : 'fig-red'

  doc.querySelectorAll('table').forEach((table) => {
    // scroll wrapper
    const wrapper = doc.createElement('div')
    wrapper.className = 'table-scroll'
    table.parentNode?.insertBefore(wrapper, table)
    wrapper.appendChild(table)

    // colour figure cells in the body (leave the header untouched)
    table.querySelectorAll('tbody td, tbody th').forEach((cell) => {
      const text = (cell.textContent ?? '').trim()
      if (!SIGNED_CELL.test(text)) return
      cell.classList.add(text.startsWith('-') ? lossClass : gainClass)
    })
  })

  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? ''
    if (/^https?:\/\//i.test(href)) {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    }
  })

  if (lang === 'zh') {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement?.closest('pre, code')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    })
    const texts: Text[] = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text)
    for (const t of texts) {
      const spaced = spaceHanLatin(t.nodeValue ?? '')
      if (spaced !== t.nodeValue) t.nodeValue = spaced
    }
  }

  return doc.body.innerHTML
}

export function Markdown({ md, lang, className = '' }: { md: string; lang: Lang; className?: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(md, { async: false }) as string
    const clean = DOMPurify.sanitize(raw)
    return enrich(clean, lang)
  }, [md, lang])

  return (
    <div
      className={`prose prose-kami max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
