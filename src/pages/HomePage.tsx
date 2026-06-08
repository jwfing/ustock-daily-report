import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useAuth } from '../auth/AuthContext'
import { useLang } from '../i18n/LanguageContext'

interface Subscription { id: string; status: string }

function CtaBlock() {
  const { user, loading } = useAuth()
  const { t } = useLang()
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
          {t.home.subscribeFree}
        </Link>
        <span className="text-sm text-slate-400">{t.home.trustLine}</span>
      </div>
    )
  }

  if (sub?.status === 'active') {
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-green-500/15 px-4 py-2 font-medium text-green-300">{t.home.subscribed}（{user.email}）</span>
          <Link to="/reports" className="rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition hover:bg-blue-400">{t.home.viewArchive}</Link>
        </div>
        <button disabled={busy} onClick={unsubscribe} className="text-sm text-slate-400 underline-offset-2 hover:underline disabled:opacity-50">{t.home.unsubscribe}</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button disabled={busy} onClick={subscribe} className="rounded-lg bg-blue-500 px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:opacity-50">
        {t.home.subscribeStart}
      </button>
      <span className="text-sm text-slate-400">{t.home.trustLine}</span>
    </div>
  )
}

export function HomePage() {
  const { t } = useLang()
  const h = t.home
  return (
    <div className="-mx-4 -my-4">
      {/* Hero */}
      <section className="bg-slate-900 px-6 py-14 text-white">
        <div className="mx-auto max-w-2xl">
          <span className="inline-block rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-300">
            {h.badge}
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            {h.heroTitleL1}<br />{h.heroTitleL2}
          </h1>
          <p className="mt-4 text-lg text-slate-300">{h.heroSubtitle}</p>
          <div className="mt-8"><CtaBlock /></div>
        </div>
      </section>

      {/* What's inside */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-xl font-semibold text-slate-900">{h.featuresTitle}</h2>
          <p className="mt-1 text-slate-500">{h.featuresSub}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {h.features.map(f => (
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
            <h2 className="text-xl font-semibold text-slate-900">{h.sampleTitle}</h2>
            <span className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-500">{h.sampleBadge}</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-5 py-3 text-sm text-slate-500">{h.sampleSubject}</div>
            <div className="space-y-4 px-5 py-5 text-sm leading-relaxed text-slate-700">
              <div>
                <div className="font-semibold text-slate-900">{h.sampleSummaryTitle}</div>
                <p className="mt-1">{h.sampleSummary}</p>
                <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-amber-800">{h.sampleStatus}</p>
              </div>
              <div>
                <div className="font-semibold text-slate-900">{h.sampleOverviewTitle}</div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="py-1 pr-4">{h.thIndex}</th>
                        <th className="py-1 pr-4">{h.thClose}</th>
                        <th className="py-1 pr-4">{h.thChange}</th>
                        <th className="py-1">{h.thTech}</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-600">
                      {h.rows.map(r => (
                        <tr key={r.name} className="border-t">
                          <td className="py-1 pr-4">{r.name}</td>
                          <td className="py-1 pr-4">{r.close}</td>
                          <td className="py-1 pr-4 text-red-600">{r.change}</td>
                          <td className="py-1">{r.tech}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-slate-400">{h.sampleFooter}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why subscribe */}
      <section className="px-6 py-12">
        <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-3">
          {h.why.map(w => (
            <div key={w.title} className="rounded-xl border bg-white p-4">
              <div className="text-2xl">{w.icon}</div>
              <h3 className="mt-2 font-medium text-slate-900">{w.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-100 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-xl font-semibold text-slate-900">{h.stepsTitle}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {h.steps.map((s, i) => (
              <div key={s.title} className="rounded-xl border bg-white p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 font-semibold text-white">{i + 1}</div>
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
          <h2 className="text-2xl font-bold">{h.bottomTitle}</h2>
          <p className="mt-2 text-slate-300">{h.bottomSub}</p>
          <div className="mt-6 flex justify-center"><CtaBlock /></div>
          <p className="mx-auto mt-8 max-w-xl text-xs text-slate-500">{h.disclaimer}</p>
        </div>
      </section>
    </div>
  )
}
