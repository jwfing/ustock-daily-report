// Branded HTML email wrapper for the daily report.
//
// Canonical, unit-tested source. A byte-identical copy is inlined into
// functions/send-daily-report.ts because InsForge function deploys upload a
// single file (no local-import bundling), mirroring send-planning.ts. Keep the
// two copies in sync.
//
// Design: kami · 紙 — parchment canvas, ivory card, ink-blue accent, serif
// (Georgia, the email-safe stand-in for Charter). Email-safe: table layout,
// inline styles on structure, a <style> block for content typography, a single
// 600px column, light-only. Mirrors the web report: locale-aware gain/loss
// colour (EN green-up/red-down · ZH red-up/green-down, always with the sign)
// and, for ZH, pangu spacing between Han characters and Latin/numbers.

export type Lang = 'zh' | 'en'

export interface EmailParts {
  lang: Lang
  title: string
  bodyHtml: string // the rendered report fragment (marked output)
  viewUrl: string // public share page
  manageUrl: string // site home, where a signed-in user manages/cancels
}

interface Copy {
  brand: string
  disclaimer: string
  viewOnline: string
  manage: string
  preheader: string
}

const COPY: Record<Lang, Copy> = {
  zh: {
    brand: '美股日报',
    disclaimer: '本邮件内容由 AI 生成，仅供参考，不构成任何投资建议。市场有风险，决策需谨慎。',
    viewOnline: '在浏览器中查看',
    manage: '管理订阅',
    preheader: '每个交易日收盘后的美股复盘，关键数据标注来源。',
  },
  en: {
    brand: 'US Stock Daily',
    disclaimer: 'This email is AI-generated and for reference only; it is not investment advice. Markets carry risk; invest with care.',
    viewOnline: 'View in browser',
    manage: 'Manage subscription',
    preheader: 'Your US-market recap after every close, with sources cited.',
  },
}

const PINE = '#2f6e4f' // green
const OXBLOOD = '#a3392f' // red
const SIGNED = /^[+-]\d[\d.,]*\s*(%|bps|pts|pt|points|个点|点)?$/i

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Colour plain-text table cells that are signed figures. Locale convention:
// EN gain=green/loss=red; ZH gain=red/loss=green. The sign always remains.
export function colorizeFigures(html: string, lang: Lang): string {
  const gain = lang === 'zh' ? OXBLOOD : PINE
  const loss = lang === 'zh' ? PINE : OXBLOOD
  return html.replace(/<td([^>]*)>([^<]+)<\/td>/g, (m, attrs: string, inner: string) => {
    const text = inner.trim()
    if (!SIGNED.test(text)) return m
    const color = text.startsWith('-') ? loss : gain
    return `<td${attrs}><span style="color:${color};font-weight:600">${inner}</span></td>`
  })
}

const HAN = '\\u4e00-\\u9fff\\u3400-\\u4dbf\\uf900-\\ufaff'
const HAN_THEN_LATIN = new RegExp(`([${HAN}])([A-Za-z0-9(\\[])`, 'g')
const LATIN_THEN_HAN = new RegExp(`([A-Za-z0-9%)\\]])([${HAN}])`, 'g')

function panguText(s: string): string {
  return s.replace(HAN_THEN_LATIN, '$1 $2').replace(LATIN_THEN_HAN, '$1 $2')
}

// Pangu spacing applied to text only, never inside tags or pre/code blocks.
export function panguHtml(html: string): string {
  let depth = 0
  return html.split(/(<[^>]+>)/).map((tok) => {
    if (tok.startsWith('<')) {
      if (/^<(pre|code)[\s>]/i.test(tok)) depth++
      else if (/^<\/(pre|code)>/i.test(tok)) depth = Math.max(0, depth - 1)
      return tok
    }
    return depth > 0 ? tok : panguText(tok)
  }).join('')
}

export function renderReportEmail(p: EmailParts): string {
  const c = COPY[p.lang]
  const htmlLang = p.lang === 'zh' ? 'zh-CN' : 'en'
  let body = colorizeFigures(p.bodyHtml, p.lang)
  if (p.lang === 'zh') body = panguHtml(body)
  const safeTitle = escapeHtml(p.title)

  return `<!doctype html>
<html lang="${htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${safeTitle}</title>
<style>
  body { margin:0; padding:0; width:100%; background:#f5f4ed; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  img { border:0; outline:none; text-decoration:none; }
  table { border-collapse:collapse; }
  a { color:#1B365D; }
  .article { font-family:Georgia,'Times New Roman',serif; color:#141413; font-size:16px; line-height:1.65; }
  .article h1 { margin:0 0 18px; font-size:24px; line-height:1.25; font-weight:600; color:#141413; letter-spacing:-0.01em; }
  .article h2 { margin:28px 0 10px; padding-bottom:6px; border-bottom:1px solid #e8e6dc; font-size:19px; line-height:1.3; font-weight:600; color:#141413; }
  .article h3 { margin:20px 0 8px; font-size:16px; font-weight:600; color:#1B365D; }
  .article p { margin:0 0 14px; }
  .article a { color:#1B365D; text-decoration:underline; }
  .article ul, .article ol { margin:0 0 14px; padding-left:22px; }
  .article li { margin:5px 0; }
  .article blockquote { margin:16px 0; padding:0; border:0; font-style:italic; color:#1B365D; }
  .article hr { border:0; border-top:1px solid #d8d5c8; margin:24px 0; }
  .article code { background:#eef2f7; padding:2px 5px; border-radius:4px; font-size:14px; }
  .article table { width:100%; margin:16px 0; font-size:14px; }
  .article th, .article td { border-bottom:1px solid #d8d5c8; padding:8px 10px; text-align:left; vertical-align:top; }
  .article thead th { color:#6b6a64; font-weight:600; font-size:13px; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .gutter { padding-left:22px !important; padding-right:22px !important; }
    .article h1 { font-size:22px !important; }
  }
</style>
</head>
<body>
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${escapeHtml(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ed;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#faf9f5;border:1px solid #d8d5c8;">
    <tr><td class="gutter" style="padding:18px 32px;border-bottom:1px solid #d8d5c8;font-family:Georgia,'Times New Roman',serif;">
      <span style="font-size:18px;font-weight:600;color:#1B365D;letter-spacing:-0.01em;">${c.brand}</span>
    </td></tr>
    <tr><td class="gutter article" style="padding:30px 32px;">
      <h1>${safeTitle}</h1>
      ${body}
    </td></tr>
    <tr><td class="gutter" style="padding:22px 32px;border-top:1px solid #d8d5c8;font-family:Georgia,'Times New Roman',serif;font-size:12px;line-height:1.6;color:#6b6a64;">
      <p style="margin:0 0 12px;">${escapeHtml(c.disclaimer)}</p>
      <p style="margin:0;"><a href="${p.viewUrl}" style="color:#1B365D;">${c.viewOnline}</a> &nbsp;&middot;&nbsp; <a href="${p.manageUrl}" style="color:#1B365D;">${c.manage}</a></p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}
