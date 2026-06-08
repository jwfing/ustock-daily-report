# US Stock Daily · 美股日报

An open-source, AI-generated **US stock market daily report**, delivered free to your inbox after every trading day — in **English or Chinese**.

After the US close, an AI agent researches the session from authoritative financial sources, writes a structured 15-section recap (indices, sector rotation, the Magnificent 7, macro & rates, institutional views, tomorrow's game plan, risk alerts), and emails it to subscribers in their preferred language. Key figures cite their sources.

> ⚠️ **Disclaimer:** Content is AI-generated and for informational purposes only. It is **not investment advice**. Markets carry risk; do your own research.

This project is open source, and **contributions are very welcome** — see [Contributing](#contributing) below.

## Features

- 📈 **Professional 15-section recap** — index overview & intraday flow, macro & rates (Treasuries, FedWatch, dollar/gold/oil), sector rotation, key single names, institutional views & flows, a next-day game plan, and risk alerts.
- 🌐 **Bilingual (EN / ZH)** — the report is generated in Chinese and translated to English so both versions carry identical numbers and tables. Subscribers choose their email language; the site UI also toggles language.
- 🔎 **Real data with cited sources** — generation uses live web search steered toward English-language authoritative outlets (CNBC, Reuters, Bloomberg, Yahoo Finance, Nasdaq, CME, FRED, …); key data points link to their source.
- 📬 **Automatic daily delivery** — a scheduled job generates the report after the US close and emails it to active subscribers, batched and de-duplicated.
- 🔗 **Shareable reports** — each report has a public share page; an archive lists past reports for subscribers.
- 🎨 **Clean editorial design** — warm parchment, ink-blue accent, serif-led typography.

## How it works

```
                 cron (after US close)
                          │
                          ▼
   ┌──────────────────────────────────────┐
   │  Generator (Node, on a Fly container) │   compute/generate/
   │  1. Claude + native web search → ZH   │
   │  2. Translate ZH → EN (no re-search)  │
   │  3. Store both rows in `reports`      │
   └──────────────────────────────────────┘
                          │
                          ▼  cron (delivery window)
   ┌──────────────────────────────────────┐
   │  Sender (Deno edge function)          │   functions/send-daily-report.ts
   │  → each subscriber gets the report    │
   │    row matching their language        │
   └──────────────────────────────────────┘
                          │
                          ▼
   ┌──────────────────────────────────────┐
   │  Web app (React + Vite)               │   src/
   │  landing · subscribe · archive ·      │
   │  report detail · public share page    │
   └──────────────────────────────────────┘
```

- **Generation** runs in a long-lived compute container (not an edge function) because the full web-search generation exceeds the edge gateway's timeout.
- The report data model keys each row by `(report_date, lang)`, so every day has a `zh` and an `en` row; subscribers carry a `lang` preference used at send time.

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router.
- **Backend:** [InsForge](https://insforge.dev) — Postgres (with Row-Level Security), Deno edge functions, an AI model gateway, transactional email, and scheduled jobs.
- **Generation:** OpenRouter via the InsForge AI gateway, using Claude Sonnet 4.5 with native web search; report is rendered from Markdown with `marked`.
- **Hosting:** static frontend deploy + a containerized generator on Fly.io.

## Project structure

```
src/                       React app (landing, auth, archive, report detail, public share)
functions/                 Deno edge functions
  send-daily-report.ts     language-aware daily email delivery
  public-report.ts         public, unauthenticated read of a single report (share links)
  _shared/                 pure, unit-tested helpers (report-date, send-planning)
compute/generate/          containerized generator (server.mjs) + the report system prompt
migrations/                SQL migrations (reports, subscriptions, deliveries, RLS)
docs/                      design specs and implementation plans
```

## Getting started (local development)

Prerequisites: Node.js 20+, and an [InsForge](https://insforge.dev) project if you want the backend to work end-to-end.

```bash
# 1. Install dependencies
npm install

# 2. Configure the frontend's backend connection
cp .env.example .env
#   then set VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY

# 3. Run the dev server
npm run dev

# Other scripts
npm run build     # type-check + production build
npm run test      # run the unit tests (vitest)
npm run lint      # eslint
```

The backend (schema, edge functions, the generator container, and the cron schedules) is managed with the InsForge CLI. See `migrations/`, `functions/`, and `compute/` for the pieces, and the [InsForge docs](https://insforge.dev) for provisioning.

## Contributing

Contributions of all kinds are welcome — bug reports, feature ideas, docs, design, and code.

1. **Open an issue** first for anything non-trivial, so we can align on the approach.
2. **Fork & branch** from `main` (e.g. `feat/...` or `fix/...`).
3. **Keep changes focused** and match the existing code style. Run `npm run build`, `npm run test`, and `npm run lint` before opening a PR.
4. **Open a pull request** describing what changed and why. Link the related issue.

Good first areas to help with:

- Additional language versions, or improving the EN/ZH report quality.
- More resilient generation (e.g. retries/backoff around the AI call).
- Frontend polish, accessibility, and tests.
- Documentation and onboarding for self-hosting the backend.

If you're unsure where to start, open an issue and say hi.

## License

Released under the [MIT License](LICENSE).
