import { useState, useEffect, useCallback } from 'react'
import type { ProteinPurchaseWithName } from '../../shared/types'

export function useInventory(date: string) {
  const [purchases, setPurchases] = useState<ProteinPurchaseWithName[]>([])
  const [dailyTotal, setDailyTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [data, total] = await Promise.all([
      window.api['inventory:byDate'](date),
      window.api['inventory:dailyTotal'](date),
    ])
    setPurchases(data as ProteinPurchaseWithName[])
    setDailyTotal(total as number)
    setLoading(false)
  }, [date])

  useEffect(() => {
    refresh()
  }, [refresh])

  const record = useCallback(async (payload: { protein_id: number; quantity: number; cost_cents: number; date: string; created_by: number | null }) => {
    const result = await window.api['inventory:recordPurchase'](payload)
    await refresh()
    return result
  }, [refresh])

  return { purchases, dailyTotal, loading, record, refresh }
}