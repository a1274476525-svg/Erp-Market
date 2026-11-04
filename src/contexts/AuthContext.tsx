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
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('_cu') || 'null')
      if (saved && (!('roleData' in saved) || saved.roleData === null)) {
        sessionStorage.removeItem('_cu')
        return null
      }
      return saved
    } catch { return null }
  })

  async function login(userId: number, pin: string) {
    const result = await window.api.auth.login(userId, pin)
    if (result) {
      setUser(result)
      sessionStorage.setItem('_cu', JSON.stringify(result))
    }
    return !!result
  }

  function logout() {
    setUser(null)
    sessionStorage.removeItem('_cu')
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
