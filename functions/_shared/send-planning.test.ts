import { describe, it, expect } from 'vitest'
import { planBatch, pendingByLang, type ReportRow, type Subscriber } from './send-planning'

const zh: ReportRow = { id: 'r-zh', lang: 'zh', status: 'ready', title: 'ZH', content_html: '<p>zh</p>', content_md: 'zh' }
const en: ReportRow = { id: 'r-en', lang: 'en', status: 'ready', title: 'EN', content_html: '<p>en</p>', content_md: 'en' }

const subs: Subscriber[] = [
  { user_id: 'u1', email: 'u1@x.com', lang: 'zh' },
  { user_id: 'u2', email: 'u2@x.com', lang: 'en' },
  { user_id: 'u3', email: 'u3@x.com', lang: 'zh' },
]

describe('planBatch', () => {
  it('routes each subscriber to their language report', () => {
    const sends = planBatch({ reports: [zh, en], activeSubs: subs, deliveries: [], batch: 40 })
    expect(sends.map(s => [s.sub.user_id, s.report.id])).toEqual([
      ['u1', 'r-zh'], ['u2', 'r-en'], ['u3', 'r-zh'],
    ])
  })

  it('skips subscribers whose language report is not ready', () => {
    const sends = planBatch({ reports: [zh], activeSubs: subs, deliveries: [], batch: 40 })
    expect(sends.map(s => s.sub.user_id)).toEqual(['u1', 'u3']) // u2 (en) skipped
  })

  it('skips already-delivered (report_id,user_id) pairs', () => {
    const sends = planBatch({
      reports: [zh, en], activeSubs: subs,
      deliveries: [{ report_id: 'r-zh', user_id: 'u1' }], batch: 40,
    })
    expect(sends.map(s => s.sub.user_id)).toEqual(['u2', 'u3'])
  })

  it('caps the batch size', () => {
    const sends = planBatch({ reports: [zh, en], activeSubs: subs, deliveries: [], batch: 2 })
    expect(sends).toHaveLength(2)
  })

  it('treats only ready/sent reports as available', () => {
    const generating: ReportRow = { ...en, status: 'generating' }
    const sends = planBatch({ reports: [zh, generating], activeSubs: subs, deliveries: [], batch: 40 })
    expect(sends.map(s => s.sub.user_id)).toEqual(['u1', 'u3'])
  })
})

describe('pendingByLang', () => {
  it('counts unhandled subscribers per ready language', () => {
    const p = pendingByLang({
      reports: [zh, en], activeSubs: subs,
      deliveries: [{ report_id: 'r-zh', user_id: 'u1' }],
    })
    expect(p).toEqual({ zh: 1, en: 1 }) // u3 zh pending, u2 en pending
  })

  it('reports 0 for a language whose subscribers are all delivered', () => {
    const p = pendingByLang({
      reports: [zh, en], activeSubs: subs,
      deliveries: [
        { report_id: 'r-zh', user_id: 'u1' },
        { report_id: 'r-zh', user_id: 'u3' },
      ],
    })
    expect(p.zh).toBe(0)
    expect(p.en).toBe(1)
  })

  it('omits a language with no ready report', () => {
    const p = pendingByLang({ reports: [zh], activeSubs: subs, deliveries: [] })
    expect(p).toEqual({ zh: 2 })
  })
})
