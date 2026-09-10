import { useState } from 'react'

interface PinPadProps {
  onSubmit: (pin: string) => void
  length?: number
}

export function PinPad({ onSubmit, length = 4 }: PinPadProps) {
  const [pin, setPin] = useState('')

  const handleDigit = (digit: string) => {
    if (pin.length < length) {
      const next = pin + digit
      setPin(next)
      if (next.length === length) onSubmit(next)
    }
  }

  const handleClear = () => setPin('')
  const handleBackspace = () => setPin(p => p.slice(0, -1))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 300 }}>
      {['1','2','3','4','5','6','7','8','9'].map(d => (
        <button key={d} onClick={() => handleDigit(d)}
          style={{ height: 56, fontSize: '1.5rem', fontWeight: 600, borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          {d}
        </button>
      ))}
      <button onClick={handleClear} style={{ height: 56, fontSize: '1rem', fontWeight: 600, borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        Clear
      </button>
      <button onClick={() => handleDigit('0')} style={{ height: 56, fontSize: '1.5rem', fontWeight: 600, borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        0
      </button>
      <button onClick={handleBackspace} style={{ height: 56, fontSize: '1rem', fontWeight: 600, borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        ⌫
      </button>
      <div style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: '2rem', letterSpacing: 8, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {'●'.repeat(pin.length)}
      </div>
    </div>
  )
}