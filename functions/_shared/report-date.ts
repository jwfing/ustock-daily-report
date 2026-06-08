// Pure helpers: derive the "Pacific (US West) report date" and whether a report
// should be generated for the given instant. Uses Intl for DST correctness; no
// Deno/Node-specific APIs so it runs in both the edge runtime and vitest.

export interface PacificParts {
  dateStr: string // YYYY-MM-DD in America/Los_Angeles local time
  weekday: number // 0=Sun ... 6=Sat in America/Los_Angeles local time
}

export function pacificParts(now: Date): PacificParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { dateStr, weekday: map[get('weekday')] ?? -1 }
}

export function shouldGenerate(now: Date): { ok: boolean; dateStr: string; weekday: number } {
  const { dateStr, weekday } = pacificParts(now)
  return { ok: weekday >= 1 && weekday <= 5, dateStr, weekday }
}
