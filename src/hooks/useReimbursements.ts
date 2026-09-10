import { useState, useEffect, useCallback } from 'react'
import type { Reimbursement } from '../../shared/types'

export function useReimbursements(start: string, end: string) {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['reimbursements:list'](start, end)
      setReimbursements(data as Reimbursement[])
    } catch (err) {
      setError((err as Error).message || 'Failed to load reimbursements')
    } finally {
      setLoading(false)
    }
  }, [start, end])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(async (payload: { description: string; amount_cents: number; till_session_id?: number | null; created_by: number; date: string; paid_to: 'till' | 'mpesa' }) => {
    const result = await window.api['reimbursements:create'](payload)
    await refresh()
    return result
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await window.api['reimbursements:delete'](id)
    await refresh()
  }, [refresh])

  return { reimbursements, loading, error, create, remove, refresh }
}
