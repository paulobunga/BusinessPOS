import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { Role } from '../../shared/types'
import { canSeeRole, hasPermission, permissionsFor, type Module, type Permission } from '../lib/permissions'

interface AuthState {
  userId: number | null
  name: string | null
  role: Role | null
  permissions: Permission[]
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (pin: string) => Promise<boolean>
  logout: () => void
  hasAccess: (permission: Permission) => boolean
  canSee: (module: Module) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ userId: null, name: null, role: null, permissions: [], isAuthenticated: false })

  const login = useCallback(async (pin: string) => {
    const result = await window.api['auth:login'](pin)
    if (result) {
      setAuth({ userId: result.userId, name: result.name, role: result.role, permissions: permissionsFor(result.role), isAuthenticated: true })
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    setAuth({ userId: null, name: null, role: null, permissions: [], isAuthenticated: false })
  }, [])

  const hasAccess = useCallback(
    (permission: Permission) => auth.role != null && hasPermission(auth.role, permission),
    [auth.role]
  )
  const canSee = useCallback(
    (module: Module) => auth.role != null && canSeeRole(auth.role, module),
    [auth.role]
  )

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, hasAccess, canSee }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}