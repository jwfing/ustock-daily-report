# Bilingual (ZH/EN) Daily Report — Design

Date: 2026-06-08
Branch: `feat/daily-report`
Status: approved (pending spec review)

## Goal

Deliver the US-stock daily report in both Chinese and English. Each subscriber
chooses their email language at subscribe time; the daily send delivers the
matching-language version. The site archive shows reports in the current UI
language.

## Decisions (locked)

1. **EN generation = translate from ZH.** Generate the Chinese report as today
   (with web search), then a second AI call translates the full Markdown to
   English. One web search per day; numbers/tables identical across both
   versions.
2. **Storage = two rows per date.** Add `lang` to `reports`; unique key becomes
   `(report_date, lang)`. Each language is a first-class report row.
3. **Subscriber language** stored on `subscriptions.lang`. Existing subscribers
   default to `zh` (no behavior change). New subscribers pre-select the current
   UI language.
4. **Archive/detail** filter by the **site UI language** (the `useLang` toggle),
   independent of the email-subscription language.

## Data model

### Migration: `add-report-and-subscription-lang`

```sql
-- reports: add language, switch unique key to (report_date, lang)
alter table public.reports add column lang text not null default 'zh'
  check (lang in ('zh','en'));
alter table public.reports drop constraint reports_report_date_key;  -- existing unique(report_date)
alter table public.reports add constraint reports_date_lang_key unique (report_date, lang);

-- subscriptions: add preferred email language
alter table public.subscriptions add column lang text not null default 'zh'
  check (lang in ('zh','en'));
```

Notes:
- Existing `reports` rows backfill to `lang='zh'` via the default — they become
  the Chinese rows. Verify the actual existing-constraint name first
  (`reports_report_date_key` is Postgres's default for `report_date ... unique`;
  confirm with `\d reports` / `db indexes` before writing the drop).
- `report_deliveries` is unchanged: it keys on `(report_id, user_id)`, and
  `report_id` already differs per language, so per-language dedup is automatic.
- RLS unchanged. `reports_select_subscribed` still gates reads to active
  subscribers; the admin client (generation/send) bypasses RLS.

## Generation pipeline — `compute/generate/server.mjs`

Current: one ZH generation → insert one `reports` row.

New flow inside `generate()`:

1. Generate the ZH report exactly as today (system prompt + web search,
   `engine:'native'`). Produces `md_zh`, `title_zh = 美股收盘日报｜<date>`.
2. **Translate** to English with a second `ai.chat.completions.create` call
   (no `webSearch`):
   - System prompt: a concise translator instruction — "Translate this US-stock
     market daily report from Chinese to English. Preserve every number, ticker,
     table, and Markdown structure exactly. Translate the `## 数据来源` heading to
     `## Sources` but keep all URLs and link targets unchanged. Output only the
     translated Markdown."
   - `maxTokens: 16000`.
   - Produces `md_en`; `title_en = US Stock Daily｜<date>`.
3. Render both to HTML via `marked`.
4. Insert **both** rows in one `insert([...])` (or two inserts) with
   `status:'ready'`:
   - `{ report_date, lang:'zh', title: title_zh, content_md: md_zh, content_html, model }`
   - `{ report_date, lang:'en', title: title_en, content_md: md_en, content_html, model }`
5. Existing-report guard, **per language**: check `(date,'zh')` and `(date,'en')`
   presence independently. Generate+insert ZH only if its row is missing;
   translate+insert EN only if its row is missing. A full re-run of a complete
   day is a no-op; a re-run after a translation failure backfills only the
   missing EN row without duplicating ZH.

Failure handling: if the ZH generation fails, abort (as today). If the
**translation** fails, still insert the ZH row and return a partial result
(`{ generated:true, en:false }`) — EN subscribers are simply skipped until a
later re-run fills the EN row. The existing-report guard must therefore key on
the **specific** `(date, lang)` so a re-run can backfill a missing EN row
without duplicating ZH. (Implementation: check zh and en presence separately;
generate ZH only if missing, translate+insert EN only if missing.)

The translate title separator uses the full-width `｜` to match the existing ZH
title convention; the EN UI wordmark already reads "US Stock Daily".

## Subscription + UI — `src/pages/HomePage.tsx` (`CtaBlock`)

- `Subscription` interface gains `lang: 'zh' | 'en'`.
- `load()` selects `id, status, lang`.
- **Subscribe (new):** a compact ZH/EN segmented control next to the subscribe
  button, defaulting to the current `lang` from `useLang()`. `subscribe()`
  writes `lang` on insert; on re-activate it also updates `lang`.
- **Already active:** show the chosen language (e.g. a small "邮件语言：中文 /
  English" line) with a toggle that updates `subscriptions.lang` immediately.
- New i18n strings in `src/i18n/translations.ts` under `home`: `emailLang`,
  `langZh`, `langEn`, and any subscribe-with-language label.

## Sending — `functions/send-daily-report.ts`

Current: load the single report for the date; send `content_html` to all active
subs.

New:
1. Load **all** report rows for the date (`select('*').eq('report_date', date)`),
   index by `lang` → `{ zh?, en? }`.
2. If neither is `ready`, skip as today. (A row may be `generating`/absent.)
3. Active subscribers now include `lang`: `select('user_id, email, lang')`.
4. For each pending subscriber, pick `byLang[sub.lang]`. If that language's row
   is missing or not `ready`, **skip** that subscriber this run (do not write a
   delivery row), so they're retried next run when their version lands.
5. Send with that row's `title` as subject and a language-based `from`
   (`美股日报` for zh, `US Stock Daily` for en). Insert the delivery row against
   that row's `report_id`.
6. **"All sent" marking:** mark a report row `status:'sent'` only when every
   active subscriber *of that language* has a delivery row for that
   `report_id`. Compute per-language: for `lang L`, pending_L = active subs with
   `lang=L` and no delivery on `report_L.id`; when pending_L hits 0 and no
   failures, set `report_L.status='sent'`. (Generalizes the current single-report
   logic to per-language.)

Batching (`BATCH = 40`) stays global across both languages per trigger.

## Frontend display — archive & detail

- `src/pages/ReportsPage.tsx` and `src/pages/ReportDetailPage.tsx`: add
  `.eq('lang', lang)` (from `useLang()`) to the `reports` query so each date
  shows one row in the active UI language. Re-fetch when the toggle changes.
- `src/pages/PublicReportPage.tsx` / `functions/public-report.ts`: unchanged —
  they fetch a specific report by `id`, which is already language-specific. The
  share button shares whichever language row the user is viewing.
- Edge case: if a date has only the `zh` row (EN translation failed/not yet
  generated) and the user browses in EN, the archive shows nothing for that date
  in EN. Acceptable; rare and self-heals on re-run. Detail page: if the
  requested date has no row in the UI language, fall back to showing the other
  language's row with a small notice. (Keep simple: archive just omits; detail
  falls back.)

## Testing / verification

- **Unit:** `functions/_shared/report-date.ts` logic unchanged; existing test
  stays green.
- **Migration:** apply on a backend branch first (schema change to a table with
  live data + RLS). Verify existing rows became `lang='zh'`, the new unique key
  exists, and `reports_select_subscribed` still returns rows for a subscribed
  user. Merge to prod after.
- **Generation:** run the compute endpoint with `?force=1` against a test date;
  assert two rows (`zh`,`en`) exist, EN numbers/tables match ZH, `## Sources`
  heading translated with URLs intact.
- **Send:** seed two test subscribers (one `zh`, one `en`); trigger send; assert
  each received the correct-language subject/body and a delivery row keyed to the
  matching `report_id`.
- **Frontend:** build passes; archive shows one row per date per UI language;
  toggling the language switches the visible reports.

## Rollout / sequencing

1. Backend branch: apply migration, verify, merge to prod.
2. Deploy compute (`compute deploy ./compute/generate --name reportgen`) with the
   translate step.
3. Deploy `send-daily-report` edge function.
4. Deploy frontend (CtaBlock language picker + archive lang filter).

Backward compatibility: each step is safe on its own — the `lang` defaults make
old data and old code paths behave as before until the new code ships.

## Out of scope (YAGNI)

- More than two languages.
- Per-user independent UI-vs-email language history (we default email lang to UI
  lang at subscribe time; that's enough).
- Re-sending a corrected report after the fact.
