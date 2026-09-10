import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import type { TillSession } from '../../shared/types'

interface TillContextType {
  currentTill: TillSession | null
  openTill: (floatCents: number) => Promise<void>
  closeTill: (countedCents: number) => Promise<void>
  refreshTill: () => Promise<void>
}

const TillContext = createContext<TillContextType | null>(null)

export function TillProvider({ children }: { children: ReactNode }) {
  const [currentTill, setCurrentTill] = useState<TillSession | null>(null)

  const refreshTill = useCallback(async () => {
    const till = await window.api['till:current']()
    setCurrentTill(till)
  }, [])

  useEffect(() => { refreshTill() }, [refreshTill])

  const openTill = useCallback(async (floatCents: number) => {
    await window.api['till:open'](floatCents)
    await refreshTill()
  }, [refreshTill])

  const closeTill = useCallback(async (countedCents: number) => {
    await window.api['till:close'](countedCents)
    await refreshTill()
  }, [refreshTill])

  return (
    <TillContext.Provider value={{ currentTill, openTill, closeTill, refreshTill }}>
      {children}
    </TillContext.Provider>
  )
}

export function useTill() {
  const ctx = useContext(TillContext)
  if (!ctx) throw new Error('useTill must be used within TillProvider')
  return ctx
}
