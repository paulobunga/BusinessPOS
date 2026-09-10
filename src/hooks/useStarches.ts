import { useState, useEffect } from 'react'
import type { Starch } from '../../shared/types'

export function useStarches() {
  const [starches, setStarches] = useState<Starch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api['starches:list']().then(data => {
      setStarches(data as Starch[])
      setLoading(false)
    })
  }, [])

  return { starches, loading }
}