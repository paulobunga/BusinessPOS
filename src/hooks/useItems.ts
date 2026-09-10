import { useState, useEffect, useCallback, useRef } from 'react'
import type { MenuItemWithCategory } from '../../shared/types'

export interface ItemsFilters {
  categoryId?: number
  kind?: 'priced' | 'free'
  activeOnly?: boolean
}

export function useItems(filters?: ItemsFilters) {
  const [items, setItems] = useState<MenuItemWithCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filtersKey = JSON.stringify(filters ?? {})
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['items:list'](filtersRef.current ?? {})
      setItems(data as MenuItemWithCategory[])
    } catch (err) {
      setError((err as Error).message || 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [filtersKey])

  useEffect(() => { fetch() }, [fetch])

  return { items, loading, error, retry: fetch }
}