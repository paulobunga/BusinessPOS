import { useState } from 'react'

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Transport', 'Marketing', 'Other']
const PAYMENT_SOURCES = ['till', 'personal', 'mpesa'] as const

interface Props {
  initial?: {
    category?: string
    description?: string
    amount_cents?: number
    payment_source?: 'till' | 'personal' | 'mpesa'
    reference?: string
    date?: string
  }
  onSubmit: (data: { category: string; description: string; amount_cents: number; payment_source: 'till' | 'personal' | 'mpesa'; reference: string; date: string }) => void
  onCancel: () => void
}

export function ExpenseForm({ initial, onSubmit, onCancel }: Props) {
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0])
  const [description, setDescription] = useState(initial?.description ?? '')
  const [amount, setAmount] = useState(initial?.amount_cents ? String(initial.amount_cents / 100) : '')
  const [paymentSource, setPaymentSource] = useState<'till' | 'personal' | 'mpesa'>(initial?.payment_source ?? 'till')
  const [reference, setReference] = useState(initial?.reference ?? '')
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amtCents = Math.round(parseFloat(amount) * 100)
    if (!amount || isNaN(amtCents) || amtCents <= 0) {
      setError('Enter a valid amount')
      return
    }
    onSubmit({
      category,
      description,
      amount_cents: amtCents,
      payment_source: paymentSource,
      reference,
      date,
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: '0.875rem',
    fontWeight: 600,
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <label style={labelStyle}>
          Date
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Category
          <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          Amount (UGX)
          <input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} min="0" step="0.01" />
        </label>

        <label style={labelStyle}>
          Payment Source
          <select value={paymentSource} onChange={e => setPaymentSource(e.target.value as typeof paymentSource)} style={inputStyle}>
            {PAYMENT_SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </label>
      </div>

      <label style={labelStyle}>
        Description
        <input type="text" placeholder="What was this expense for?" value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
      </label>

      <label style={labelStyle}>
        Reference
        <input type="text" placeholder="Receipt #, Mpesa code, etc." value={reference} onChange={e => setReference(e.target.value)} style={inputStyle} />
      </label>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
          Cancel
        </button>
        <button type="submit" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
          Save Expense
        </button>
      </div>
    </form>
  )
}
