import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useAuth } from '../auth/AuthContext'

interface Subscription { id: string; status: string }

export function HomePage() {
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

  const active = sub?.status === 'active'

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">美股收盘日报 · 免费订阅</h1>
        <p className="mt-2 text-slate-600">
          订阅后，每个工作日美西时间晚上由平台统一生成《美股收盘日报》并发送到你的邮箱，也可在归档页随时回看。
        </p>
      </section>

      {loading || !ready ? (
        <p className="text-slate-500">加载中…</p>
      ) : !user ? (
        <Link to="/auth" className="inline-block rounded bg-blue-600 px-4 py-2 text-white">登录后订阅</Link>
      ) : active ? (
        <div className="space-y-3">
          <p className="text-green-700">✓ 你已订阅（{user.email}）</p>
          <div className="flex items-center gap-3">
            <button disabled={busy} onClick={unsubscribe} className="rounded border px-4 py-2 disabled:opacity-50">取消订阅</button>
            <Link to="/reports" className="text-blue-600 hover:underline">查看日报归档 →</Link>
          </div>
        </div>
      ) : (
        <button disabled={busy} onClick={subscribe} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">免费订阅</button>
      )}
    </div>
  )
}
