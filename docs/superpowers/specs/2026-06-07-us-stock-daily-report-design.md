# 美股日报订阅 App — 设计文档

- **日期：** 2026-06-07
- **后端：** InsForge 项目 `afe` (`2deff9ae-3984-4101-b56f-fe4f8af513ef`)，API base `https://4s425rbh.us-east.insforge.app`
- **前端：** React + Vite，部署到公网（Vercel via InsForge deployments）

## 1. 概述

一个免费的美股日报订阅产品。用户注册并登录后，可一键免费订阅。订阅后，平台在每个工作日统一生成一份《美股收盘日报》并通过邮件发送给所有有效订阅者；用户也可在网站归档页在线阅读历史日报。

报告由 InsForge AI 模型网关（默认 `anthropic/claude-sonnet-4.5`）根据一个可配置的系统 prompt 生成，全平台共用同一份日报。

### 已知限制（重要）

- **数据时效性：** 报告由大语言模型直接生成，模型**不具备当天实时联网行情**。因此系统 prompt 中"使用最新数据、注明真实来源链接、不要编造数据"等要求**无法被严格满足**——产出更接近一个结构完整、专业的分析框架，而非可交易级别的真实行情数据。本期目标是先跑通"注册 → 订阅 → 生成 → 发送 → 阅读"的完整闭环；接入真实行情 API 是后续迭代项。
- **范围：** 本期**只生成工作日《美股收盘日报》**。系统 prompt 虽同时定义了《美股周报》，但本期不调度、不生成周报。

## 2. 时区与调度策略

- 目标投递时间：**美西时间晚上 8 点的工作日**。
- 经确认，**发送时间固定为 UTC 03:00**，接受夏令时漂移：
  - 夏令时 PDT（UTC-7）：UTC 03:00 = 美西 **20:00**（命中目标）。
  - 冬令时 PST（UTC-8）：UTC 03:00 = 美西 **19:00**（早 1 小时，可接受）。
- **工作日判断放在函数内部按 Pacific 时间进行**，避免 UTC 与 PT 的星期错位。
  - 注意：UTC 03:00 对应的 Pacific 时间是**前一自然日的傍晚**。例如 UTC 周二 03:00 = PT 周一晚。函数取"当前 Pacific 日期"判断是否周一~周五，是则生成当天（PT）日报，否则跳过。

## 3. 数据模型

InsForge 托管的 Postgres。通过 `db migrations` 建表。外键引用用户用 `auth.users(id)`，RLS 策略用 `auth.uid()`。

```
subscriptions
  id            uuid pk default gen_random_uuid()
  user_id       uuid not null references auth.users(id) on delete cascade, unique
  status        text not null default 'active'   -- 'active' | 'cancelled'
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()

reports
  id            uuid pk default gen_random_uuid()
  report_date   date not null unique             -- 报告对应的 Pacific 自然日
  title         text not null                    -- 例 "美股收盘日报｜2026-06-08"
  content_md    text not null                    -- 模型生成的 Markdown 原文
  content_html  text                             -- 渲染后的 HTML（用于邮件正文）
  model         text not null                    -- 生成所用模型
  status        text not null default 'ready'    -- 'ready' | 'sent'
  created_at    timestamptz not null default now()

report_deliveries                                 -- 发送进度追踪，支撑 send 函数可重跑、不重发
  id            uuid pk default gen_random_uuid()
  report_id     uuid not null references reports(id) on delete cascade
  user_id       uuid not null references auth.users(id) on delete cascade
  email         text not null
  status        text not null                    -- 'sent' | 'failed'
  error         text
  created_at    timestamptz not null default now()
  unique(report_id, user_id)
```

索引：`subscriptions(status)`、`reports(report_date desc)`、`report_deliveries(report_id)`。

## 4. RLS 策略

- **subscriptions：** 用户只能 `select/insert/update/delete` 自己的行（`user_id = auth.uid()`）。
- **reports：** 仅"已登录且拥有 `active` 订阅"的用户可 `select`。
  - 策略形如 `USING (EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = auth.uid() AND s.status = 'active'))`。
  - 无写入策略（仅服务端函数以 admin 权限写入）。
- **report_deliveries：** 客户端无任何策略（默认拒绝）。仅服务端函数读写。

## 5. 系统 Prompt 存放

- 存为 InsForge **secret `REPORT_SYSTEM_PROMPT`**，默认值见附录 A（用户提供的完整 prompt）。
- `generate-daily-report` 函数读取该 secret（取不到时回退到内置默认值）。
- 用户可随时 `npx @insforge/cli secrets update REPORT_SYSTEM_PROMPT --value '...'` 修改，**无需重新部署函数**。

## 6. 后端函数与调度（方案 B：生成与发送拆分）

### 6.1 `generate-daily-report`（边缘函数）

- 触发：定时任务 cron `0 3 * * *`（每天 UTC 03:00）。
- 逻辑：
  1. 计算当前 Pacific 日期与星期。若不是周一~周五 → 直接返回（跳过，非交易日）。
  2. 幂等：若 `reports` 已存在该 `report_date` 的行 → 返回（跳过）。
  3. 读取 `REPORT_SYSTEM_PROMPT`，拼接 user message（指明"生成 {report_date} 的《美股收盘日报》"）。
  4. 调 InsForge AI（默认 `anthropic/claude-sonnet-4.5`）生成 Markdown。
  5. 渲染 HTML（服务端 Markdown→HTML）。
  6. 插入 `reports`（status=`ready`）。
- 以服务端 admin 权限运行，绕过 RLS 写入。

### 6.2 `send-daily-report`（边缘函数）

- 触发：定时任务 cron `*/30 3-9 * * *`（UTC 03:00–09:00，每 30 分钟一次）。多次触发用于在 SES 每小时限额下逐步排空。
- 逻辑（可重复执行、不重发）：
  1. 取当天（Pacific 日期）`reports` 行；不存在或已 `sent` 且全部投递完 → 返回。
  2. 查出 `subscriptions.status='active'` 且在 `report_deliveries` 中尚无 `status='sent'` 记录的用户及其邮箱（join `auth.users`）。
  3. 在本次速率上限内取一批（如 ≤40）逐个调用 `insforge.emails.send({ to, subject: title, html: content_html })`，每个写入 `report_deliveries`（成功 `sent` / 失败 `failed` + error）。
  4. 当该报告已无未投递的 active 订阅者 → 将 `reports.status` 置为 `sent`。
- **速率限制说明：** InsForge 自定义邮件按套餐 10–50 封/小时；每个收件地址计 1 封。窗口内多次触发可在限额下排空积压。

### 6.3 函数的数据库访问

- 边缘函数以服务端身份运行，使用项目 admin/service 权限访问数据库（读取订阅者邮箱、写入 reports/deliveries），绕过 RLS。具体 API 在实现阶段以 `insforge` SDK 的 functions 文档为准。

## 7. 前端（React + Vite）

页面 / 流程：

1. **注册 / 登录**（`insforge.auth`）
   - 当前项目开启了邮箱验证（`code` 方式）。注册后引导用户输入邮箱收到的验证码完成验证。
   - 也支持已有的 GitHub / Google OAuth（可选展示登录按钮）。
2. **订阅页（首页）**
   - 展示产品说明与当前订阅状态。
   - 「免费订阅」按钮 → 在 `subscriptions` upsert 一行 `status='active'`。
   - 「取消订阅」→ 将自己的行 `status='cancelled'`。
3. **日报归档页**
   - 列出历史日报（`report_date desc`，标题）。未订阅或未登录则提示先订阅。
   - 点击进入**日报详情页**，渲染 Markdown 全文。

部署：

- `npm run build` 本地验证通过后，用 `npx @insforge/cli deployments deploy .`。
- 配置 `VITE_INSFORGE_URL`、`VITE_INSFORGE_ANON_KEY` 持久环境变量。

## 8. 组件边界小结

| 单元 | 职责 | 依赖 |
|---|---|---|
| `subscriptions` 表 + RLS | 记录每用户订阅状态 | auth.users |
| `reports` 表 + RLS | 存放每日统一日报 | — |
| `report_deliveries` 表 | 投递幂等与审计 | reports, auth.users |
| `generate-daily-report` | 生成并落库当日日报 | AI 网关, REPORT_SYSTEM_PROMPT |
| `send-daily-report` | 限额内排空、追踪投递 | emails.send, 上述表 |
| 前端 auth 流 | 注册/验证/登录 | insforge.auth |
| 前端订阅流 | 订阅/取消 | subscriptions |
| 前端归档/详情 | 阅读历史日报 | reports |

## 9. 错误处理

- **生成失败**（AI 报错/超时）：函数记录日志并返回非 2xx；当天 `reports` 无行，下一次 cron 不会因幂等跳过（因为没有行），但本期 cron 每天只 03:00 一次——失败则当天无报告。可后续增加重试触发。
- **发送失败**（单个收件人）：写 `report_deliveries` 为 `failed` + error；下一个 30 分钟窗口的触发**不会重试 failed**（避免对坏地址反复发），仅处理尚无 `sent` 记录者——注意：failed 也算"有记录"，因此默认不重试 failed。若需重试可手动清理对应行。
- **速率限制**：`emails.send` 返回限额错误时，本批停止，等下个窗口触发继续。
- **幂等**：reports 的 `report_date unique` 与 deliveries 的 `unique(report_id,user_id)` 共同保证不重复生成、不重复发送。

## 10. 测试策略

- **手动端到端**：注册→验证→订阅→手动 `functions invoke generate-daily-report`→确认 `reports` 落库→`functions invoke send-daily-report`→确认收到邮件、`report_deliveries` 有记录→归档页可读。
- **RLS 验证**：未订阅用户读 `reports` 应为空；用户只能看到自己的 `subscriptions`。
- **幂等验证**：重复 invoke generate 不应产生第二行；重复 invoke send 不应重发已 `sent` 用户。
- **时区逻辑**：单元测试 Pacific 周末判断（构造 UTC 03:00 周一/周日等输入，断言 skip）。

## 11. 非本期范围（YAGNI）

- 真实行情数据 API 接入。
- 《美股周报》生成与周六调度。
- 付费订阅 / Stripe。
- 生成失败的自动重试编排、failed 投递的自动重试。
- 用户自定义日报偏好。

---

## 附录 A：`REPORT_SYSTEM_PROMPT` 默认值

> 完整 prompt 由用户提供，原文存入 secret。摘要：一名专业美股市场日报分析师角色，按固定 15 节结构（一句话总结、大盘总览、盘中复盘、宏观环境、板块表现、主题/风格、市场宽度、技术面、重点个股、财报日历、机构观点、板块轮动、重点关注股、明日交易计划、风险提示、最终结论）生成中文《美股收盘日报｜YYYY-MM-DD》。要求专业、数据驱动、注明来源、不编造数据、核对美西自然日、休市日输出简化版。

（实现时将用户提供的 prompt 原文完整写入 secret 默认值；此处不重复粘贴全文。）
