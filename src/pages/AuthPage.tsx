import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { insforge } from '../lib/insforge'
import { useAuth } from '../auth/AuthContext'
import { useLang } from '../i18n/LanguageContext'

type Mode = 'signin' | 'signup' | 'verify'

export function AuthPage() {
  const { refresh } = useAuth()
  const { t } = useLang()
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
      if (error.statusCode === 403) { setMsg(t.auth.msgEmailNotVerified); setMode('verify') }
      else setMsg(t.auth.msgSignInFail(error.message))
      return
    }
    await done()
  }

  async function onSignUp(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { data, error } = await insforge.auth.signUp({ email, password, name })
    setBusy(false)
    if (error) { setMsg(t.auth.msgSignUpFail(error.message)); return }
    if (data?.requireEmailVerification) { setMode('verify'); setMsg(t.auth.msgCodeSent); return }
    await done()
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { error } = await insforge.auth.verifyEmail({ email, otp })
    setBusy(false)
    if (error) { setMsg(t.auth.msgVerifyFail); return }
    await done() // verifyEmail succeeds and signs the user in
  }

  async function oauth(provider: 'google' | 'github') {
    await insforge.auth.signInWithOAuth(provider, { redirectTo: window.location.origin + '/' })
  }

  const title = mode === 'signup' ? t.auth.titleSignUp : mode === 'verify' ? t.auth.titleVerify : t.auth.titleSignIn

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">{title}</h1>

      {mode === 'verify' ? (
        <form onSubmit={onVerify} className="space-y-3">
          <input className="w-full rounded border p-2" placeholder={t.auth.email} value={email} onChange={e => setEmail(e.target.value)} />
          <input className="w-full rounded border p-2" placeholder={t.auth.otp} value={otp} onChange={e => setOtp(e.target.value)} />
          <button disabled={busy} className="w-full rounded bg-blue-600 p-2 text-white disabled:opacity-50">{t.auth.confirm}</button>
          <button type="button" className="text-sm text-slate-500" onClick={() => insforge.auth.resendVerificationEmail({ email })}>{t.auth.resend}</button>
        </form>
      ) : (
        <form onSubmit={mode === 'signup' ? onSignUp : onSignIn} className="space-y-3">
          {mode === 'signup' && (
            <input className="w-full rounded border p-2" placeholder={t.auth.name} value={name} onChange={e => setName(e.target.value)} />
          )}
          <input className="w-full rounded border p-2" placeholder={t.auth.email} type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="w-full rounded border p-2" placeholder={t.auth.password} type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button disabled={busy} className="w-full rounded bg-blue-600 p-2 text-white disabled:opacity-50">{mode === 'signup' ? t.auth.signUp : t.auth.signIn}</button>
        </form>
      )}

      {msg && <p className="mt-3 text-sm text-amber-700">{msg}</p>}

      <div className="mt-4 flex gap-3">
        <button onClick={() => oauth('google')} className="flex-1 rounded border p-2 text-sm hover:bg-slate-50">{t.auth.google}</button>
        <button onClick={() => oauth('github')} className="flex-1 rounded border p-2 text-sm hover:bg-slate-50">{t.auth.github}</button>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {mode === 'signup' ? t.auth.haveAccount : t.auth.noAccount}{' '}
        <button className="text-blue-600" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setMsg(null) }}>
          {mode === 'signup' ? t.auth.goSignIn : t.auth.goSignUp}
        </button>
      </p>
    </div>
  )
}
