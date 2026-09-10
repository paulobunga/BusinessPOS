import { useState, useEffect, useCallback } from 'react'
import type { Expense, CreateExpensePayload } from '../../shared/types'

export function useExpenses(filters?: { date_from?: string; date_to?: string; category?: string; payment_source?: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['expenses:list'](filters)
      setExpenses(data as Expense[])
    } catch (err) {
      setError((err as Error).message || 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [filters?.date_from, filters?.date_to, filters?.category, filters?.payment_source])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(async (payload: CreateExpensePayload & { date: string }) => {
    const result = await window.api['expenses:create'](payload)
    await refresh()
    return result
  }, [refresh])

  const update = useCallback(async (id: number, payload: Partial<CreateExpensePayload & { date: string }>) => {
    const result = await window.api['expenses:update'](id, payload)
    await refresh()
    return result
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    await window.api['expenses:delete'](id)
    await refresh()
  }, [refresh])

  return { expenses, loading, error, create, update, remove, refresh }
}
