import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useAuth } from '../auth/AuthContext'

interface Subscription { id: string; status: string }

const FEATURES: Array<{ title: string; desc: string }> = [
  { title: '大盘与盘中复盘', desc: '三大指数收盘、SOX、VIX，开盘到尾盘的资金动向与涨跌主因' },
  { title: '宏观与利率', desc: '2/10/30Y 美债、降息预期（FedWatch）、美元黄金原油，逐项解读市场含义' },
  { title: '板块轮动与主题', desc: '11 大板块强弱、AI 硬件/软件/电力等主题轮动，资金在买什么卖什么' },
  { title: '七巨头与重点个股', desc: 'NVDA/MSFT/AAPL… 异动与原因，财报、评级、目标价调整一网打尽' },
  { title: '机构观点与资金流', desc: '华尔街大行策略、目标点位调整、ETF 资金流与期权异动' },
  { title: '明日计划与风险', desc: '关键支撑压力位、明日观察清单，以及当前最大的风险点提示' },
]

const STEPS: Array<{ n: string; title: string; desc: string }> = [
  { n: '1', title: '注册账号', desc: '邮箱注册，30 秒完成验证' },
  { n: '2', title: '一键免费订阅', desc: '点一下订阅，无需付费、无需绑卡' },
  { n: '3', title: '收报告', desc: '每个工作日美西收盘后自动送达邮箱' },
]

function CtaBlock() {
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

  if (loading || (user && !ready)) {
    return <div className="h-12 w-44 animate-pulse rounded-lg bg-white/10" />
  }

  if (!user) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Link to="/auth" className="rounded-lg bg-blue-500 px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400">
          免费订阅，30 秒搞定 →
        </Link>
        <span className="text-sm text-slate-400">永久免费 · 随时退订 · 一周最多 5 封</span>
      </div>
    )
  }

  if (sub?.status === 'active') {
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-green-500/15 px-4 py-2 font-medium text-green-300">✓ 已订阅（{user.email}）</span>
          <Link to="/reports" className="rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition hover:bg-blue-400">查看日报归档 →</Link>
        </div>
        <button disabled={busy} onClick={unsubscribe} className="text-sm text-slate-400 underline-offset-2 hover:underline disabled:opacity-50">取消订阅</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button disabled={busy} onClick={subscribe} className="rounded-lg bg-blue-500 px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:opacity-50">
        免费订阅，立即开始 →
      </button>
      <span className="text-sm text-slate-400">永久免费 · 随时退订 · 一周最多 5 封</span>
    </div>
  )
}

export function HomePage() {
  return (
    <div className="-mx-4 -my-4">
      {/* Hero */}
      <section className="bg-slate-900 px-6 py-14 text-white">
        <div className="mx-auto max-w-2xl">
          <span className="inline-block rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-300">
            AI 联网实时生成 · 关键数据标注来源
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            每个交易日收盘后，<br />一份看得懂的美股复盘，免费送到你邮箱
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            大盘、板块轮动、七巨头异动、宏观利率、机构观点、明日交易计划、风险提示——
            一份专业 15 节结构的《美股收盘日报》，每个工作日美西收盘后准时送达。
          </p>
          <div className="mt-8"><CtaBlock /></div>
        </div>
      </section>

      {/* What's inside */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-xl font-semibold text-slate-900">每份日报，都帮你回答这些问题</h2>
          <p className="mt-1 text-slate-500">市场为什么涨跌、资金在买什么卖什么、明天该关注什么。</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-xl border bg-white p-4">
                <h3 className="font-medium text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real sample preview */}
      <section className="bg-slate-100 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">真实样例 · 看看你会收到什么</h2>
            <span className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-500">节选</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-5 py-3 text-sm text-slate-500">
              📧 美股收盘日报｜2026-06-07
            </div>
            <div className="space-y-4 px-5 py-5 text-sm leading-relaxed text-slate-700">
              <div>
                <div className="font-semibold text-slate-900">0. 今日一句话总结</div>
                <p className="mt-1">
                  美股周五遭遇 2025 年 4 月以来最惨烈血洗，纳指暴跌 4.18%，费城半导体指数狂泻 10.03%，
                  单日蒸发超 1.3 万亿美元市值。导火索是超预期非农数据引发加息恐慌，叠加博通财报不及预期、
                  AI 硬件链全线崩盘，资金呈现典型 risk-off，VIX 飙升，市场宽度严重恶化。
                </p>
                <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-amber-800">
                  今日市场状态：指数暴跌、宽度崩溃，AI 硬件主线遭遇系统性抛售，流动性恐慌主导交易。
                </p>
              </div>
              <div>
                <div className="font-semibold text-slate-900">1. 大盘表现总览</div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400">
                      <tr><th className="py-1 pr-4">指数</th><th className="py-1 pr-4">收盘</th><th className="py-1 pr-4">涨跌幅</th><th className="py-1">技术状态</th></tr>
                    </thead>
                    <tbody className="text-slate-600">
                      <tr className="border-t"><td className="py-1 pr-4">道琼斯</td><td className="py-1 pr-4">49,910.59</td><td className="py-1 pr-4 text-red-600">-1.35%</td><td className="py-1">跌破 20 日线</td></tr>
                      <tr className="border-t"><td className="py-1 pr-4">标普 500</td><td className="py-1 pr-4">7,365.08</td><td className="py-1 pr-4 text-red-600">-2.64%</td><td className="py-1">大幅放量</td></tr>
                      <tr className="border-t"><td className="py-1 pr-4">纳斯达克</td><td className="py-1 pr-4">25,838.94</td><td className="py-1 pr-4 text-red-600">-4.18%</td><td className="py-1">重挫破位</td></tr>
                      <tr className="border-t"><td className="py-1 pr-4">SOX 半导体</td><td className="py-1 pr-4">—</td><td className="py-1 pr-4 text-red-600">-10.03%</td><td className="py-1">2020 年来最大跌幅</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                …完整日报含盘中复盘、宏观利率、板块轮动、重点个股、机构观点、明日交易计划、风险提示等 15 节，关键数据标注来源链接。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why subscribe */}
      <section className="px-6 py-12">
        <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-4">
            <div className="text-2xl">🔎</div>
            <h3 className="mt-2 font-medium text-slate-900">真实数据，标注来源</h3>
            <p className="mt-1 text-sm text-slate-500">AI 联网获取当日行情，关键数据附来源链接，不凭空编造。</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-2xl">🧭</div>
            <h3 className="mt-2 font-medium text-slate-900">专业 15 节结构</h3>
            <p className="mt-1 text-sm text-slate-500">从大盘到个股、从宏观到明日计划，按专业复盘框架成文。</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-2xl">🆓</div>
            <h3 className="mt-2 font-medium text-slate-900">永久免费，不打扰</h3>
            <p className="mt-1 text-sm text-slate-500">只在工作日收盘后一封，随时一键退订。</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-100 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-xl font-semibold text-slate-900">三步开始</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {STEPS.map(s => (
              <div key={s.n} className="rounded-xl border bg-white p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 font-semibold text-white">{s.n}</div>
                <h3 className="mt-3 font-medium text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-slate-900 px-6 py-14 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold">明天收盘后，就让这份日报替你做复盘</h2>
          <p className="mt-2 text-slate-300">免费订阅，每个工作日美西收盘后准时送达。</p>
          <div className="mt-6 flex justify-center"><CtaBlock /></div>
          <p className="mx-auto mt-8 max-w-xl text-xs text-slate-500">
            本服务内容由 AI 生成，仅供参考，不构成任何投资建议。市场有风险，决策需谨慎。
          </p>
        </div>
      </section>
    </div>
  )
}
