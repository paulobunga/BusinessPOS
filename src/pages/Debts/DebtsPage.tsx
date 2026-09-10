import { useState } from 'react'
import { useDebts } from '../../hooks/useDebts'
import { useAuth } from '../../context/AuthContext'
import { useTill } from '../../context/TillContext'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })

interface OpenDebt {
  sale_id: number
  customer_name: string
  debt_cents: number
  total_cents: number
  paid_cents: number
  created_at: string
}

export function DebtsPage() {
  const { debts, loading, recordPayment } = useDebts()
  const { userId } = useAuth()
  const { currentTill } = useTill()
  const [paying, setPaying] = useState<OpenDebt | null>(null)
  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)

  const handlePay = async () => {
    if (!paying || !amount || !userId) return
    const cents = Math.round(parseFloat(amount) * 100)
    if (isNaN(cents) || cents <= 0) return
    const owed = paying.debt_cents - paying.paid_cents
    const payCents = Math.min(cents, owed)
    setProcessing(true)
    await recordPayment(paying.sale_id, payCents, currentTill?.id ?? null, userId)
    setProcessing(false)
    setPaying(null)
    setAmount('')
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Customer Debts</h1>
        <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
          Total Owed: {fmt.format(debts.reduce((s: number, d: OpenDebt) => s + (d.debt_cents - d.paid_cents), 0) / 100)}
        </span>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Loading...</p>
      ) : debts.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 48, fontSize: '1.125rem' }}>No open debts</p>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Amount Owed</th>
                <th style={thStyle}>Paid</th>
                <th style={thStyle}>Remaining</th>
                <th style={thStyle}>Date</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((d: OpenDebt) => (
                <tr key={d.sale_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={tdStyle}>{d.customer_name || 'Unknown'}</td>
                  <td style={tdStyle}>{fmt.format(d.debt_cents / 100)}</td>
                  <td style={tdStyle}>{fmt.format(d.paid_cents / 100)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt.format((d.debt_cents - d.paid_cents) / 100)}</td>
                  <td style={tdStyle}>{new Date(d.created_at).toLocaleDateString()}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      onClick={() => { setPaying(d); setAmount(String((d.debt_cents - d.paid_cents) / 100)) }}
                      style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}
                    >
                      Record Payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paying && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-background)', borderRadius: 'var(--radius-lg)', padding: 24, width: 360 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Record Payment</h3>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              Customer: {paying.customer_name || 'Unknown'}
            </p>
            <p style={{ fontWeight: 600, marginBottom: 12 }}>
              Remaining: {fmt.format((paying.debt_cents - paying.paid_cents) / 100)}
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Payment Amount (UGX)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setPaying(null); setAmount('') }}
                style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={processing || !amount || parseFloat(amount) <= 0}
                style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.5 : 1 }}
              >
                {processing ? 'Saving...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: '0.8125rem',
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '0.9375rem',
}
