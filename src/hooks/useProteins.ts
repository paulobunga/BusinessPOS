import { useState, useEffect, useCallback } from 'react'
import type { Protein } from '../../shared/types'

export function useProteins() {
  const [proteins, setProteins] = useState<Protein[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['proteins:list']()
      setProteins(data as Protein[])
    } catch (err) {
      setError((err as Error).message || 'Failed to load proteins')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { proteins, loading, error, retry: fetch }
}