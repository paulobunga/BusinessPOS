import { useState, useEffect, useCallback } from 'react'
import type { User } from '../../shared/types'

export function useUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['users:list']()
      setUsers(data as User[])
    } catch (err) {
      setError((err as Error).message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { users, loading, error, retry: fetch }
}
