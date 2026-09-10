import { useTill } from '../../context/TillContext'

interface TillStatusProps {
  onOpenTill: () => void
}

export function TillStatus({ onOpenTill }: TillStatusProps) {
  const { currentTill } = useTill()

  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  if (!currentTill) {
    return (
      <button onClick={onOpenTill} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-warning)', background: 'var(--color-warning-bg, #fff8e1)', color: 'var(--color-warning)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)' }} />
        Till Closed — Open Till
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-success)', background: 'var(--color-success-bg, #e6f9e6)', fontWeight: 600, fontSize: '0.875rem' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }} />
      Till Open — {fmt(currentTill.opening_float_cents)}
    </div>
  )
}