import type { Protein } from '../../shared/types'

interface ProteinCardProps {
  protein: Protein
  selected: boolean
  onSelect: (protein: Protein) => void
}

export function ProteinCard({ protein, selected, onSelect }: ProteinCardProps) {
  return (
    <button
      onClick={() => onSelect(protein)}
      style={{
        height: 64,
        padding: '8px 16px',
        borderRadius: 'var(--radius-md)',
        background: selected ? 'var(--color-primary)' : 'var(--color-surface)',
        color: selected ? 'white' : 'var(--color-text-primary)',
        border: selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
        fontWeight: 600,
        fontSize: '1rem',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <span>{protein.name}</span>
      <span style={{ fontWeight: 700 }}>
        {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(protein.selling_price_cents)}
      </span>
    </button>
  )
}