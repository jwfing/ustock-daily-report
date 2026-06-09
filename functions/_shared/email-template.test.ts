import { describe, it, expect } from 'vitest'
import { renderReportEmail, colorizeFigures, panguHtml } from './email-template'

const sampleBody = `<h2>1. Index overview</h2>
<table><thead><tr><th>Index</th><th>Change</th></tr></thead>
<tbody><tr><td>Nasdaq</td><td>-4.18%</td></tr><tr><td>Dow</td><td>+0.35%</td></tr></tbody></table>
<p>NVDA硬件链承压，VIX飙升。See <a href="https://www.cnbc.com">CNBC</a>.</p>`

describe('colorizeFigures', () => {
  it('colours a gain green and a loss red in EN', () => {
    const out = colorizeFigures('<td>+0.35%</td><td>-4.18%</td>', 'en')
    expect(out).toContain('color:#2f6e4f') // +0.35% green
    expect(out).toContain('color:#a3392f') // -4.18% red
    expect(out.indexOf('#2f6e4f')).toBeLessThan(out.indexOf('#a3392f'))
  })

  it('flips the convention for ZH (gain red, loss green)', () => {
    const out = colorizeFigures('<td>+0.35%</td><td>-4.18%</td>', 'zh')
    // +0.35% should now be red, -4.18% green
    expect(out.indexOf('#a3392f')).toBeLessThan(out.indexOf('#2f6e4f'))
  })

  it('leaves placeholders and prices untouched', () => {
    expect(colorizeFigures('<td>—</td>', 'en')).toBe('<td>—</td>')
    expect(colorizeFigures('<td>49,910.59</td>', 'en')).toBe('<td>49,910.59</td>')
    expect(colorizeFigures('<td>Sharp breakdown</td>', 'en')).toBe('<td>Sharp breakdown</td>')
  })

  it('preserves cell attributes', () => {
    const out = colorizeFigures('<td style="text-align:right">-1.2%</td>', 'en')
    expect(out).toContain('<td style="text-align:right">')
  })
})

describe('panguHtml', () => {
  it('spaces Han against Latin/numbers in text, not in tags', () => {
    expect(panguHtml('<p>NVDA硬件链承压，跌4.18%</p>'))
      .toBe('<p>NVDA 硬件链承压，跌 4.18%</p>')
  })

  it('does not corrupt attributes or hrefs', () => {
    const out = panguHtml('<a href="https://x.com/中文">链接text</a>')
    expect(out).toContain('href="https://x.com/中文"') // attribute untouched
    expect(out).toContain('链接 text') // visible text spaced
  })

  it('skips code blocks', () => {
    expect(panguHtml('<code>const中文=1</code>')).toBe('<code>const中文=1</code>')
  })

  it('is idempotent', () => {
    const once = panguHtml('<p>标普500</p>')
    expect(panguHtml(once)).toBe(once)
  })
})

describe('renderReportEmail', () => {
  const html = renderReportEmail({
    lang: 'zh', title: '美股收盘日报｜2026-06-08', bodyHtml: sampleBody,
    viewUrl: 'https://site.example/r/abc', manageUrl: 'https://site.example/',
  })

  it('produces a complete HTML document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('</html>')
  })

  it('includes the masthead brand, the title, the disclaimer, and footer links', () => {
    expect(html).toContain('美股日报') // masthead brand
    expect(html).toContain('美股收盘日报｜2026-06-08') // article h1
    expect(html).toContain('不构成任何投资建议') // disclaimer
    expect(html).toContain('href="https://site.example/r/abc"') // view online
    expect(html).toContain('href="https://site.example/"') // manage
  })

  it('applies locale colour + pangu to the body (ZH: loss green)', () => {
    expect(html).toContain('VIX 飙升') // pangu spacing applied
    expect(html).toContain('color:#2f6e4f') // -4.18% loss is green in ZH
  })

  it('escapes the title to prevent markup injection', () => {
    const evil = renderReportEmail({
      lang: 'en', title: '<script>x</script>', bodyHtml: '<p>ok</p>',
      viewUrl: 'https://s/r/1', manageUrl: 'https://s/',
    })
    expect(evil).not.toContain('<script>x</script>')
    expect(evil).toContain('&lt;script&gt;')
  })
})
