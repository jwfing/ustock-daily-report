import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useAuth } from '../auth/AuthContext'

type Mode = 'signin' | 'signup' | 'verify'

export function AuthPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function done() { await refresh(); navigate('/') }

  async function onSignIn(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { error } = await insforge.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      if (error.statusCode === 403) { setMsg('邮箱未验证，请先完成验证'); setMode('verify') }
      else setMsg(`登录失败：${error.message}`)
      return
    }
    await done()
  }

  async function onSignUp(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { data, error } = await insforge.auth.signUp({ email, password, name })
    setBusy(false)
    if (error) { setMsg(`注册失败：${error.message}`); return }
    if (data?.requireEmailVerification) { setMode('verify'); setMsg('验证码已发送到邮箱，请输入。'); return }
    await done()
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { error } = await insforge.auth.verifyEmail({ email, otp })
    setBusy(false)
    if (error) { setMsg('验证码无效或已过期'); return }
    await done() // verifyEmail succeeds and signs the user in
  }

  async function oauth(provider: 'google' | 'github') {
    await insforge.auth.signInWithOAuth(provider, { redirectTo: window.location.origin + '/' })
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">
        {mode === 'signup' ? '注册' : mode === 'verify' ? '验证邮箱' : '登录'}
      </h1>

      {mode === 'verify' ? (
        <form onSubmit={onVerify} className="space-y-3">
          <input className="w-full rounded border p-2" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="w-full rounded border p-2" placeholder="6 位验证码" value={otp} onChange={e => setOtp(e.target.value)} />
          <button disabled={busy} className="w-full rounded bg-blue-600 p-2 text-white disabled:opacity-50">确认</button>
          <button type="button" className="text-sm text-slate-500" onClick={() => insforge.auth.resendVerificationEmail({ email })}>重发验证码</button>
        </form>
      ) : (
        <form onSubmit={mode === 'signup' ? onSignUp : onSignIn} className="space-y-3">
          {mode === 'signup' && (
            <input className="w-full rounded border p-2" placeholder="昵称" value={name} onChange={e => setName(e.target.value)} />
          )}
          <input className="w-full rounded border p-2" placeholder="邮箱" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="w-full rounded border p-2" placeholder="密码（≥6 位）" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button disabled={busy} className="w-full rounded bg-blue-600 p-2 text-white disabled:opacity-50">{mode === 'signup' ? '注册' : '登录'}</button>
        </form>
      )}

      {msg && <p className="mt-3 text-sm text-amber-700">{msg}</p>}

      <div className="mt-4 flex gap-3">
        <button onClick={() => oauth('google')} className="flex-1 rounded border p-2 text-sm hover:bg-slate-50">Google 登录</button>
        <button onClick={() => oauth('github')} className="flex-1 rounded border p-2 text-sm hover:bg-slate-50">GitHub 登录</button>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {mode === 'signup' ? '已有账号？' : '没有账号？'}{' '}
        <button className="text-blue-600" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setMsg(null) }}>
          {mode === 'signup' ? '去登录' : '去注册'}
        </button>
      </p>
    </div>
  )
}
