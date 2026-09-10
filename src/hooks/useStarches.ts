import { useState, useEffect, useCallback } from 'react'
import type { Starch } from '../../shared/types'

export function useStarches() {
  const [starches, setStarches] = useState<Starch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['starches:list']()
      setStarches(data as Starch[])
    } catch (err) {
      setError((err as Error).message || 'Failed to load starches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { starches, loading, error, retry: fetch }
}