import { useState } from 'react'

interface OpenTillModalProps {
  onOpen: (floatCents: number) => void
  onClose: () => void
}

export function OpenTillModal({ onOpen, onClose }: OpenTillModalProps) {
  const [balance, setBalance] = useState('')

  const handleOpen = () => {
    const parsed = parseInt(balance, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onOpen(parsed)
      onClose()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 24, width: 360 }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Open Till</h3>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Opening Float (UGX)</label>
          <input type="number" value={balance} onChange={e => setBalance(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '1rem' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleOpen} style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-success)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Open Till</button>
        </div>
      </div>
    </div>
  )
}