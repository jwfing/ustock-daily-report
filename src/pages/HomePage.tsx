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
    <div className={`inline-flex overflow-hidden rounded-full border text-sm ${dark ? 'border-ivory/35' : 'border-ink/30'}`}>
      {(['zh', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={busy}
          onClick={() => onChange(l)}
          aria-pressed={value === l}
          className={`px-3.5 py-1.5 transition ${
            value === l
              ? dark ? 'bg-ivory text-ink' : 'bg-ink text-ivory'
              : dark ? 'text-ivory hover:bg-ivory/10' : 'text-ink hover:bg-ink-tint'
          }`}
        >
          {l === 'zh' ? t.home.langZh : t.home.langEn}
        </button>
      ))}
    </div>
  )

  const pill = dark
    ? 'rounded-full border-[1.5px] border-ivory bg-ivory px-6 py-3 font-medium text-ink transition hover:bg-transparent hover:text-ivory'
    : 'rounded-full border-[1.5px] border-ink bg-ink px-6 py-3 font-medium text-ivory transition hover:bg-ink-light hover:border-ink-light'
  const trust = dark ? 'text-sm text-ivory/75' : 'text-sm text-stone'
  const center = dark ? 'items-center' : 'items-start'

  if (loading || (user && !ready)) {
    return <div className={`h-12 w-44 animate-pulse rounded-full ${dark ? 'bg-ivory/20' : 'bg-sand'}`} />
  }

  if (!user) {
    return (
      <div className={`flex flex-col gap-2.5 ${center}`}>
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
    <div className={`flex flex-col gap-2.5 ${center}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} onClick={subscribe} className={`${pill} disabled:opacity-50`}>{t.home.subscribeStart}</button>
        <LangPicker value={pickLang} onChange={setPickLang} />
      </div>
      <span className={trust}>{t.home.trustLine}</span>
    </div>
  )
}

export function HomePage() {
  const { t } = useLang()
  const h = t.home
  return (
    <div className="-mx-4 -my-4 font-serif text-near">
      {/* Lead */}
      <section className="border-b border-sand bg-parchment px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <p className="reveal flex items-center gap-3 text-[13px] italic text-stone">
            <span aria-hidden className="inline-block h-px w-8 bg-ink/40" />
            {h.folio}
          </p>
          <h1 className="reveal reveal-2 mt-5 text-balance text-[2rem] font-medium leading-[1.08] tracking-[-0.02em] text-near sm:text-[3.25rem]">
            {h.heroTitleL1} {h.heroTitleL2}
          </h1>
          <p className="reveal reveal-3 mt-5 max-w-prose text-pretty text-lg leading-relaxed text-near/80 sm:text-xl">
            {h.heroSubtitle}
          </p>
          <div className="reveal reveal-4 mt-8"><CtaBlock /></div>
        </div>
      </section>

      {/* Today's edition — the proof */}
      <section className="border-b border-sand bg-ivory px-6 py-14">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-medium text-near">{h.sampleTitle}</h2>
            <span className="shrink-0 text-[13px] italic text-stone">{h.sampleBadge}</span>
          </div>

          <figure className="mt-6 border border-line bg-parchment">
            <figcaption className="border-b border-line px-5 py-3 text-[13px] tabular-nums text-stone">
              {h.sampleSubject}
            </figcaption>
            <div className="space-y-6 px-5 py-6 sm:px-7">
              <div>
                <h3 className="text-base font-medium text-near">{h.sampleSummaryTitle}</h3>
                <p className="mt-2 leading-relaxed text-near/85">{h.sampleSummary}</p>
                <p className="mt-4 border border-ink/15 bg-ink-tint px-4 py-3 text-[15px] leading-relaxed text-ink">
                  {h.sampleStatus}
                </p>
              </div>

              <div>
                <h3 className="text-base font-medium text-near">{h.sampleOverviewTitle}</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-[13px] text-stone">
                        <th scope="col" className="py-2 pr-4 font-medium">{h.thIndex}</th>
                        <th scope="col" className="py-2 pr-4 font-medium">{h.thClose}</th>
                        <th scope="col" className="py-2 pr-4 font-medium">{h.thChange}</th>
                        <th scope="col" className="py-2 font-medium">{h.thTech}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {h.rows.map(r => (
                        <tr key={r.name} className="border-b border-line/70 last:border-0">
                          <th scope="row" className="py-2 pr-4 font-normal text-near">{r.name}</th>
                          <td className="py-2 pr-4 tabular-nums text-near/85">{r.close}</td>
                          <td className="py-2 pr-4 font-medium tabular-nums text-[#a3392f]">{r.change}</td>
                          <td className="py-2 text-near/75">{r.tech}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-[13px] leading-relaxed text-stone">{h.sampleFooter}</p>
            </div>
          </figure>
        </div>
      </section>

      {/* Inside every issue — the real table of contents */}
      <section className="border-b border-sand bg-parchment px-6 py-14">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-balance text-2xl font-medium text-near">{h.contentsTitle}</h2>
          <p className="mt-2 max-w-prose text-pretty leading-relaxed text-near/75">{h.contentsSub}</p>
          <ol className="mt-7 grid gap-x-10 sm:grid-cols-2">
            {h.contents.map((c, i) => (
              <li key={c} className="flex items-baseline gap-3 border-b border-line/70 py-2.5">
                <span className="w-6 shrink-0 text-[13px] tabular-nums text-ink/70">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-near/90">{c}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why you can trust it + sources */}
      <section className="border-b border-sand bg-ivory px-6 py-14">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-medium text-near">{h.whyTitle}</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {h.why.map(w => (
              <div key={w.title} className="py-4">
                <h3 className="font-medium text-near">{w.title}</h3>
                <p className="mt-1.5 max-w-prose leading-relaxed text-near/75">{w.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-7">
            <p className="text-[13px] italic text-stone">{h.sourcesLabel}</p>
            <ul className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-near/70">
              {h.sources.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden className="text-stone/45">·</span>}
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Committed close */}
      <section className="bg-ink px-6 py-16 text-ivory [&_:focus-visible]:outline-[#faf9f5]">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-2xl font-medium sm:text-3xl">{h.bottomTitle}</h2>
          <p className="mt-3 text-ivory/80">{h.bottomSub}</p>
          <div className="mt-7 flex justify-center"><CtaBlock dark /></div>
          <p className="mx-auto mt-9 max-w-xl text-xs leading-relaxed text-ivory/60">{h.disclaimer}</p>
        </div>
      </section>
    </div>
  )
}
