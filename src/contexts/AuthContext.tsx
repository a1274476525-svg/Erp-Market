import { createContext, useContext, useState, type ReactNode } from 'react'
import type { User } from '../types'

interface AuthCtx {
  user: User | null
  login:     (userId: number, pin: string) => Promise<boolean>
  logout:    () => void
  canAccess: (path: string) => boolean
}

const Ctx = createContext<AuthCtx>({
  user: null,
  login: async () => false,
  logout: () => {},
  canAccess: () => true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  // Do not trust a renderer-stored user object as an authenticated session.
  const [user, setUser] = useState<User | null>(null)

  async function login(userId: number, pin: string) {
    const result = await window.api.auth.login(userId, pin)
    if (result) {
      setUser(result)
    }
    return !!result
  }

  function logout() {
    void window.api.auth.logout().catch(() => {})
    setUser(null)
  }

  function canAccess(path: string) {
    if (!user) return false
    if (path === '/') return true
    const rd = user.roleData
    if (!rd) return false
    if (rd.fullAccess) return true
    return rd.permissions.some(p => path === p || path.startsWith(p + '/'))
  }

  return <Ctx.Provider value={{ user, login, logout, canAccess }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
