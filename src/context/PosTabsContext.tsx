import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { CartLine } from '../hooks/cartItems'

export interface PosTab {
  id: string
  label: string
  items: CartLine[]
  discountCents: number
  discountReason: string
}

interface PosTabsValue {
  tabs: PosTab[]
  setTabs: React.Dispatch<React.SetStateAction<PosTab[]>>
  activeTabId: string | null
  setActiveTabId: (id: string) => void
  createTab: () => PosTab
}

const PosTabsContext = createContext<PosTabsValue | null>(null)

/**
 * Owns POS customer tabs above the router so switching pages never
 * discards open tabs or advances the Customer counter. Tabs live for
 * the whole app session.
 */
export function PosTabsProvider({ children }: { children: React.ReactNode }) {
  const seq = useRef(0)
  const createTab = useCallback((): PosTab => {
    seq.current += 1
    return {
      id: `tab-${seq.current}-${Date.now()}`,
      label: `Customer ${seq.current}`,
      items: [],
      discountCents: 0,
      discountReason: '',
    }
  }, [])

  const [tabs, setTabs] = useState<PosTab[]>(() => [createTab()])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  return (
    <PosTabsContext.Provider value={{ tabs, setTabs, activeTabId, setActiveTabId, createTab }}>
      {children}
    </PosTabsContext.Provider>
  )
}

export function usePosTabs(): PosTabsValue {
  const v = useContext(PosTabsContext)
  if (!v) throw new Error('usePosTabs must be used inside PosTabsProvider')
  return v
}
