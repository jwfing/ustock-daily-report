import { describe, it, expect } from 'vitest'
import { pacificParts, shouldGenerate } from './report-date'

describe('pacificParts', () => {
  // UTC 2026-06-09T03:00 = PDT 2026-06-08 20:00 (Monday)
  it('maps UTC 03:00 to previous-day Pacific evening', () => {
    const p = pacificParts(new Date('2026-06-09T03:00:00Z'))
    expect(p.dateStr).toBe('2026-06-08')
    expect(p.weekday).toBe(1) // Monday
  })

  // Winter: PST is UTC-8. UTC 2026-01-06T03:00 = PST 2026-01-05 19:00 (Monday)
  it('handles standard time (PST) offset', () => {
    const p = pacificParts(new Date('2026-01-06T03:00:00Z'))
    expect(p.dateStr).toBe('2026-01-05')
    expect(p.weekday).toBe(1)
  })
})

describe('shouldGenerate', () => {
  it('true on a Pacific weekday (Mon)', () => {
    // UTC Tue 03:00 -> PT Mon evening
    expect(shouldGenerate(new Date('2026-06-09T03:00:00Z')).ok).toBe(true)
  })
  it('true on a Pacific weekday (Fri)', () => {
    // UTC Sat 03:00 -> PT Fri evening
    expect(shouldGenerate(new Date('2026-06-13T03:00:00Z')).ok).toBe(true)
  })
  it('false on Pacific Saturday', () => {
    // UTC Sun 03:00 -> PT Sat evening
    expect(shouldGenerate(new Date('2026-06-07T03:00:00Z')).ok).toBe(false)
  })
  it('false on Pacific Sunday', () => {
    // UTC Mon 03:00 -> PT Sun evening
    expect(shouldGenerate(new Date('2026-06-08T03:00:00Z')).ok).toBe(false)
  })
})
