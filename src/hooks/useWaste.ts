import { useState, useEffect, useCallback } from 'react'
import type { WasteRecord, WasteByItem } from '../../shared/types'

export function useWaste(dateFrom: string, dateTo: string) {
  const [records, setRecords] = useState<WasteRecord[]>([])
  const [byItemData, setByItemData] = useState<WasteByItem[]>([])
  const [totalValue, setTotalValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, byItem] = await Promise.all([
        window.api['waste:byDateRange'](dateFrom, dateTo),
        window.api['waste:byItem'](dateFrom, dateTo),
      ])
      const rows = data as WasteRecord[]
      setRecords(rows)
      setByItemData(byItem as WasteByItem[])
      setTotalValue(rows.reduce((sum, r) => sum + r.estimated_value_cents, 0))
    } catch (err) {
      setError((err as Error).message || 'Failed to load waste records')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    refresh()
  }, [refresh])

  const record = useCallback(async (payload: { item_id: number; quantity: number; estimated_value_cents: number; reason: 'staff_meal' | 'spoiled' | 'other'; waste_date: string; notes?: string }) => {
    const result = await window.api['waste:record'](payload)
    await refresh()
    return result
  }, [refresh])

  return { records, totalValue, byItemData, loading, error, record, refresh }
}
