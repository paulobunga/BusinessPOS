import { useState, useEffect, useCallback } from 'react'
import type { Category } from '../../shared/types'

export function useCategories(activeOnly = false) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['categories:list'](activeOnly)
      setCategories(data as Category[])
    } catch (err) {
      setError((err as Error).message || 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => { fetch() }, [fetch])

  return { categories, loading, error, retry: fetch }
}