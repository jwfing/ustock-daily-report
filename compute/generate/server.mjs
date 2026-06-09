import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createAdminClient } from '@insforge/sdk'
import { marked } from 'marked'

const MODEL = 'anthropic/claude-sonnet-4.5'
const PORT = Number(process.env.PORT) || 8080
const __dir = dirname(fileURLToPath(import.meta.url))

const BASE_URL = process.env.INSFORGE_URL
const API_KEY = process.env.API_KEY
const CRON_SECRET = process.env.CRON_SECRET
// Prompt is baked into the image; allow an env override if ever needed.
const SYSTEM_PROMPT =
  process.env.REPORT_SYSTEM_PROMPT ||
  readFileSync(join(__dir, 'report-system-prompt.txt'), 'utf8')

const TRANSLATE_PROMPT =
  'You are a professional financial translator. Translate the following US-stock ' +
  'market daily report from Chinese to English. Rules: preserve every number, ' +
  'ticker symbol, percentage, table, and Markdown structure exactly as in the ' +
  'source; do not add, drop, or reinterpret any data. Translate the heading ' +
  '"## 数据来源" to "## Sources" but keep all URLs and link targets unchanged. ' +
  'Output only the translated Markdown, with no preamble or commentary.'

// Call OpenRouter directly (not through the InsForge AI gateway). The gateway
// caps requests at ~300s, and a web-search-augmented 16k-token generation
// exceeds that, returning 504. This container is long-lived, so we own the
// timeout (default 15 min) and bypass the gateway wall entirely.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 900_000 // 15 min
const SEARCH_PROMPT =
  'Search English-language authoritative US financial sources only ' +
  '(CNBC, Reuters, Bloomberg, MarketWatch, WSJ, Yahoo Finance, Nasdaq, CME, FRED). ' +
  'Prefer primary/official data.'

async function openrouterChat({ messages, maxTokens, webSearch }) {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set')
  const body = { model: MODEL, messages, max_tokens: maxTokens }
  if (webSearch) {
    // Bounded single web search (Exa default), with url_citation annotations.
    body.plugins = [{ id: 'web', max_results: 10, search_prompt: SEARCH_PROMPT }]
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS)
  let res
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://4s425rbh.insforge.site',
        'X-Title': 'US Stock Daily',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  const text = await res.text()
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`)
  let json
  try { json = JSON.parse(text) } catch { throw new Error(`OpenRouter bad JSON: ${text.slice(0, 300)}`) }
  if (json.error) throw new Error(`OpenRouter error: ${json.error.message ?? JSON.stringify(json.error)}`)
  return json
}

// Pacific report-date logic. Mirrors functions/_shared/report-date.ts (unit-tested).
function pacificDate(now) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  })
  const parts = fmt.formatToParts(now)
  const get = (t) => parts.find((p) => p.type === t)?.value ?? ''
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { dateStr: `${get('year')}-${get('month')}-${get('day')}`, weekday: map[get('weekday')] ?? -1 }
}

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
      completion = await openrouterChat({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 16000,
        webSearch: true,
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
        .filter((a) => a.type === 'url_citation' && a.url_citation?.url)
        .map((a) => `- [${a.url_citation.title ?? a.url_citation.url}](${a.url_citation.url})`)
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
      tr = await openrouterChat({
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

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  if (url.pathname === '/health') return send(200, { ok: true })

  if (req.method !== 'POST') return send(405, { error: 'method not allowed' })
  if (req.headers['x-cron-secret'] !== CRON_SECRET) return send(403, { error: 'forbidden' })

  const force = url.searchParams.get('force') === '1'
  const wait = url.searchParams.get('wait') === '1'

  // Synchronous mode (manual / debug): run to completion and return the result.
  if (wait) {
    generate(force)
      .then((r) => send(r.status, r.body))
      .catch((e) => send(500, { error: e?.message ?? String(e) }))
    return
  }

  // Default: fire-and-forget. Generation takes minutes; the scheduler's HTTP
  // client times out long before that. Ack immediately and run in the
  // background, logging the outcome (inspect the reports table to confirm).
  send(202, { accepted: true, date: pacificDate(new Date()).dateStr })
  generate(force)
    .then((r) => console.log('generate result:', JSON.stringify(r.body)))
    .catch((e) => console.error('generate failed:', e?.message ?? String(e)))
})

server.listen(PORT, () => console.log(`generator listening on ${PORT}`))
