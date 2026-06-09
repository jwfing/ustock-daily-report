# Product

## Register

brand

> Split surface, leaning brand. The marketing landing and the report-reading experience are the heart of the product, and editorial craft carries the trust. Treat **brand/editorial** as the default register; the app screens (auth, subscription management, archive list) are the exception, designed to serve their workflow without breaking the editorial voice.

## Users

People who follow the US stock market and want a credible end-of-day read without paying for a terminal or wading through clickbait. They range from active retail investors to professionals who want a fast, structured recap they can skim over coffee or on a phone. Their context is usually after the US close: they have a few minutes, they want the session's story (what moved, why, what's next) in their own language, EN or ZH. The job to be done: *"Tell me what happened in the market today and what to watch tomorrow, clearly and without hype, so I feel oriented in under five minutes."*

## Product Purpose

An open-source, AI-generated US stock market daily report, delivered free to subscribers' inboxes after every trading day, in English or Chinese. After the US close, an agent researches the session from authoritative financial sources and writes a structured 15-section recap (indices, sector rotation, the Magnificent 7, macro & rates, institutional views, a next-day game plan, risk alerts), then emails it in each subscriber's preferred language. The site offers a landing page, one-tap free subscription, a language toggle, an archive of past reports, and public share pages for individual reports.

Success looks like: a reader trusts the recap enough to make it part of their daily routine, the bilingual versions stay numerically identical, and the free/open-source model keeps the barrier to entry at zero. The reports are explicitly informational, not investment advice.

## Brand Personality

**Sharp & insightful.** The voice is that of a savvy analyst who gets to the point: smart, fast, opinionated where it earns it, never padded. Three words: *sharp, credible, unhurried.* It should read like a respected publication that has a point of view, not a data dump and not a hype feed. Editorial confidence over decoration. Specific nouns and real numbers over adjectives. The design's job is to make that voice feel authoritative and easy to read, on any device, in either language.

## Anti-references

- **Generic SaaS template.** No Inter-on-white landing pages, no endless icon-card grids, no marketing buzzwords (streamline, supercharge, seamless, world-class). If it could be any B2B startup, it has failed; the editorial typographic identity is the differentiator.
- **Hype crypto/fintech.** No neon gradients, glowing cards, gradient text, "to the moon" energy, or dark-mode-trading-app flash. Gains and losses are reported plainly, not dramatized.
- **Bloomberg-terminal density.** No cramped data walls, no intimidating tiny-mono dashboards built only for pros. Tables and figures stay legible and calm; this is a read, not a cockpit.
- Also avoid clickbait-finance-media tropes: sensational red-arrow headlines, fear/greed engagement bait, ad clutter.

## Design Principles

- **Editorial first.** Treat every report and page like a piece of published writing: typographic hierarchy, generous reading measure, restraint. The layout serves reading, not engagement metrics.
- **Earn trust through clarity.** Cited sources, real numbers, plain language. Never dress up uncertainty; let credibility come from precision, not polish-for-polish's-sake.
- **Calm over loud.** Gains and losses, alerts and headlines are stated, not shouted. The product is the antidote to hype, so the interface must feel measured even when the market isn't.
- **Bilingual parity.** EN and ZH are first-class equals. Layout, hierarchy, and typography must hold up in both languages; nothing should look like a translation afterthought.
- **Frictionless entry.** Free, one-tap subscribe, no paywall theater. The app screens get out of the way so the reading and the routine are the point.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. Body text holds ≥4.5:1 contrast (watch muted `stone` text on `parchment`); large text ≥3:1. Full keyboard navigation and visible focus states. Every animation has a `prefers-reduced-motion` alternative. Semantic markup and properly structured data tables in the reports. Given the finance domain, do not rely on red/green alone to signal gain/loss; pair color with sign/arrow/text so the cue survives color-blindness.
