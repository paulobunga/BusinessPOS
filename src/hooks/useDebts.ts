import { useState, useCallback, useEffect } from 'react'

export function useDebts() {
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDebts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['debts:listOpen']()
      setDebts(data as any[])
    } catch (err) {
      setError((err as Error).message || 'Failed to load debts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDebts() }, [fetchDebts])

  const recordPayment = useCallback(async (sale_id: number, amount_cents: number, till_session_id: number | null, created_by: number) => {
    await window.api['debts:recordPayment']({ sale_id, amount_cents, payment_method: 'cash', till_session_id, created_by })
    await fetchDebts()
  }, [fetchDebts])

  return { debts, loading, error, fetchDebts, recordPayment }
}
