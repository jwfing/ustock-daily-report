import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLang } from '../i18n/LanguageContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { t } = useLang()
  if (loading) return <p className="text-slate-500">{t.common.loading}</p>
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}
