import { useState, useCallback } from 'react'

export interface DebtEntryItem {
  name_snapshot: string
  unit_price_cents: number
  quantity: number
}

export interface DebtEntry {
  customer_name: string
  date: string
  items: DebtEntryItem[]
  paid_cents?: number
}

export interface DebtRecordResult {
  saleId: number
  customer: string
  debtCents: number
  subtotal: number
}

export function useRecordDebts() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const record = useCallback(async (entries: DebtEntry[], createdBy: number): Promise<DebtRecordResult[] | null> => {
    setLoading(true)
    setError(null)
    try {
      const valid = entries.filter((e) => e.customer_name.trim() && e.items.some((i) => i.name_snapshot.trim() && i.unit_price_cents > 0))
      if (valid.length === 0) {
        setError('No valid entries to record')
        return null
      }
      const payload = valid.map((e) => ({
        ...e,
        items: e.items.map((i) => ({
          name_snapshot: i.name_snapshot,
          unit_price_cents: i.unit_price_cents,
          quantity: i.quantity,
        })),
        created_by: createdBy,
      }))
      const result = await window.api['debts:recordFromList'](payload)
      return result as DebtRecordResult[]
    } catch (err) {
      setError((err as Error).message || 'Failed to record debts')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { record, loading, error }
}
