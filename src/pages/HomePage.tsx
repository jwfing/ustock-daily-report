import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useAuth } from '../auth/AuthContext'
import { useLang } from '../i18n/LanguageContext'

interface Subscription { id: string; status: string; lang: 'zh' | 'en' }

function CtaBlock({ dark = false }: { dark?: boolean }) {
  const { user, loading } = useAuth()
  const { t, lang } = useLang()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [busy, setBusy] = useState(false)
  const [pickLang, setPickLang] = useState<'zh' | 'en'>(lang)
  const [ready, setReady] = useState(false)

  async function load() {
    if (!user) { setReady(true); return }
    const { data } = await insforge.database
      .from('subscriptions').select('id, status, lang').eq('user_id', user.id).limit(1)
    setSub((data?.[0] as Subscription) ?? null)
    setReady(true)
  }
  useEffect(() => { if (!loading) void load() }, [loading, user?.id])

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

  async function changeLang(next: 'zh' | 'en') {
    if (!sub) return
    setBusy(true)
    await insforge.database.from('subscriptions')
      .update({ lang: next, updated_at: new Date().toISOString() }).eq('id', sub.id)
    await load(); setBusy(false)
  }

  async function unsubscribe() {
    if (!sub) return
    setBusy(true)
    await insforge.database.from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', sub.id)
    await load(); setBusy(false)
  }

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

  const pill = dark
    ? 'rounded-full border-[1.5px] border-ivory bg-ivory px-6 py-3 font-medium text-ink transition hover:bg-transparent hover:text-ivory'
    : 'rounded-full border-[1.5px] border-ink bg-ink px-6 py-3 font-medium text-ivory transition hover:bg-ink-light hover:border-ink-light'
  const trust = dark ? 'text-sm text-ivory/70' : 'text-sm text-stone'
  const center = dark ? 'items-center' : 'items-start'

  if (loading || (user && !ready)) {
    return <div className={`h-12 w-44 animate-pulse rounded-full ${dark ? 'bg-ivory/20' : 'bg-sand'}`} />
  }

  if (!user) {
    return (
      <div className={`flex flex-col gap-2 ${center}`}>
        <Link to="/auth" className={pill}>{t.home.subscribeFree}</Link>
        <span className={trust}>{t.home.trustLine}</span>
      </div>
    )
  }

  if (sub?.status === 'active') {
    return (
      <div className={`flex flex-col gap-3 ${center}`}>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className={`rounded-full border px-4 py-2 font-medium ${dark ? 'border-ivory/30 text-ivory' : 'border-ink/20 text-ink'}`}>
            {t.home.subscribed}（{user.email}）
          </span>
          <Link to="/reports" className={pill}>{t.home.viewArchive}</Link>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={trust}>{t.home.emailLang}</span>
          <LangPicker value={sub.lang} onChange={changeLang} />
        </div>
        <button disabled={busy} onClick={unsubscribe} className={`${trust} underline-offset-4 hover:underline disabled:opacity-50`}>
          {t.home.unsubscribe}
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${center}`}>
      <div className="flex items-center gap-3">
        <button disabled={busy} onClick={subscribe} className={`${pill} disabled:opacity-50`}>{t.home.subscribeStart}</button>
        <LangPicker value={pickLang} onChange={setPickLang} />
      </div>
      <span className={trust}>{t.home.trustLine}</span>
    </div>
  )
}

const eyebrow = 'text-xs font-medium uppercase tracking-[0.18em] text-ink'

export function HomePage() {
  const { t } = useLang()
  const h = t.home
  return (
    <div className="-mx-4 -my-4 font-serif">
      {/* Hero */}
      <section className="border-b border-sand bg-parchment px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <span className={eyebrow}>{h.badge}</span>
          <h1 className="mt-5 text-4xl font-medium leading-[1.1] text-near sm:text-5xl">
            {h.heroTitleL1}<br />{h.heroTitleL2}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-stone">{h.heroSubtitle}</p>
          <div className="mt-9"><CtaBlock /></div>
        </div>
      </section>

      {/* What's inside */}
      <section className="bg-parchment px-6 py-14">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-medium text-near">{h.featuresTitle}</h2>
          <p className="mt-2 text-stone">{h.featuresSub}</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {h.features.map(f => (
              <div key={f.title} className="rounded-lg border border-line bg-ivory p-5">
                <h3 className="font-medium text-near">{f.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-stone">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real sample preview */}
      <section className="border-y border-sand bg-sand/40 px-6 py-14">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-medium text-near">{h.sampleTitle}</h2>
            <span className="text-xs uppercase tracking-[0.15em] text-stone">{h.sampleBadge}</span>
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-line bg-ivory">
            <div className="border-b border-line bg-parchment px-5 py-3 text-sm text-stone">{h.sampleSubject}</div>
            <div className="space-y-5 px-5 py-6 text-[15px] leading-relaxed text-near/90">
              <div>
                <div className="font-medium text-near">{h.sampleSummaryTitle}</div>
                <p className="mt-1.5 text-stone">{h.sampleSummary}</p>
                <p className="mt-3 border-l-2 border-ink/40 bg-ink-tint px-4 py-2 text-ink">{h.sampleStatus}</p>
              </div>
              <div>
                <div className="font-medium text-near">{h.sampleOverviewTitle}</div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="text-stone">
                      <tr className="border-b border-line">
                        <th className="py-1.5 pr-4 font-medium">{h.thIndex}</th>
                        <th className="py-1.5 pr-4 font-medium">{h.thClose}</th>
                        <th className="py-1.5 pr-4 font-medium">{h.thChange}</th>
                        <th className="py-1.5 font-medium">{h.thTech}</th>
                      </tr>
                    </thead>
                    <tbody className="text-near/80">
                      {h.rows.map(r => (
                        <tr key={r.name} className="border-b border-line/60">
                          <td className="py-1.5 pr-4">{r.name}</td>
                          <td className="py-1.5 pr-4 tabular-nums">{r.close}</td>
                          <td className="py-1.5 pr-4 tabular-nums text-[#a3392f]">{r.change}</td>
                          <td className="py-1.5">{r.tech}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[13px] text-stone">{h.sampleFooter}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why subscribe */}
      <section className="bg-parchment px-6 py-14">
        <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-3">
          {h.why.map(w => (
            <div key={w.title} className="rounded-lg border border-line bg-ivory p-5">
              <div className="text-2xl">{w.icon}</div>
              <h3 className="mt-2.5 font-medium text-near">{w.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-stone">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      {/* <section className="border-y border-sand bg-ivory px-6 py-14">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-medium text-near">{h.stepsTitle}</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {h.steps.map((s, i) => (
              <div key={s.title} className="rounded-lg border border-line bg-parchment p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-ink font-medium text-ink">{i + 1}</div>
                <h3 className="mt-3 font-medium text-near">{s.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-stone">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* Bottom CTA */}
      <section className="bg-ink px-6 py-16 text-ivory">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-medium sm:text-3xl">{h.bottomTitle}</h2>
          <p className="mt-3 text-ivory/80">{h.bottomSub}</p>
          <div className="mt-7 flex justify-center"><CtaBlock dark /></div>
          <p className="mx-auto mt-9 max-w-xl text-xs text-ivory/55">{h.disclaimer}</p>
        </div>
      </section>
    </div>
  )
}
