import { useState } from 'react'

interface DebtModalProps {
  total: number
  onConfirm: (customerName: string) => void
  onClose: () => void
}

export function DebtModal({ total, onConfirm, onClose }: DebtModalProps) {
  const [name, setName] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--color-background)', borderRadius: 'var(--radius-lg)', padding: 24, width: 360 }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Record Debt</h3>
        <p style={{ fontWeight: 600, marginBottom: 12 }}>
          Amount: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(total)}
        </p>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Customer Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter customer name" style={{ width: '100%', padding: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '1rem' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => name.trim() && onConfirm(name.trim())} disabled={!name.trim()} style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-warning)', color: 'white', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>
            Confirm Debt
          </button>
        </div>
      </div>
    </div>
  )
}