import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface AuthState {
  userId: number | null
  role: string | null
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (pin: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ userId: null, role: null, isAuthenticated: false })

  const login = useCallback(async (pin: string) => {
    const result = await window.api['auth:login'](pin)
    if (result) {
      setAuth({ userId: result.userId, role: result.role, isAuthenticated: true })
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    setAuth({ userId: null, role: null, isAuthenticated: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}