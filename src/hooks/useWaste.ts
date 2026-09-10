import { useState, useEffect, useCallback } from 'react'
import type { WasteRecord } from '../../shared/types'

export function useWaste(date: string) {
  const [records, setRecords] = useState<WasteRecord[]>([])
  const [dailyTotal, setDailyTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [data, total] = await Promise.all([
      window.api['waste:byDate'](date),
      window.api['waste:dailyTotal'](date),
    ])
    setRecords(data as WasteRecord[])
    setDailyTotal(total as number)
    setLoading(false)
  }, [date])

  useEffect(() => {
    refresh()
  }, [refresh])

  const record = useCallback(async (payload: { protein_id: number; quantity: number; estimated_value_cents: number; reason: 'staff_meal' | 'spoiled' | 'other'; waste_date: string; notes?: string }) => {
    const result = await window.api['waste:record'](payload)
    await refresh()
    return result
  }, [refresh])

  return { records, dailyTotal, loading, record, refresh }
}