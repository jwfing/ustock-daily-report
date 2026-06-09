import { Link, Outlet, useNavigate } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useAuth } from '../auth/AuthContext'
import { useLang } from '../i18n/LanguageContext'
import { Logo } from './Logo'

function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
      className="rounded-full border border-line px-3 py-1 text-xs text-stone transition hover:border-ink hover:text-ink"
      aria-label="Toggle language"
    >
      {lang === 'en' ? '中文' : 'EN'}
    </button>
  )
}

export function Layout() {
  const { user, loading, refresh } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  async function signOut() {
    await insforge.auth.signOut()
    await refresh()
    navigate('/')
  }
  return (
    <div className="min-h-screen bg-parchment font-serif text-near">
      <header className="sticky top-0 z-40 border-b border-sand bg-ivory">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-medium tracking-tight text-near">
            <Logo className="h-7 w-7" />
            {t.nav.brand}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/reports" className="text-stone transition hover:text-ink">{t.nav.archive}</Link>
            {loading ? null : user ? (
              <button onClick={signOut} className="text-stone transition hover:text-ink">{t.nav.logout}</button>
            ) : (
              <Link to="/auth" className="text-ink transition hover:text-ink-light">{t.nav.login}</Link>
            )}
            <LangToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4"><Outlet /></main>
    </div>
  )
}
