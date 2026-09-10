import { useState, useEffect } from 'react'
import type { Protein } from '../../shared/types'

export function useProteins() {
  const [proteins, setProteins] = useState<Protein[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api['proteins:list']().then(data => {
      setProteins(data as Protein[])
      setLoading(false)
    })
  }, [])

  return { proteins, loading }
}