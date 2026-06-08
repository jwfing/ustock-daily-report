# 美股日报订阅 App — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一个免费的美股日报订阅 app：用户注册/登录后订阅，平台每个工作日 UTC 03:00 用 AI 生成统一日报、按 SES 限额分批邮件发送，用户也可在网站归档页阅读。

**Architecture:** InsForge 后端（Postgres + Auth + 边缘函数 + AI 网关 + Email + 定时任务）+ React/Vite 前端。两个定时边缘函数拆分"生成"与"发送"（方案 B）。生成与发送均以 `createAdminClient` 服务端权限运行、绕过 RLS；订阅者邮箱在订阅时反规范化存入 `subscriptions.email`，避免跨 `auth` schema 访问。

**Tech Stack:** Vite + React 18 + TypeScript + React Router + Tailwind CSS v3.4；`@insforge/sdk`；Deno 边缘函数；OpenRouter（`anthropic/claude-sonnet-4.5`）；InsForge `emails.send`（SES）。

**项目坐标：** appkey `4s425rbh`，region `us-east`，oss_host `https://4s425rbh.us-east.insforge.app`，函数 URL 前缀 `https://4s425rbh.us-east.insforge.app/functions/`。

---

## 文件结构

```
daily-report/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json / tsconfig.node.json
├─ tailwind.config.js / postcss.config.js
├─ vercel.json                      # SPA 路由回退
├─ .env                             # VITE_INSFORGE_URL / VITE_INSFORGE_ANON_KEY（gitignore）
├─ .env.example
├─ src/
│  ├─ main.tsx                      # 入口 + Router
│  ├─ index.css                     # tailwind directives
│  ├─ lib/insforge.ts               # SDK 单例
│  ├─ auth/AuthContext.tsx          # user/loading 上下文
│  ├─ components/Layout.tsx         # 顶栏 + 导航
│  ├─ components/Markdown.tsx       # 渲染日报 markdown
│  ├─ components/ProtectedRoute.tsx
│  ├─ pages/AuthPage.tsx            # 注册/验证码/登录三态
│  ├─ pages/HomePage.tsx            # 订阅/取消订阅
│  ├─ pages/ReportsPage.tsx         # 历史日报列表
│  └─ pages/ReportDetailPage.tsx    # 单篇日报全文
├─ supabase-free/                   # （仅本地源码，函数代码放这里便于版本管理）
│  └─ functions/
│     ├─ _shared/report-date.ts     # 纯函数：Pacific 报告日期/工作日判断
│     ├─ _shared/report-date.test.ts
│     ├─ generate-daily-report.ts
│     └─ send-daily-report.ts
├─ migrations/                      # CLI 生成的迁移文件
└─ docs/superpowers/specs/report-system-prompt.txt   # 已存在：prompt 原文
```

> 函数源码目录命名随意，本计划放在 `functions/`（见下文实际路径）。前端构建**不得**打包 `functions/`。

---

## Task 0: 脚手架与依赖

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `vercel.json`, `src/main.tsx`, `src/index.css`, `.env.example`, `.gitignore`(已存在则合并)

- [ ] **Step 1: 用 Vite 创建 React+TS 项目（在当前目录）**

```bash
npm create vite@latest . -- --template react-ts
# 若提示目录非空，选择 "Ignore files and continue"
npm install
npm install @insforge/sdk react-router-dom marked
npm install -D tailwindcss@3.4 postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: 配置 Tailwind** — 覆盖 `tailwind.config.js`：

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

替换 `src/index.css` 全部内容为：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: 写 `vercel.json`（SPA 回退）**

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

- [ ] **Step 4: 写入环境变量** — 取 anon key 并写 `.env`：

```bash
npx @insforge/cli secrets get ANON_KEY
```

`.env`（用上一步输出的值）：

```bash
VITE_INSFORGE_URL=https://4s425rbh.us-east.insforge.app
VITE_INSFORGE_ANON_KEY=<上面命令输出的 ANON_KEY>
```

`.env.example`：

```bash
VITE_INSFORGE_URL=
VITE_INSFORGE_ANON_KEY=
```

确认 `.gitignore` 含 `.env`、`.env.local`、`node_modules`、`dist`、`.insforge`。

- [ ] **Step 5: 验证脚手架可启动**

Run: `npm run build`
Expected: 构建成功，生成 `dist/`。

- [ ] **Step 6: Commit**（若 `git init` 过；不是 git 仓库则跳过所有 commit 步骤）

```bash
git add -A && git commit -m "chore: scaffold vite react app with tailwind and insforge sdk"
```

---

## Task 1: 数据库迁移（表 + 索引 + RLS）

**Files:**
- Create: `migrations/<timestamp>_init-daily-report.sql`（用 CLI 生成文件名）

- [ ] **Step 1: 先核对当前线上 schema**

```bash
npx @insforge/cli db tables
npx @insforge/cli db migrations list
```
Expected: 无业务表（空库）。

- [ ] **Step 2: 生成迁移文件**

```bash
npx @insforge/cli db migrations new init-daily-report
```

- [ ] **Step 3: 写迁移内容**（编辑生成的文件；勿写 BEGIN/COMMIT）

```sql
-- subscriptions
create table public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  status      text not null default 'active' check (status in ('active','cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id)
);
create index subscriptions_status_idx on public.subscriptions (status);

-- reports
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  report_date  date not null unique,
  title        text not null,
  content_md   text not null,
  content_html text,
  model        text not null,
  status       text not null default 'ready' check (status in ('ready','sent')),
  created_at   timestamptz not null default now()
);
create index reports_date_desc_idx on public.reports (report_date desc);

-- report_deliveries
create table public.report_deliveries (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  status      text not null check (status in ('sent','failed')),
  error       text,
  created_at  timestamptz not null default now(),
  unique (report_id, user_id)
);
create index report_deliveries_report_idx on public.report_deliveries (report_id);

-- RLS
alter table public.subscriptions enable row level security;
alter table public.reports enable row level security;
alter table public.report_deliveries enable row level security;

-- subscriptions: 用户只能读写自己的行
create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = auth.uid());
create policy subscriptions_insert_own on public.subscriptions
  for insert with check (user_id = auth.uid());
create policy subscriptions_update_own on public.subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subscriptions_delete_own on public.subscriptions
  for delete using (user_id = auth.uid());

-- reports: 仅"有 active 订阅"的登录用户可读；无写策略（admin 客户端绕过 RLS）
create policy reports_select_subscribed on public.reports
  for select using (
    exists (
      select 1 from public.subscriptions s
      where s.user_id = auth.uid() and s.status = 'active'
    )
  );

-- report_deliveries: 客户端无任何策略（默认全部拒绝）
```

- [ ] **Step 4: 应用迁移**

```bash
npx @insforge/cli db migrations up --all
```
Expected: 成功，无错误。

- [ ] **Step 5: 验证**

```bash
npx @insforge/cli db tables
npx @insforge/cli db policies
```
Expected: 三张表存在；上述策略存在。

- [ ] **Step 6: Commit**

```bash
git add migrations && git commit -m "feat(db): subscriptions, reports, deliveries tables with RLS"
```

---

## Task 2: 配置 secrets

**Files:** 无（仅 CLI）

- [ ] **Step 1: 写入系统 prompt secret**（原文来自已存在的 `docs/superpowers/specs/report-system-prompt.txt`）

```bash
npx @insforge/cli secrets add REPORT_SYSTEM_PROMPT "$(cat docs/superpowers/specs/report-system-prompt.txt)"
```

- [ ] **Step 2: 获取并写入 OpenRouter key**

```bash
npx @insforge/cli ai setup            # 写 OPENROUTER_API_KEY 到 .env.local
# 取出值写成 secret，供边缘函数运行时使用：
grep OPENROUTER_API_KEY .env.local
npx @insforge/cli secrets add OPENROUTER_API_KEY "<上面的 sk-or-v1-... 值>"
```

- [ ] **Step 3: 写入 admin api key（供函数 createAdminClient 用）**

```bash
# 从 .insforge/project.json 读取 api_key（ik_... 开头）
npx @insforge/cli secrets add ADMIN_API_KEY "<.insforge/project.json 里的 api_key>"
```

- [ ] **Step 4: 写入 cron 共享密钥（防止函数被任意公网 POST 触发）**

```bash
# 自行生成一个随机串，例如：
npx @insforge/cli secrets add CRON_SECRET "$(openssl rand -hex 24)"
# 记下这个值，Task 5 创建 schedule 时也要用（通过 ${{secrets.CRON_SECRET}} 引用，无需手填）
```

- [ ] **Step 5: 验证 secrets 均已创建**

```bash
npx @insforge/cli secrets list
```
Expected: 列表含 `REPORT_SYSTEM_PROMPT`、`OPENROUTER_API_KEY`、`ADMIN_API_KEY`、`CRON_SECRET`（值隐藏）。

> 注意：从 `.env.local` 删除或保留 `OPENROUTER_API_KEY` 均可，但**不要**把它改成 `VITE_*` 前缀（绝不能进前端）。

---

## Task 3: 共享纯函数 `report-date` + 单元测试

边缘函数运行在 Deno，但纯逻辑用 vitest 在 Node 下测试（不依赖 Deno API）。

**Files:**
- Create: `functions/_shared/report-date.ts`
- Test: `functions/_shared/report-date.test.ts`

- [ ] **Step 1: 写失败测试** — `functions/_shared/report-date.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { pacificParts, shouldGenerate } from './report-date'

describe('pacificParts', () => {
  // UTC 2026-06-09T03:00 = PDT 2026-06-08 20:00（周一）
  it('maps UTC 03:00 to previous-day Pacific evening', () => {
    const p = pacificParts(new Date('2026-06-09T03:00:00Z'))
    expect(p.dateStr).toBe('2026-06-08')
    expect(p.weekday).toBe(1) // Monday
  })
})

describe('shouldGenerate', () => {
  it('true on a Pacific weekday', () => {
    // UTC Tue 03:00 -> PT Mon evening
    expect(shouldGenerate(new Date('2026-06-09T03:00:00Z')).ok).toBe(true)
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run functions/_shared/report-date.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `functions/_shared/report-date.ts`**

```ts
// 纯函数：根据传入时刻计算"美西(Pacific)报告日期"和是否应生成。
// 用 Intl 处理夏令时；不依赖 Deno/Node 专有 API。

export interface PacificParts {
  dateStr: string // YYYY-MM-DD（Pacific 当地日期）
  weekday: number // 0=Sun ... 6=Sat（Pacific 当地星期）
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run functions/_shared/report-date.test.ts`
Expected: PASS（4 passed）。

- [ ] **Step 5: Commit**

```bash
git add functions/_shared && git commit -m "feat(fn): pacific report-date helper with tests"
```

---

## Task 4: `generate-daily-report` 边缘函数

**Files:**
- Create: `functions/generate-daily-report.ts`

- [ ] **Step 1: 写函数源码**

```ts
import { createAdminClient } from 'npm:@insforge/sdk'
import { marked } from 'npm:marked'
// Deno 下用相对导入共享纯函数
import { shouldGenerate } from './_shared/report-date.ts'

const MODEL = 'anthropic/claude-sonnet-4.5'

export default async function (req: Request): Promise<Response> {
  // 仅允许 cron（带正确密钥）触发
  if (req.headers.get('X-Cron-Secret') !== Deno.env.get('CRON_SECRET')) {
    return json({ error: 'forbidden' }, 403)
  }

  const now = new Date()
  const gen = shouldGenerate(now)
  if (!gen.ok) {
    return json({ skipped: 'not a Pacific weekday', date: gen.dateStr })
  }

  const admin = createAdminClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    apiKey: Deno.env.get('ADMIN_API_KEY'),
  })

  // 幂等：当天已生成则跳过
  const existing = await admin.database
    .from('reports').select('id').eq('report_date', gen.dateStr).limit(1)
  if (existing.error) return json({ error: existing.error.message }, 500)
  if (existing.data && existing.data.length > 0) {
    return json({ skipped: 'already generated', date: gen.dateStr })
  }

  const systemPrompt = Deno.env.get('REPORT_SYSTEM_PROMPT') ?? '你是一名专业的美股市场日报分析师。'
  const userPrompt = `请生成 ${gen.dateStr}（美国西部时间）的《美股收盘日报》。严格按系统提示中《美股收盘日报》模板的结构输出中文 Markdown。标题首行为：美股收盘日报｜${gen.dateStr}。只输出日报正文 Markdown，不要额外说明。`

  // 调 OpenRouter
  const aiResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 8000,
    }),
  })
  if (!aiResp.ok) {
    const t = await aiResp.text()
    return json({ error: `openrouter ${aiResp.status}: ${t}` }, 502)
  }
  const ai = await aiResp.json()
  const md: string = ai?.choices?.[0]?.message?.content ?? ''
  if (!md.trim()) return json({ error: 'empty AI response' }, 502)

  const html = marked.parse(md) as string
  const title = `美股收盘日报｜${gen.dateStr}`

  const insert = await admin.database.from('reports').insert([{
    report_date: gen.dateStr,
    title,
    content_md: md,
    content_html: html,
    model: ai?.model ?? MODEL,
    status: 'ready',
  }]).select()
  if (insert.error) return json({ error: insert.error.message }, 500)

  return json({ generated: true, date: gen.dateStr, report_id: insert.data?.[0]?.id })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: 部署函数**

```bash
npx @insforge/cli functions deploy generate-daily-report --file ./functions/generate-daily-report.ts --name "Generate Daily Report"
```
Expected: created/updated 成功。

- [ ] **Step 3: 手动触发验证（带密钥）**

```bash
# 取 CRON_SECRET 明文用于本地手测
npx @insforge/cli secrets get CRON_SECRET
curl -s -X POST "https://4s425rbh.us-east.insforge.app/functions/generate-daily-report" \
  -H "X-Cron-Secret: <CRON_SECRET 明文>" | head -c 500
```
Expected：若当前为 Pacific 工作日 → `{"generated":true,...}` 或（再次调用）`{"skipped":"already generated",...}`；周末 → `{"skipped":"not a Pacific weekday",...}`。无密钥时应返回 403。

- [ ] **Step 4: 确认落库**

```bash
npx @insforge/cli db query "select report_date, title, status, length(content_md) from reports order by report_date desc limit 3"
```
Expected：存在当天报告行（若为工作日）。

- [ ] **Step 5: Commit**

```bash
git add functions/generate-daily-report.ts && git commit -m "feat(fn): generate-daily-report via OpenRouter + admin insert"
```

---

## Task 5: `send-daily-report` 边缘函数

发送逻辑：取当天 ready 报告 → 取所有 active 订阅 → 取该报告已有的 deliveries → 在内存里求差集 → 限额内发一批、逐条写 deliveries → 全部投递完则把 report 置 sent。可重复执行、不重发。

**Files:**
- Create: `functions/send-daily-report.ts`

- [ ] **Step 1: 写函数源码**

```ts
import { createAdminClient } from 'npm:@insforge/sdk'
import { pacificParts } from './_shared/report-date.ts'

const BATCH = 40 // 每次触发最多发送数量（留出 SES 每小时限额余量）

export default async function (req: Request): Promise<Response> {
  if (req.headers.get('X-Cron-Secret') !== Deno.env.get('CRON_SECRET')) {
    return json({ error: 'forbidden' }, 403)
  }

  const admin = createAdminClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    apiKey: Deno.env.get('ADMIN_API_KEY'),
  })

  const { dateStr } = pacificParts(new Date())

  // 当天报告
  const rep = await admin.database
    .from('reports').select('*').eq('report_date', dateStr).limit(1)
  if (rep.error) return json({ error: rep.error.message }, 500)
  const report = rep.data?.[0]
  if (!report) return json({ skipped: 'no report for today', date: dateStr })

  // active 订阅者
  const subs = await admin.database
    .from('subscriptions').select('user_id, email').eq('status', 'active')
  if (subs.error) return json({ error: subs.error.message }, 500)
  const activeSubs = subs.data ?? []

  // 已投递（任意状态都算"已处理"，failed 不自动重试）
  const dels = await admin.database
    .from('report_deliveries').select('user_id').eq('report_id', report.id)
  if (dels.error) return json({ error: dels.error.message }, 500)
  const handled = new Set((dels.data ?? []).map((d: { user_id: string }) => d.user_id))

  const pending = activeSubs.filter((s: { user_id: string }) => !handled.has(s.user_id))

  if (pending.length === 0) {
    if (report.status !== 'sent') {
      await admin.database.from('reports').update({ status: 'sent' }).eq('id', report.id)
    }
    return json({ done: true, date: dateStr, remaining: 0 })
  }

  const batch = pending.slice(0, BATCH)
  let sent = 0, failed = 0
  for (const sub of batch) {
    const { error } = await admin.emails.send({
      to: sub.email,
      subject: report.title,
      html: report.content_html ?? `<pre>${escapeHtml(report.content_md)}</pre>`,
      from: '美股日报',
    })
    await admin.database.from('report_deliveries').insert([{
      report_id: report.id,
      user_id: sub.user_id,
      email: sub.email,
      status: error ? 'failed' : 'sent',
      error: error ? String(error.message ?? error) : null,
    }])
    if (error) failed++; else sent++
  }

  const remaining = pending.length - batch.length
  if (remaining === 0 && failed === 0) {
    await admin.database.from('reports').update({ status: 'sent' }).eq('id', report.id)
  }
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

- [ ] **Step 2: 部署函数**

```bash
npx @insforge/cli functions deploy send-daily-report --file ./functions/send-daily-report.ts --name "Send Daily Report"
```
Expected: 成功。

- [ ] **Step 3: 手动触发验证**（需先有当天报告 + 至少一个 active 订阅；订阅在 Task 8 完成后再回归测）

```bash
curl -s -X POST "https://4s425rbh.us-east.insforge.app/functions/send-daily-report" \
  -H "X-Cron-Secret: <CRON_SECRET 明文>" | head -c 500
```
Expected：`{"date":"...","sent":N,"failed":0,"remaining":0}` 或 `{"skipped":"no report for today"}`。

- [ ] **Step 4: Commit**

```bash
git add functions/send-daily-report.ts && git commit -m "feat(fn): send-daily-report batched, idempotent delivery"
```

---

## Task 6: 创建定时任务（两个 cron）

**Files:** 无（仅 CLI）

- [ ] **Step 1: 创建生成调度（每天 UTC 03:00）**

```bash
npx @insforge/cli schedules create \
  --name "Generate Daily Report" \
  --cron "0 3 * * *" \
  --url "https://4s425rbh.us-east.insforge.app/functions/generate-daily-report" \
  --method POST \
  --headers '{"X-Cron-Secret": "${{secrets.CRON_SECRET}}"}'
```

- [ ] **Step 2: 创建发送调度（UTC 03:00–09:00 每 30 分钟排空）**

```bash
npx @insforge/cli schedules create \
  --name "Send Daily Report" \
  --cron "*/30 3-9 * * *" \
  --url "https://4s425rbh.us-east.insforge.app/functions/send-daily-report" \
  --method POST \
  --headers '{"X-Cron-Secret": "${{secrets.CRON_SECRET}}"}'
```

- [ ] **Step 3: 验证**

```bash
npx @insforge/cli schedules list
```
Expected：两个 schedule，active=true，cron/URL 正确。

---

## Task 7: 前端 SDK 单例 + Auth 上下文

**Files:**
- Create: `src/lib/insforge.ts`, `src/auth/AuthContext.tsx`

- [ ] **Step 1: SDK 单例** — `src/lib/insforge.ts`

```ts
import { createClient } from '@insforge/sdk'

export const insforge = createClient({
  baseUrl: import.meta.env.VITE_INSFORGE_URL,
  anonKey: import.meta.env.VITE_INSFORGE_ANON_KEY,
})
```

- [ ] **Step 2: Auth 上下文** — `src/auth/AuthContext.tsx`

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { insforge } from '../lib/insforge'

interface User { id: string; email: string }
interface AuthState { user: User | null; loading: boolean; refresh: () => Promise<void> }

const AuthContext = createContext<AuthState>({ user: null, loading: true, refresh: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const { data, error } = await insforge.auth.getCurrentUser()
    setUser(error ? null : ((data?.user as User) ?? null))
    setLoading(false)
  }

  useEffect(() => { void refresh() }, [])

  return <AuthContext.Provider value={{ user, loading, refresh }}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
```

- [ ] **Step 3: 编译校验**

Run: `npm run build`
Expected：成功（暂未被引用也应通过类型检查）。

- [ ] **Step 4: Commit**

```bash
git add src/lib src/auth && git commit -m "feat(fe): insforge sdk singleton + auth context"
```

---

## Task 8: 路由骨架 + Layout + ProtectedRoute + Markdown

**Files:**
- Create: `src/components/Layout.tsx`, `src/components/ProtectedRoute.tsx`, `src/components/Markdown.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: `src/components/Markdown.tsx`**

```tsx
import { marked } from 'marked'

export function Markdown({ md }: { md: string }) {
  const html = marked.parse(md) as string
  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
```

- [ ] **Step 2: `src/components/Layout.tsx`**

```tsx
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useAuth } from '../auth/AuthContext'

export function Layout() {
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()
  async function signOut() {
    await insforge.auth.signOut()
    await refresh()
    navigate('/')
  }
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <Link to="/" className="font-semibold">美股日报</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/reports" className="hover:underline">日报归档</Link>
            {loading ? null : user ? (
              <button onClick={signOut} className="text-slate-500 hover:underline">退出</button>
            ) : (
              <Link to="/auth" className="text-blue-600 hover:underline">登录</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4"><Outlet /></main>
    </div>
  )
}
```

- [ ] **Step 3: `src/components/ProtectedRoute.tsx`**

```tsx
import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="text-slate-500">加载中…</p>
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}
```

- [ ] **Step 4: 重写 `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { AuthPage } from './pages/AuthPage'
import { ReportsPage } from './pages/ReportsPage'
import { ReportDetailPage } from './pages/ReportDetailPage'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/auth', element: <AuthPage /> },
      { path: '/reports', element: <ProtectedRoute><ReportsPage /></ProtectedRoute> },
      { path: '/reports/:id', element: <ProtectedRoute><ReportDetailPage /></ProtectedRoute> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
)
```

> 本步骤引用了尚未创建的页面（Task 9/10/11）。先创建占位以便编译，或按顺序在创建页面后再 build。占位最简：每个页面 `export function X(){ return null }`，后续任务替换。

- [ ] **Step 5: 创建占位页面文件**（内容将在后续任务替换）

`src/pages/HomePage.tsx`、`src/pages/AuthPage.tsx`、`src/pages/ReportsPage.tsx`、`src/pages/ReportDetailPage.tsx` 各写：

```tsx
export function HomePage() { return null }      // 对应文件改对应导出名
```

- [ ] **Step 6: 编译校验**

Run: `npm run build`
Expected：成功。

- [ ] **Step 7: Commit**

```bash
git add src/components src/main.tsx src/pages && git commit -m "feat(fe): router, layout, protected route, markdown"
```

---

## Task 9: 注册 / 验证码 / 登录页（`AuthPage`）

后端配置：`requireEmailVerification=true`，`verifyEmailMethod=code`，OAuth providers `github,google`。

**Files:**
- Modify: `src/pages/AuthPage.tsx`

- [ ] **Step 1: 实现 `AuthPage`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useAuth } from '../auth/AuthContext'

type Mode = 'signin' | 'signup' | 'verify'

export function AuthPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function done() { await refresh(); navigate('/') }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { error } = await insforge.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) { setMsg(error.statusCode === 403 ? '邮箱未验证，请先完成验证' : `登录失败：${error.message}`); if (error.statusCode === 403) setMode('verify'); return }
    await done()
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { data, error } = await insforge.auth.signUp({ email, password, name })
    setBusy(false)
    if (error) { setMsg(`注册失败：${error.message}`); return }
    if (data?.requireEmailVerification) { setMode('verify'); setMsg('验证码已发送到邮箱，请输入。'); return }
    await done()
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { error } = await insforge.auth.verifyEmail({ email, otp })
    setBusy(false)
    if (error) { setMsg('验证码无效或已过期'); return }
    await done() // verifyEmail 成功即已登录
  }

  async function oauth(provider: 'google' | 'github') {
    await insforge.auth.signInWithOAuth(provider, { redirectTo: window.location.origin + '/' })
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">
        {mode === 'signup' ? '注册' : mode === 'verify' ? '验证邮箱' : '登录'}
      </h1>

      {mode === 'verify' ? (
        <form onSubmit={onVerify} className="space-y-3">
          <input className="w-full rounded border p-2" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="w-full rounded border p-2" placeholder="6 位验证码" value={otp} onChange={e => setOtp(e.target.value)} />
          <button disabled={busy} className="w-full rounded bg-blue-600 p-2 text-white">确认</button>
          <button type="button" className="text-sm text-slate-500" onClick={() => insforge.auth.resendVerificationEmail({ email })}>重发验证码</button>
        </form>
      ) : (
        <form onSubmit={mode === 'signup' ? onSignUp : onSignIn} className="space-y-3">
          {mode === 'signup' && (
            <input className="w-full rounded border p-2" placeholder="昵称" value={name} onChange={e => setName(e.target.value)} />
          )}
          <input className="w-full rounded border p-2" placeholder="邮箱" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="w-full rounded border p-2" placeholder="密码（≥6 位）" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button disabled={busy} className="w-full rounded bg-blue-600 p-2 text-white">{mode === 'signup' ? '注册' : '登录'}</button>
        </form>
      )}

      {msg && <p className="mt-3 text-sm text-amber-700">{msg}</p>}

      <div className="mt-4 flex gap-3">
        <button onClick={() => oauth('google')} className="flex-1 rounded border p-2 text-sm">Google 登录</button>
        <button onClick={() => oauth('github')} className="flex-1 rounded border p-2 text-sm">GitHub 登录</button>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {mode === 'signup' ? '已有账号？' : '没有账号？'}{' '}
        <button className="text-blue-600" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
          {mode === 'signup' ? '去登录' : '去注册'}
        </button>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: 配置 OAuth 回调允许的 redirect URL**（确保本地与线上 origin 都在允许列表）

```bash
npx @insforge/cli metadata --json | grep -i redirect   # 查看 allowedRedirectUrls
# 如需添加，用 config：export → 编辑 [auth].allowed_redirect_urls → apply
```

- [ ] **Step 3: 编译校验**

Run: `npm run build`
Expected：成功。

- [ ] **Step 4: 手动验证（dev）**

Run: `npm run dev`，在浏览器注册一个邮箱 → 收到验证码邮件 → 输入验证码 → 进入首页（顶栏出现"退出"）。
Expected：注册→验证→登录闭环可用。

- [ ] **Step 5: Commit**

```bash
git add src/pages/AuthPage.tsx && git commit -m "feat(fe): auth page with code verification and oauth"
```

---

## Task 10: 订阅首页（`HomePage`）

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: 实现 `HomePage`**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useAuth } from '../auth/AuthContext'

interface Subscription { id: string; status: string }

export function HomePage() {
  const { user, loading } = useAuth()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  async function load() {
    if (!user) { setReady(true); return }
    const { data } = await insforge.database
      .from('subscriptions').select('id, status').eq('user_id', user.id).limit(1)
    setSub((data?.[0] as Subscription) ?? null)
    setReady(true)
  }
  useEffect(() => { if (!loading) void load() }, [loading, user?.id])

  async function subscribe() {
    if (!user) return
    setBusy(true)
    if (sub) {
      await insforge.database.from('subscriptions')
        .update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', sub.id)
    } else {
      await insforge.database.from('subscriptions')
        .insert([{ user_id: user.id, email: user.email, status: 'active' }])
    }
    await load(); setBusy(false)
  }

  async function unsubscribe() {
    if (!sub) return
    setBusy(true)
    await insforge.database.from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', sub.id)
    await load(); setBusy(false)
  }

  const active = sub?.status === 'active'

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">美股收盘日报 · 免费订阅</h1>
        <p className="mt-2 text-slate-600">
          订阅后，每个工作日美西时间晚上由平台统一生成《美股收盘日报》并发送到你的邮箱，也可在归档页随时回看。
        </p>
      </section>

      {loading || !ready ? (
        <p className="text-slate-500">加载中…</p>
      ) : !user ? (
        <Link to="/auth" className="inline-block rounded bg-blue-600 px-4 py-2 text-white">登录后订阅</Link>
      ) : active ? (
        <div className="space-y-3">
          <p className="text-green-700">✓ 你已订阅（{user.email}）</p>
          <button disabled={busy} onClick={unsubscribe} className="rounded border px-4 py-2">取消订阅</button>
          <Link to="/reports" className="ml-3 text-blue-600 hover:underline">查看日报归档 →</Link>
        </div>
      ) : (
        <button disabled={busy} onClick={subscribe} className="rounded bg-blue-600 px-4 py-2 text-white">免费订阅</button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 编译校验**

Run: `npm run build`
Expected：成功。

- [ ] **Step 3: 手动验证**：登录后点击"免费订阅" → 状态变为已订阅；刷新后保持；点"取消订阅"恢复。

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx && git commit -m "feat(fe): subscribe/unsubscribe home page"
```

---

## Task 11: 日报归档列表 + 详情（`ReportsPage` / `ReportDetailPage`）

**Files:**
- Modify: `src/pages/ReportsPage.tsx`, `src/pages/ReportDetailPage.tsx`

- [ ] **Step 1: 实现 `ReportsPage`**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { insforge } from '../lib/insforge'

interface ReportRow { id: string; report_date: string; title: string }

export function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.database
        .from('reports').select('id, report_date, title')
        .order('report_date', { ascending: false }).limit(60)
      if (error) setErr('需要有效订阅才能查看日报。')
      else setRows((data as ReportRow[]) ?? [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <p className="text-slate-500">加载中…</p>

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">日报归档</h1>
      {err ? (
        <p className="text-amber-700">{err} <Link className="text-blue-600" to="/">去订阅</Link></p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500">暂无日报。</p>
      ) : (
        <ul className="divide-y rounded border bg-white">
          {rows.map(r => (
            <li key={r.id}>
              <Link to={`/reports/${r.id}`} className="flex justify-between p-3 hover:bg-slate-50">
                <span>{r.title}</span>
                <span className="text-slate-400">{r.report_date}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 实现 `ReportDetailPage`**

```tsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { Markdown } from '../components/Markdown'

export function ReportDetailPage() {
  const { id } = useParams()
  const [md, setMd] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data, error } = await insforge.database
        .from('reports').select('title, content_md').eq('id', id).limit(1)
      if (error || !data?.[0]) { setErr('无法加载该日报（需有效订阅）。'); return }
      setTitle(data[0].title as string)
      setMd(data[0].content_md as string)
    })()
  }, [id])

  if (err) return <p className="text-amber-700">{err} <Link className="text-blue-600" to="/reports">返回</Link></p>
  if (md === null) return <p className="text-slate-500">加载中…</p>

  return (
    <article>
      <Link to="/reports" className="text-sm text-blue-600">← 返回归档</Link>
      <h1 className="my-3 text-xl font-semibold">{title}</h1>
      <Markdown md={md} />
    </article>
  )
}
```

- [ ] **Step 3: 安装 typography 插件（让 prose 生效，可选但推荐）**

```bash
npm install -D @tailwindcss/typography
```
在 `tailwind.config.js` 的 `plugins` 加入 `require('@tailwindcss/typography')`（用 ESM：`import typography from '@tailwindcss/typography'` 并放入数组）。

- [ ] **Step 4: 编译校验**

Run: `npm run build`
Expected：成功。

- [ ] **Step 5: 手动验证**：已订阅用户访问 `/reports` 看到列表，点开渲染 Markdown 全文；未订阅用户看到"去订阅"提示。

- [ ] **Step 6: Commit**

```bash
git add src/pages/ReportsPage.tsx src/pages/ReportDetailPage.tsx tailwind.config.js package.json && git commit -m "feat(fe): reports archive list and detail"
```

---

## Task 12: 部署上线

**Files:** 无（CLI）

- [ ] **Step 1: 本地构建确认**

Run: `npm run build`
Expected：成功，无类型错误。

- [ ] **Step 2: 设置部署环境变量（持久）**

```bash
npx @insforge/cli deployments env set VITE_INSFORGE_URL https://4s425rbh.us-east.insforge.app
npx @insforge/cli deployments env set VITE_INSFORGE_ANON_KEY <ANON_KEY 值>
npx @insforge/cli deployments env list
```

- [ ] **Step 3: 部署项目源目录（非 dist）**

```bash
npx @insforge/cli deployments deploy .
```
Expected：返回部署 URL。

- [ ] **Step 4: 把线上 origin 加入 OAuth 允许 redirect 列表**（用部署返回的 URL）

```bash
npx @insforge/cli config export
# 编辑 insforge.toml 的 [auth] allowed_redirect_urls，加入 https://<部署域名>/ 与 /auth
npx @insforge/cli --json --yes config apply
```

- [ ] **Step 5: 线上冒烟**：打开部署 URL → 注册/验证/登录 → 订阅 → 触发一次 `generate-daily-report`（带密钥）→ 触发 `send-daily-report` → 确认收到邮件、归档页可读。

---

## Task 13: 端到端回归验证

**Files:** 无

- [ ] **Step 1: 幂等**：连续两次 `generate-daily-report` → 第二次返回 `skipped: already generated`；`db query "select count(*) from reports where report_date=..."` 应为 1。
- [ ] **Step 2: 不重发**：连续两次 `send-daily-report` → 第二次 `remaining:0` 且不新增 `report_deliveries`（按 user 唯一）。
- [ ] **Step 3: RLS**：未订阅的新用户访问 `/reports` 列表为空/提示订阅；订阅后可见。
- [ ] **Step 4: 安全**：不带 `X-Cron-Secret` POST 两个函数 → 403。
- [ ] **Step 5: 时区**：用 `db query` 或函数日志确认报告 `report_date` 与预期 Pacific 日期一致。

---

## Self-Review 备忘（已核对）

- **Spec 覆盖**：表/RLS(Task1) · secrets/prompt(Task2) · 生成函数(Task4) · 发送函数(Task5) · 调度(Task6) · 注册/验证/登录(Task9) · 订阅(Task10) · 归档/详情(Task11) · 部署(Task12) · 时区纯函数+测试(Task3)。已知限制（无实时行情）在 spec 记录，代码以 prompt 驱动生成，符合预期。
- **类型一致**：`subscriptions(user_id,email,status)`、`reports(report_date,title,content_md,content_html,model,status)`、`report_deliveries(report_id,user_id,email,status,error)` 在迁移与前后端代码中字段名一致。
- **安全**：函数以 `CRON_SECRET` 头鉴权；admin api key、OpenRouter key 仅存 secret，绝不进前端。
- **待实现期确认项**：① 边缘函数运行时是否自动注入 `INSFORGE_BASE_URL`（部署文档示例如此使用）；若未注入，则把它也加为 secret。② `ADMIN_API_KEY` 是否与保留 secret 命名冲突——`secrets list` 核对，必要时改名。③ Deno 下 `npm:@insforge/sdk` 的 `createAdminClient` / `admin.emails.send` 行为以实跑为准，若 admin 客户端不支持 emails，则在发送函数内改用 anon 客户端调用 `emails.send`（emails 用 anonKey 即可，见 email 文档）。
```

---

## 实现期变更记录（与原计划的偏差）

实跑中发现的约束，导致以下调整：

1. **AI 网关而非 OpenRouter key。** 本后端 `ai setup` 不可用；改用 InsForge SDK 的 `client.ai.chat.completions.create()`，并开启 `webSearch: { enabled: true, maxResults: 10 }`——模型因此能联网取**真实当日行情**并标注来源，原"无实时数据"限制大幅缓解。无需 `OPENROUTER_API_KEY`。
2. **不需要 `ADMIN_API_KEY` secret。** 后端已自动向函数注入 reserved secrets `INSFORGE_BASE_URL`、`API_KEY`、`ANON_KEY`；函数直接 `createAdminClient({ baseUrl: INSFORGE_BASE_URL, apiKey: API_KEY })`。
3. **生成移到 Compute 容器（关键架构变更）。** 完整 15 节 + 联网报告生成约需 **228s**，超过边缘函数 ~200s 网关上限（同步 504；`EdgeRuntime.waitUntil` 后台任务也会在 ~200s 被杀）。因此生成逻辑放到 `compute/generate`（Node HTTP 容器，无超时），系统 prompt 打入镜像，小配置经 `--env` 注入。**send 仍是边缘函数**（快、在上限内）。
4. **`reports.status` 增加 `'generating'`**（迁移 `20260608005314`）：容器写入前先占位（实际容器实现里可一次性写入 ready，占位主要用于边缘背景方案，已弃用）。
5. **`force=1`、`date=` 参数**：生成/发送函数支持 secret-gated 的手动触发与指定日期，便于回填与测试。

### 阻塞项（需后端升级）
Compute 部署当前被后端版本 bug 阻断：旧版 InsForge 用 `<projectId>-network` 作 Fly 网络名，本项目 UUID 以数字 `2` 开头被 Fly 拒绝（`Name not a valid network name`）。修复（`n-<appkey>`）在新版 InsForge 中已存在。**升级本项目的 InsForge 服务端后**，重跑：

```bash
API_KEY=$(npx @insforge/cli secrets get API_KEY | sed 's/^API_KEY = //')
CS=$(npx @insforge/cli secrets get CRON_SECRET | sed 's/^CRON_SECRET = //')
ENVJSON=$(printf '{"INSFORGE_URL":"https://4s425rbh.us-east.insforge.app","API_KEY":"%s","CRON_SECRET":"%s"}' "$API_KEY" "$CS")
npx @insforge/cli compute deploy compute/generate --name reportgen --port 8080 --cpu shared-1x --memory 512 --env "$ENVJSON"
# 取容器 endpoint：
npx @insforge/cli compute list
# 用 endpoint 建生成调度（UTC 03:00 工作日由函数内 Pacific 判断）：
npx @insforge/cli schedules create --name "Generate Daily Report" --cron "0 3 * * *" \
  --url "https://reportgen-<project>.fly.dev/?" --method POST \
  --headers '{"X-Cron-Secret": "${{secrets.CRON_SECRET}}"}'
# 冒烟：
curl -X POST "https://reportgen-<project>.fly.dev/?force=1" -H "X-Cron-Secret: $CS"
```
