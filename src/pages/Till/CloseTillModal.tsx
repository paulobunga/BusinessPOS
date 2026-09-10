import { useState, useEffect } from 'react'
import type { TillCountData } from '../../../shared/types'

interface CloseTillModalProps {
  onCloseTill: (countedCents: number) => void
  onClose: () => void
}

export function CloseTillModal({ onCloseTill, onClose }: CloseTillModalProps) {
  const [actualCash, setActualCash] = useState('')
  const [countData, setCountData] = useState<TillCountData | null>(null)

  useEffect(() => {
    window.api['till:countCash']().then(setCountData)
  }, [])

  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  const handleClose = () => {
    const parsed = parseInt(actualCash, 10)
    if (!isNaN(parsed)) {
      onCloseTill(parsed)
      onClose()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 24, width: 400 }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Close Till</h3>
        {countData && (
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Opening Float</span>
              <span>{fmt(countData.openingFloatCents)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Cash Sales</span>
              <span style={{ color: 'var(--color-success)' }}>+{fmt(countData.cashSalesCents)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Till Expenses</span>
              <span style={{ color: 'var(--color-danger)' }}>-{fmt(countData.tillExpensesCents)}</span>
            </div>
            <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Expected Cash</span>
              <span style={{ color: 'var(--color-primary)' }}>{fmt(countData.expectedClosingCents)}</span>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Actual Cash Counted (UGX)</label>
          <input type="number" value={actualCash} onChange={e => setActualCash(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '1rem' }} />
        </div>
        {actualCash && countData && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 'var(--radius-md)', background: parseInt(actualCash, 10) >= countData.expectedClosingCents ? 'var(--color-success-bg, #e6f9e6)' : 'var(--color-danger-bg, #fce8e8)' }}>
            <span style={{ fontWeight: 700 }}>
              Variance: {fmt(parseInt(actualCash, 10) - countData.expectedClosingCents)}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleClose} style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-danger)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Close Till</button>
        </div>
      </div>
    </div>
  )
}