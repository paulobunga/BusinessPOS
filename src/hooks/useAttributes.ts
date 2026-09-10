import { useState, useEffect, useCallback } from 'react'
import type { AttributeDef } from '../../shared/types'

export function useAttributes(categoryId?: number | null) {
  const [attributes, setAttributes] = useState<AttributeDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['attributes:list']({ categoryId: categoryId ?? null })
      setAttributes(data as AttributeDef[])
    } catch (err) {
      setError((err as Error).message || 'Failed to load attributes')
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => { fetch() }, [fetch])

  return { attributes, loading, error, retry: fetch }
}