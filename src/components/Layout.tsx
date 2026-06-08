import { Link, Outlet, useNavigate } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useAuth } from '../auth/AuthContext'
import { useLang } from '../i18n/LanguageContext'

function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
      className="rounded border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <Link to="/" className="font-semibold">{t.nav.brand}</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/reports" className="hover:underline">{t.nav.archive}</Link>
            {loading ? null : user ? (
              <button onClick={signOut} className="text-slate-500 hover:underline">{t.nav.logout}</button>
            ) : (
              <Link to="/auth" className="text-blue-600 hover:underline">{t.nav.login}</Link>
            )}
            <LangToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4"><Outlet /></main>
    </div>
  )
}
