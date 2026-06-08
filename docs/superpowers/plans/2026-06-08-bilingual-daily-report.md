# Bilingual (ZH/EN) Daily Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the daily report in both Chinese and English, let each subscriber pick their email language, and send each subscriber the matching-language version.

**Architecture:** The compute generator produces the ZH report (web search), then a second AI call translates it to EN; both are stored as separate `reports` rows keyed by `(report_date, lang)`. Subscribers carry a `lang` preference; the send function picks the matching report per subscriber. The risky send-selection logic is extracted into a pure, unit-tested module.

**Tech Stack:** InsForge (Postgres + RLS, edge functions on Deno, compute container on Node), `@insforge/sdk`, React + Vite + Tailwind, vitest.

**Spec:** `docs/superpowers/specs/2026-06-08-bilingual-daily-report-design.md`

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `migrations/<ts>_add-report-and-subscription-lang.sql` | `lang` columns + unique-key swap | Create |
| `functions/_shared/send-planning.ts` | Pure send-selection logic (testable, no Deno/SDK imports) | Create |
| `functions/_shared/send-planning.test.ts` | vitest tests for the above | Create |
| `functions/send-daily-report.ts` | Wire per-language sending using the helper | Modify |
| `compute/generate/server.mjs` | Add translate step + two-row insert + per-lang guard | Modify |
| `src/pages/HomePage.tsx` | `CtaBlock` language picker | Modify |
| `src/i18n/translations.ts` | New `home` strings for the picker | Modify |
| `src/pages/ReportsPage.tsx` | Filter archive by UI language | Modify |

`ReportDetailPage.tsx` is **unchanged** — it queries by report `id`, which is already language-specific. The share page (`public-report.ts`) is likewise id-based and unchanged.

---

## Task 1: Database migration — add `lang`

**Files:**
- Create: `migrations/<timestamp>_add-report-and-subscription-lang.sql`

- [ ] **Step 1: Confirm the existing unique-constraint name on `reports`**

Run:
```bash
npx @insforge/cli db query "select conname from pg_constraint where conrelid='public.reports'::regclass and contype='u'"
```
Expected: one row, the unique constraint over `report_date`. Postgres's default name is `reports_report_date_key`. Use whatever name is returned in Step 3's `drop constraint`.

- [ ] **Step 2: Create the migration file**

Run:
```bash
npx @insforge/cli db migrations new add-report-and-subscription-lang
```
Expected: prints the created path `migrations/<timestamp>_add-report-and-subscription-lang.sql`.

- [ ] **Step 3: Write the migration SQL**

Put this in the new file (replace `reports_report_date_key` if Step 1 returned a different name). Do **not** add BEGIN/COMMIT — InsForge wraps migrations in a transaction.

```sql
-- reports: add language, switch unique key from (report_date) to (report_date, lang)
alter table public.reports
  add column lang text not null default 'zh' check (lang in ('zh','en'));

alter table public.reports drop constraint reports_report_date_key;

alter table public.reports
  add constraint reports_date_lang_key unique (report_date, lang);

-- subscriptions: add preferred email language
alter table public.subscriptions
  add column lang text not null default 'zh' check (lang in ('zh','en'));
```

- [ ] **Step 4: Apply the migration**

Run:
```bash
npx @insforge/cli db migrations up --all
```
Expected: applies the new migration with no error.

- [ ] **Step 5: Verify schema + backfill**

Run:
```bash
npx @insforge/cli db query "select report_date, lang, status from reports order by report_date desc limit 5"
npx @insforge/cli db query "select conname from pg_constraint where conrelid='public.reports'::regclass and contype='u'"
npx @insforge/cli db query "select column_name from information_schema.columns where table_name='subscriptions' and column_name='lang'"
```
Expected: existing report rows now show `lang = zh`; the unique constraint is `reports_date_lang_key`; `subscriptions.lang` exists.

- [ ] **Step 6: Commit**

```bash
git add migrations/
git commit -m "feat(db): add lang to reports and subscriptions, key reports by (date,lang)"
```

---

## Task 2: Send-planning pure logic (TDD)

**Files:**
- Create: `functions/_shared/send-planning.ts`
- Test: `functions/_shared/send-planning.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/_shared/send-planning.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- send-planning`
Expected: FAIL — `Cannot find module './send-planning'`.

- [ ] **Step 3: Write the implementation**

Create `functions/_shared/send-planning.ts`:

```ts
// Pure send-selection logic for the bilingual daily report. No Deno/SDK imports
// so it runs under vitest. Consumed by functions/send-daily-report.ts.

export type Lang = 'zh' | 'en'

export interface ReportRow {
  id: string
  lang: Lang
  status: string
  title: string
  content_html: string | null
  content_md: string
}

export interface Subscriber {
  user_id: string
  email: string
  lang: Lang
}

export interface DeliveryRow {
  report_id: string
  user_id: string
}

export interface PlannedSend {
  sub: Subscriber
  report: ReportRow
}

/** Index report rows by language, keeping only deliverable (ready/sent) rows. */
export function readyReportsByLang(reports: ReportRow[]): Partial<Record<Lang, ReportRow>> {
  const out: Partial<Record<Lang, ReportRow>> = {}
  for (const r of reports) {
    if (r.status === 'ready' || r.status === 'sent') out[r.lang] = r
  }
  return out
}

/**
 * Choose who to send to now, capped at `batch`. A subscriber is sendable when
 * their language has a ready report and no delivery row exists for that
 * (report_id, user_id). Subscribers whose language report is not ready are
 * skipped and retried on a later run.
 */
export function planBatch(args: {
  reports: ReportRow[]
  activeSubs: Subscriber[]
  deliveries: DeliveryRow[]
  batch: number
}): PlannedSend[] {
  const byLang = readyReportsByLang(args.reports)
  const handled = new Set(args.deliveries.map(d => `${d.report_id}:${d.user_id}`))
  const sends: PlannedSend[] = []
  for (const sub of args.activeSubs) {
    if (sends.length >= args.batch) break
    const report = byLang[sub.lang]
    if (!report) continue
    if (handled.has(`${report.id}:${sub.user_id}`)) continue
    sends.push({ sub, report })
  }
  return sends
}

/**
 * Count, per language that has a ready report, how many active subscribers of
 * that language still lack a delivery row. A language reaching 0 (with no
 * failures this run) is fully delivered and its report can be marked 'sent'.
 */
export function pendingByLang(args: {
  reports: ReportRow[]
  activeSubs: Subscriber[]
  deliveries: DeliveryRow[]
}): Partial<Record<Lang, number>> {
  const byLang = readyReportsByLang(args.reports)
  const handled = new Set(args.deliveries.map(d => `${d.report_id}:${d.user_id}`))
  const out: Partial<Record<Lang, number>> = {}
  for (const lang of Object.keys(byLang) as Lang[]) {
    const report = byLang[lang]!
    out[lang] = args.activeSubs.filter(
      s => s.lang === lang && !handled.has(`${report.id}:${s.user_id}`),
    ).length
  }
  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- send-planning`
Expected: PASS (all cases in both describe blocks).

- [ ] **Step 5: Commit**

```bash
git add functions/_shared/send-planning.ts functions/_shared/send-planning.test.ts
git commit -m "feat(send): pure per-language send-planning logic with tests"
```

---

## Task 3: Wire `send-daily-report` to per-language sending

**Files:**
- Modify: `functions/send-daily-report.ts`

- [ ] **Step 1: Replace the handler body to use the planner**

Replace the entire contents of `functions/send-daily-report.ts` with:

```ts
import { createAdminClient } from 'npm:@insforge/sdk'
import { planBatch, pendingByLang, type Lang, type ReportRow, type Subscriber } from './_shared/send-planning.ts'

const BATCH = 40 // max sends per trigger; stays under the SES hourly cap

const FROM: Record<Lang, string> = { zh: '美股日报', en: 'US Stock Daily' }

// Pacific report-date. Canonical, unit-tested copy: functions/_shared/report-date.ts.
function pacificDateStr(now: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export default async function (req: Request): Promise<Response> {
  if (req.headers.get('X-Cron-Secret') !== Deno.env.get('CRON_SECRET')) {
    return json({ error: 'forbidden' }, 403)
  }

  const admin = createAdminClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    apiKey: Deno.env.get('API_KEY'),
  })

  const dateStr = new URL(req.url).searchParams.get('date') ?? pacificDateStr(new Date())

  // All language rows for the date.
  const rep = await admin.database
    .from('reports').select('*').eq('report_date', dateStr)
  if (rep.error) return json({ error: rep.error.message }, 500)
  const reports: ReportRow[] = rep.data ?? []
  if (reports.length === 0) return json({ skipped: 'no report for date', date: dateStr })
  const anyReady = reports.some(r => r.status === 'ready' || r.status === 'sent')
  if (!anyReady) return json({ skipped: 'report still generating', date: dateStr })

  // Active subscribers (with language preference).
  const subsRes = await admin.database
    .from('subscriptions').select('user_id, email, lang').eq('status', 'active')
  if (subsRes.error) return json({ error: subsRes.error.message }, 500)
  const activeSubs: Subscriber[] = subsRes.data ?? []

  // Existing deliveries for these reports.
  const reportIds = reports.map(r => r.id)
  const delRes = await admin.database
    .from('report_deliveries').select('report_id, user_id').in('report_id', reportIds)
  if (delRes.error) return json({ error: delRes.error.message }, 500)
  const deliveries = delRes.data ?? []

  // Plan and send this batch.
  const sends = planBatch({ reports, activeSubs, deliveries, batch: BATCH })
  let sent = 0, failed = 0
  const failedLangs = new Set<Lang>()
  for (const { sub, report } of sends) {
    const { error } = await admin.emails.send({
      to: sub.email,
      subject: report.title,
      html: report.content_html ?? `<pre>${escapeHtml(report.content_md)}</pre>`,
      from: FROM[report.lang as Lang],
    })
    await admin.database.from('report_deliveries').insert([{
      report_id: report.id,
      user_id: sub.user_id,
      email: sub.email,
      status: error ? 'failed' : 'sent',
      error: error ? String(error.message ?? error) : null,
    }])
    if (error) { failed++; failedLangs.add(report.lang as Lang) }
    else { sent++; deliveries.push({ report_id: report.id, user_id: sub.user_id }) }
  }

  // Mark a language's report 'sent' when no subscribers of that language remain
  // pending and this run had no failures for it.
  const pending = pendingByLang({ reports, activeSubs, deliveries })
  for (const r of reports) {
    const lang = r.lang as Lang
    if ((r.status === 'ready') && (pending[lang] ?? 0) === 0 && !failedLangs.has(lang)) {
      await admin.database.from('reports').update({ status: 'sent' }).eq('id', r.id)
    }
  }

  const remaining = Object.values(pending).reduce((a, b) => a + (b ?? 0), 0)
  return json({ date: dateStr, sent, failed, remaining })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: Type-check the change**

Run: `npm run build`
Expected: build succeeds (the edge function is type-checked by `tsc -b` only if included; if not, at minimum the frontend build must stay green). Note: `.ts` import extension and `Deno`/`npm:` specifiers are edge-runtime conventions and may show editor warnings — they are correct for deployment.

- [ ] **Step 3: Commit**

```bash
git add functions/send-daily-report.ts
git commit -m "feat(send): deliver per-subscriber language version"
```

---

## Task 4: Generation — add EN translation + two-row insert

**Files:**
- Modify: `compute/generate/server.mjs`

- [ ] **Step 1: Add the translator system prompt constant**

In `compute/generate/server.mjs`, just below the `SYSTEM_PROMPT` definition (after line ~18), add:

```js
const TRANSLATE_PROMPT =
  'You are a professional financial translator. Translate the following US-stock ' +
  'market daily report from Chinese to English. Rules: preserve every number, ' +
  'ticker symbol, percentage, table, and Markdown structure exactly as in the ' +
  'source; do not add, drop, or reinterpret any data. Translate the heading ' +
  '"## 数据来源" to "## Sources" but keep all URLs and link targets unchanged. ' +
  'Output only the translated Markdown, with no preamble or commentary.'
```

- [ ] **Step 2: Replace the `generate()` function**

Replace the whole `generate()` function (currently lines ~32-91) with this version. It keeps the existing ZH generation + source-citation logic, adds a translate step, inserts both rows, and guards each language independently so a re-run backfills a missing EN row.

```js
async function generate(force) {
  const { dateStr, weekday } = pacificDate(new Date())
  if (!force && (weekday < 1 || weekday > 5)) {
    return { status: 200, body: { skipped: 'not a Pacific weekday', date: dateStr } }
  }

  const admin = createAdminClient({ baseUrl: BASE_URL, apiKey: API_KEY, timeout: 0 })

  // What already exists for this date?
  const existing = await admin.database
    .from('reports').select('id, lang, content_md').eq('report_date', dateStr)
  if (existing.error) return { status: 500, body: { error: existing.error.message } }
  const haveZh = existing.data?.find((r) => r.lang === 'zh')
  const haveEn = existing.data?.find((r) => r.lang === 'en')
  if (haveZh && haveEn) {
    return { status: 200, body: { skipped: 'already generated', date: dateStr } }
  }

  const rows = []

  // --- Chinese (authoritative, with web search) ---
  let zhMd = haveZh?.content_md
  if (!haveZh) {
    const userPrompt =
      `请生成 ${dateStr}（美国西部时间）的《美股收盘日报》。` +
      `严格按系统提示中《美股收盘日报》模板的结构输出中文 Markdown。` +
      `标题首行为：美股收盘日报｜${dateStr}。` +
      `请使用联网搜索获取该交易日的真实最新数据，并在关键数据处标注来源。` +
      `只输出日报正文 Markdown，不要额外说明。`

    let completion
    try {
      completion = await admin.ai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 16000,
        webSearch: {
          enabled: true,
          engine: 'native',
          maxResults: 10,
          searchPrompt:
            'Search English-language authoritative US financial sources only ' +
            '(CNBC, Reuters, Bloomberg, MarketWatch, WSJ, Yahoo Finance, Nasdaq, CME, FRED). ' +
            'Prefer primary/official data. Here are the search results:',
        },
      })
    } catch (e) {
      return { status: 502, body: { error: `ai call failed: ${e?.message ?? String(e)}` } }
    }

    const choice = completion?.choices?.[0]
    zhMd = choice?.message?.content ?? ''
    if (!zhMd.trim()) return { status: 502, body: { error: 'empty AI response' } }

    const annotations = choice?.message?.annotations ?? []
    if (annotations.length > 0) {
      const cites = annotations
        .filter((a) => a.type === 'url_citation')
        .map((a) => `- [${a.urlCitation.title ?? a.urlCitation.url}](${a.urlCitation.url})`)
      if (cites.length > 0) zhMd += `\n\n## 数据来源\n\n${cites.join('\n')}\n`
    }

    rows.push({
      report_date: dateStr, lang: 'zh', title: `美股收盘日报｜${dateStr}`,
      content_md: zhMd, content_html: marked.parse(zhMd),
      model: completion?.model ?? MODEL, status: 'ready',
    })
  }

  // --- English (translation, no web search → identical numbers) ---
  if (!haveEn) {
    if (!zhMd) return { status: 500, body: { error: 'no zh content to translate' } }
    let tr
    try {
      tr = await admin.ai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: TRANSLATE_PROMPT },
          { role: 'user', content: zhMd },
        ],
        maxTokens: 16000,
      })
    } catch (e) {
      // EN failed. Still persist a freshly-generated ZH row so the day isn't lost;
      // a later re-run will backfill EN.
      if (rows.length > 0) await admin.database.from('reports').insert(rows).select()
      return { status: 502, body: { error: `translate failed: ${e?.message ?? String(e)}`, zh: rows.length > 0 } }
    }
    const enMd = tr?.choices?.[0]?.message?.content ?? ''
    if (enMd.trim()) {
      rows.push({
        report_date: dateStr, lang: 'en', title: `US Stock Daily｜${dateStr}`,
        content_md: enMd, content_html: marked.parse(enMd),
        model: tr?.model ?? MODEL, status: 'ready',
      })
    }
  }

  if (rows.length === 0) {
    return { status: 200, body: { skipped: 'already generated', date: dateStr } }
  }

  const insert = await admin.database.from('reports').insert(rows).select()
  if (insert.error) return { status: 500, body: { error: insert.error.message } }

  return { status: 200, body: { generated: true, date: dateStr, langs: rows.map((r) => r.lang) } }
}
```

- [ ] **Step 3: Lint-check the file parses**

Run: `node --check compute/generate/server.mjs`
Expected: no output (syntax OK).

- [ ] **Step 4: Commit**

```bash
git add compute/generate/server.mjs
git commit -m "feat(compute): generate EN report via translation, store both languages"
```

---

## Task 5: Subscription language picker (UI + i18n)

**Files:**
- Modify: `src/i18n/translations.ts`
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Add i18n strings**

In `src/i18n/translations.ts`, the `home` object exists in both `en` and `zh`. Add three keys to each. First extend the `Dict` type's `home` shape (find the `home:` type definition near the top) by adding:

```ts
    emailLang: string
    langZh: string
    langEn: string
```

Then in the `en` translations `home` object add:

```ts
    emailLang: 'Email language',
    langZh: '中文',
    langEn: 'English',
```

And in the `zh` translations `home` object add:

```ts
    emailLang: '邮件语言',
    langZh: '中文',
    langEn: 'English',
```

- [ ] **Step 2: Add `lang` to the `Subscription` interface and load it**

In `src/pages/HomePage.tsx`, change the interface (line ~7):

```ts
interface Subscription { id: string; status: string; lang: 'zh' | 'en' }
```

In `load()`, widen the select (line ~19):

```ts
    const { data } = await insforge.database
      .from('subscriptions').select('id, status, lang').eq('user_id', user.id).limit(1)
```

- [ ] **Step 3: Track the picked language and write it on subscribe**

In `CtaBlock`, add to the imports from `useLang` so the current UI lang is available, and add picker state. The hook is already imported (`const { t } = useLang()` at line ~11); change it to also read `lang`:

```ts
  const { t, lang } = useLang()
  const [pickLang, setPickLang] = useState<'zh' | 'en'>(lang)
```

Update `subscribe()` to persist the chosen language on both insert and re-activate:

```ts
  async function subscribe() {
    if (!user) return
    setBusy(true)
    if (sub) {
      await insforge.database.from('subscriptions')
        .update({ status: 'active', lang: pickLang, updated_at: new Date().toISOString() }).eq('id', sub.id)
    } else {
      await insforge.database.from('subscriptions')
        .insert([{ user_id: user.id, email: user.email, status: 'active', lang: pickLang }])
    }
    await load(); setBusy(false)
  }
```

Add a handler to change language while already subscribed:

```ts
  async function changeLang(next: 'zh' | 'en') {
    if (!sub) return
    setBusy(true)
    await insforge.database.from('subscriptions')
      .update({ lang: next, updated_at: new Date().toISOString() }).eq('id', sub.id)
    await load(); setBusy(false)
  }
```

- [ ] **Step 4: Render the picker**

Add a small segmented control component inside `CtaBlock` (above the `return`s):

```tsx
  const LangPicker = ({ value, onChange }: { value: 'zh' | 'en'; onChange: (l: 'zh' | 'en') => void }) => (
    <div className="inline-flex overflow-hidden rounded-full border border-ink/30 text-sm">
      {(['zh', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={busy}
          onClick={() => onChange(l)}
          className={`px-3 py-1 transition ${value === l ? 'bg-ink text-ivory' : 'text-ink hover:bg-ink-tint'}`}
        >
          {l === 'zh' ? t.home.langZh : t.home.langEn}
        </button>
      ))}
    </div>
  )
```

In the **not-subscribed** logged-in branch (the final `return` with the subscribe button), wrap the button with the picker:

```tsx
  return (
    <div className={`flex flex-col gap-2 ${center}`}>
      <div className="flex items-center gap-3">
        <button disabled={busy} onClick={subscribe} className={`${pill} disabled:opacity-50`}>{t.home.subscribeStart}</button>
        <LangPicker value={pickLang} onChange={setPickLang} />
      </div>
      <span className={trust}>{t.home.trustLine}</span>
    </div>
  )
```

In the **active** branch, add a line under the subscribed pill that shows + changes the email language:

```tsx
        <div className="flex items-center gap-2 text-sm">
          <span className={trust}>{t.home.emailLang}</span>
          <LangPicker value={sub.lang} onChange={changeLang} />
        </div>
```

Place it inside the active branch's outer `flex flex-col` container, after the row that holds the subscribed pill and "view archive" link.

- [ ] **Step 5: Build to verify types/compile**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/translations.ts src/pages/HomePage.tsx
git commit -m "feat(fe): subscribe with email-language choice (ZH/EN)"
```

---

## Task 6: Archive filters by UI language

**Files:**
- Modify: `src/pages/ReportsPage.tsx`

- [ ] **Step 1: Filter the reports query by language**

In `src/pages/ReportsPage.tsx`, change the hook line (line ~9) from `const { t } = useLang()` to:

```ts
  const { t, lang } = useLang()
```

Then replace the entire `useEffect` block (lines ~14-25) with this version — it adds `.eq('lang', lang)`, resets `loading` on each run, and depends on `lang` so the top-nav toggle refetches:

```ts
  useEffect(() => {
    setLoading(true)
    ;(async () => {
      const { data, error } = await insforge.database
        .from('reports').select('id, report_date, title')
        .eq('lang', lang)
        .in('status', ['ready', 'sent'])
        .order('report_date', { ascending: false }).limit(60)
      if (error) setErr(true)
      else setRows((data as ReportRow[]) ?? [])
      setLoading(false)
    })()
  }, [lang])
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ReportsPage.tsx
git commit -m "feat(fe): archive shows reports in the current UI language"
```

---

## Task 7: Deploy and end-to-end verification

**Files:** none (operational)

- [ ] **Step 1: Deploy the compute generator**

Run from repo root:
```bash
npx @insforge/cli compute deploy ./compute/generate --name reportgen --port 8080
```
Expected: `Service "reportgen" updated [running]`.

- [ ] **Step 2: Force-generate a test date and verify two rows**

Pick a date with no rows yet (e.g. yesterday's Pacific date), then:
```bash
SECRET=$(npx @insforge/cli secrets get CRON_SECRET --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).value))")
curl -sS -X POST "https://reportgen-2deff9ae-3984-4101-b56f-fe4f8af513ef.fly.dev/?force=1" -H "x-cron-secret: $SECRET" -m 300
npx @insforge/cli db query "select report_date, lang, status, left(title,40) from reports order by report_date desc limit 4"
```
Expected: generation returns `{ generated:true, langs:["zh","en"] }`; the query shows a `zh` and an `en` row for the date; EN title starts `US Stock Daily｜`. Spot-check that EN numbers/tables match ZH and `## Sources` keeps the original URLs.

- [ ] **Step 3: Deploy the send function**

```bash
npx @insforge/cli functions deploy send-daily-report --file functions/send-daily-report.ts
```
Expected: deploy succeeds and the function is `active`.

- [ ] **Step 4: Verify per-language sending**

Set your own subscription to `en` and confirm a second test subscriber is `zh` (or temporarily insert one), then trigger send for the test date:
The send function lives at `{oss_host}/functions/send-daily-report` where `oss_host` is `https://4s425rbh.us-east.insforge.app` (from `.insforge/project.json`). Using the same test date `<DATE>` from Step 2:

```bash
npx @insforge/cli db query "select email, status, lang from subscriptions where status='active'"
curl -sS -X POST "https://4s425rbh.us-east.insforge.app/functions/send-daily-report?date=<DATE>" -H "X-Cron-Secret: $SECRET" -m 60
npx @insforge/cli db query "select d.email, d.status, r.lang, r.report_date from report_deliveries d join reports r on r.id=d.report_id where r.report_date='<DATE>'"
```
Expected: each subscriber has a delivery row joined to the report row matching their `lang`; EN subscriber's email subject was `US Stock Daily｜…`. Check inboxes for the correct language.

- [ ] **Step 5: Deploy the frontend**

```bash
npm run build
npx @insforge/cli deployments deploy .
```
Expected: deploy succeeds; live at the production URL.

- [ ] **Step 6: Manual UI verification**

On the live site: subscribe shows the ZH/EN picker (pre-selected to the UI toggle); subscribing as EN then re-loading shows "Email language: English"; toggling the email language updates it; switching the top-nav language toggle switches the archive between ZH and EN reports.

- [ ] **Step 7: Final full test run**

Run: `npm test`
Expected: all tests pass (report-date + send-planning).

---

## Notes for the implementer

- **Backend-branch option (recommended for Task 1):** the migration is additive plus one unique-key swap on a table with live data and RLS. If you want zero prod risk, run Task 1 on a branch first (`npx @insforge/cli branch create feat-lang --mode schema-only`), verify, then `branch merge`. For a project owner comfortable with the additive change, applying directly with the Step 5 verification is acceptable.
- The compute service URL `reportgen-2deff9ae-3984-4101-b56f-fe4f8af513ef.fly.dev` and CRON secret retrieval are from the existing deploy; confirm with `npx @insforge/cli compute list` if unsure.
- Edge-function files use Deno conventions (`npm:` specifiers, `.ts` import extensions, `Deno.env`). These are correct for deployment even if the local TS editor flags them.
