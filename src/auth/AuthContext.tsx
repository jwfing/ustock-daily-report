import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { insforge } from '../lib/insforge'

interface User { id: string; email: string }
interface AuthState { user: User | null; loading: boolean; refresh: () => Promise<void> }

const AuthContext = createContext<AuthState>({ user: null, loading: true, refresh: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const { data, error } = await insforge.auth.getCurrentUser()
    setUser(error ? null : ((data?.user as User) ?? null))
    setLoading(false)
  }

  useEffect(() => { void refresh() }, [])

  return <AuthContext.Provider value={{ user, loading, refresh }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { return useContext(AuthContext) }
