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
          <Link to="/" className="font-semibold">📈 美股日报</Link>
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
