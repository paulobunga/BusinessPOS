import { useState, useEffect, useCallback } from 'react'
import type { ItemPurchaseWithName } from '../../shared/types'

export function useInventory(date: string) {
  const [purchases, setPurchases] = useState<ItemPurchaseWithName[]>([])
  const [dailyTotal, setDailyTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, total] = await Promise.all([
        window.api['inventory:byDate'](date),
        window.api['inventory:dailyTotal'](date),
      ])
      setPurchases(data as ItemPurchaseWithName[])
      setDailyTotal(total as number)
    } catch (err) {
      setError((err as Error).message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    refresh()
  }, [refresh])

  const record = useCallback(async (payload: { item_id: number; quantity: number; cost_cents: number; date: string; created_by: number | null; unit?: string; total_yield: number }) => {
    const result = await window.api['inventory:recordPurchase'](payload)
    await refresh()
    return result
  }, [refresh])

  return { purchases, dailyTotal, loading, error, record, refresh }
}