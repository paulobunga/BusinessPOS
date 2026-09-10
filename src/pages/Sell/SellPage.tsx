import { useState } from 'react'
import { useProteins } from '../../hooks/useProteins'
import { ProteinCard } from '../../components/ProteinCard'
import type { Protein } from '../../../shared/types'

export function SellPage() {
  const { proteins, loading } = useProteins()
  const [selectedProtein, setSelectedProtein] = useState<Protein | null>(null)

  if (loading) return <div style={{ padding: 24, textAlign: 'center' }}>Loading menu...</div>

  return (
    <div style={{ padding: 24, display: 'flex', gap: 24 }}>
      {/* Protein Grid */}
      <div style={{ flex: 2 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Select Protein</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {proteins.map(p => (
            <ProteinCard
              key={p.id}
              protein={p}
              selected={selectedProtein?.id === p.id}
              onSelect={setSelectedProtein}
            />
          ))}
        </div>
      </div>

      {/* Selected Protein Display */}
      <div style={{ flex: 1, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 24, border: '1px solid var(--color-border)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Current Selection</h2>
        {selectedProtein ? (
          <div>
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedProtein.name}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(selectedProtein.selling_price_cents)}
            </p>
            <p style={{ marginTop: 12, color: 'var(--color-text-secondary)' }}>
              Pick a starch below (free)
            </p>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-secondary)' }}>No protein selected</p>
        )}
      </div>
    </div>
  )
}