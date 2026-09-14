import { useState, useEffect, useCallback } from 'react'
import type { AssetSummary, AssetWithValue, CreateAssetPayload, DisposeAssetPayload } from '../../shared/types'

export function useAssets() {
  const [assets, setAssets] = useState<AssetWithValue[]>([])
  const [summary, setSummary] = useState<AssetSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, sum] = await Promise.all([
        window.api['assets:list'](),
        window.api['assets:summary'](),
      ])
      setAssets(list)
      setSummary(sum)
    } catch (err) {
      setError((err as Error).message || 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const create = useCallback(async (payload: CreateAssetPayload) => {
    const result = await window.api['assets:create'](payload)
    await refresh()
    return result
  }, [refresh])

  const update = useCallback(async (id: number, payload: Partial<CreateAssetPayload>) => {
    const result = await window.api['assets:update'](id, payload)
    await refresh()
    return result
  }, [refresh])

  const dispose = useCallback(async (id: number, payload: DisposeAssetPayload) => {
    const result = await window.api['assets:dispose'](id, payload)
    await refresh()
    return result
  }, [refresh])

  return { assets, summary, loading, error, create, update, dispose, refresh }
}