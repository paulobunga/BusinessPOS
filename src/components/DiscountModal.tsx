import { useState } from 'react'

interface DiscountModalProps {
  onApply: (cents: number, reason: string) => void
  onClose: () => void
}

export function DiscountModal({ onApply, onClose }: DiscountModalProps) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const handleApply = () => {
    const parsed = parseInt(amount, 10)
    if (parsed > 0 && reason.trim()) {
      onApply(parsed, reason.trim())
      onClose()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--color-background)', borderRadius: 'var(--radius-lg)', padding: 24, width: 360 }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Apply Discount</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Amount (UGX)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '1rem' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Reason</label>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Waste discount" style={{ width: '100%', padding: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '1rem' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleApply} style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Apply</button>
        </div>
      </div>
    </div>
  )
}