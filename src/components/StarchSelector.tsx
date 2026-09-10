import { useStarches } from '../hooks/useStarches'
import type { Starch } from '../../shared/types'

interface StarchSelectorProps {
  onSelect: (id: number, name: string) => void
}

export function StarchSelector({ onSelect }: StarchSelectorProps) {
  const { starches, loading } = useStarches()

  if (loading) return null

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
      {starches.map((s: Starch) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id, s.name)}
          style={{
            height: 48,
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          {s.name}
        </button>
      ))}
    </div>
  )
}