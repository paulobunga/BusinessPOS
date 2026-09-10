import { useState, useEffect, useCallback } from 'react'
import type { WasteRecord, WasteByItem } from '../../shared/types'

export function useWaste(date: string) {
  const [records, setRecords] = useState<WasteRecord[]>([])
  const [byItemData, setByItemData] = useState<WasteByItem[]>([])
  const [dailyTotal, setDailyTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, total] = await Promise.all([
        window.api['waste:byDate'](date),
        window.api['waste:dailyTotal'](date),
      ])
      setRecords(data as WasteRecord[])
      setDailyTotal(total as number)
    } catch (err) {
      setError((err as Error).message || 'Failed to load waste records')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    refresh()
  }, [refresh])

  const record = useCallback(async (payload: { item_id: number; quantity: number; estimated_value_cents: number; reason: 'staff_meal' | 'spoiled' | 'other'; waste_date: string; notes?: string }) => {
    const result = await window.api['waste:record'](payload)
    await refresh()
    return result
  }, [refresh])

  const byItem = useCallback(async (start: string, end: string) => {
    try {
      const data = await window.api['waste:byItem'](start, end)
      setByItemData(data as WasteByItem[])
      return data as WasteByItem[]
    } catch (err) {
      setError((err as Error).message || 'Failed to load waste by item')
      return []
    }
  }, [])

  return { records, dailyTotal, byItemData, byItem, loading, error, record, refresh }
}