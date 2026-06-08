import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="text-slate-500">加载中…</p>
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}
