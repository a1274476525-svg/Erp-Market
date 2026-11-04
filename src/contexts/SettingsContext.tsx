import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { AppSettings } from '../types'

interface SettingsCtx {
  settings: AppSettings
  setSetting: (key: keyof AppSettings, value: string) => Promise<void>
  reload: () => Promise<void>
}

const defaults: AppSettings = {
  storeName: 'يو ماركت',
  currency: 'ج.م',
  taxRate: '14',
  autoBackupEnabled: 'false',
  autoBackupPath: '',
  autoBackupInterval: 'daily',
  autoBackupLastRun: '',
}

const Ctx = createContext<SettingsCtx>({
  settings: defaults,
  setSetting: async () => {},
  reload: async () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaults)

  async function reload() {
    const s = await window.api.settings.getAll()
    setSettings({ ...defaults, ...(s as unknown as AppSettings) })
  }

  useEffect(() => { reload() }, [])

  async function setSetting(key: keyof AppSettings, value: string) {
    await window.api.settings.set(key, value)
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return <Ctx.Provider value={{ settings, setSetting, reload }}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
