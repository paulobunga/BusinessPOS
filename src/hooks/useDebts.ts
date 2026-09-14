import { useState, useCallback, useEffect } from 'react'
import type { CustomerBalance, CustomerDetail, PayOnAccountPayload, PayOnAccountResult } from '../../shared/types'

export function useDebts() {
  const [balances, setBalances] = useState<CustomerBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalances = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['debts:customerBalances']()
      setBalances(data)
    } catch (err) {
      setError((err as Error).message || 'Failed to load debts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchBalances() }, [fetchBalances])

  const recordPayment = useCallback(async (sale_id: number, amount_cents: number, till_session_id: number | null, created_by: number) => {
    const res = await window.api['debts:recordPayment']({ sale_id, amount_cents, payment_method: 'cash', till_session_id, created_by })
    await fetchBalances()
    return res
  }, [fetchBalances])

  const payOnAccount = useCallback(async (payload: PayOnAccountPayload): Promise<PayOnAccountResult> => {
    const res = await window.api['debts:payOnAccount'](payload)
    await fetchBalances()
    return res
  }, [fetchBalances])

  const customerDetail = useCallback((customerName: string): Promise<CustomerDetail> =>
    window.api['debts:customerDetail'](customerName), [])

  const balanceByName = useCallback((customerName: string): Promise<number> =>
    window.api['debts:balanceByName'](customerName), [])

  return { balances, loading, error, fetchBalances, recordPayment, payOnAccount, customerDetail, balanceByName }
}
