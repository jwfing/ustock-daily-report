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

  const existing = await admin.database
    .from('reports').select('id').eq('report_date', dateStr).limit(1)
  if (existing.error) return { status: 500, body: { error: existing.error.message } }
  if (existing.data && existing.data.length > 0) {
    return { status: 200, body: { skipped: 'already generated', date: dateStr } }
  }

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
      webSearch: { enabled: true, maxResults: 10 },
    })
  } catch (e) {
    return { status: 502, body: { error: `ai call failed: ${e?.message ?? String(e)}` } }
  }

  const choice = completion?.choices?.[0]
  let md = choice?.message?.content ?? ''
  if (!md.trim()) return { status: 502, body: { error: 'empty AI response' } }

  const annotations = choice?.message?.annotations ?? []
  if (annotations.length > 0) {
    const cites = annotations
      .filter((a) => a.type === 'url_citation')
      .map((a) => `- [${a.urlCitation.title ?? a.urlCitation.url}](${a.urlCitation.url})`)
    if (cites.length > 0) md += `\n\n## 数据来源\n\n${cites.join('\n')}\n`
  }

  const html = marked.parse(md)
  const title = `美股收盘日报｜${dateStr}`

  const insert = await admin.database.from('reports').insert([{
    report_date: dateStr, title, content_md: md, content_html: html,
    model: completion?.model ?? MODEL, status: 'ready',
  }]).select()
  if (insert.error) return { status: 500, body: { error: insert.error.message } }

  return { status: 200, body: { generated: true, date: dateStr, report_id: insert.data?.[0]?.id } }
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
  generate(force)
    .then((r) => send(r.status, r.body))
    .catch((e) => send(500, { error: e?.message ?? String(e) }))
})

server.listen(PORT, () => console.log(`generator listening on ${PORT}`))
