import { useState } from 'react'
import { useReimbursements } from '../../hooks/useReimbursements'
import { useAuth } from '../../context/AuthContext'
import { useTill } from '../../context/TillContext'
import type { Reimbursement } from '../../../shared/types'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })

export function ReimbursementsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const { reimbursements, loading, create, remove } = useReimbursements(startDate, endDate)
  const { userId } = useAuth()
  const { currentTill } = useTill()

  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [paidTo, setPaidTo] = useState<'till' | 'mpesa'>('till')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const amtCents = Math.round(parseFloat(amount) * 100)
    if (!amount || isNaN(amtCents) || amtCents <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (!description.trim()) {
      setError('Enter a description')
      return
    }
    setProcessing(true)
    setError('')
    await create({
      description: description.trim(),
      amount_cents: amtCents,
      till_session_id: paidTo === 'till' ? currentTill?.id ?? null : null,
      created_by: userId!,
      date,
      paid_to: paidTo,
    })
    setShowForm(false)
    setDescription('')
    setAmount('')
    setDate(today)
    setPaidTo('till')
    setProcessing(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this reimbursement?')) return
    await remove(id)
  }

  const totalCents = reimbursements.reduce((sum, r) => sum + r.amount_cents, 0)

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
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
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Owner Reimbursements</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', margin: 0 }}>
            Record when the business pays back the owner for personal money spent on business expenses
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
        >
          + New Reimbursement
        </button>
      </div>

      {/* Date range filter */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>From</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>To</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.9375rem' }}>
          Total: {fmt.format(totalCents / 100)}
        </span>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 520, border: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>New Reimbursement</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{error}</p>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label style={labelStyle}>
                  Date
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                </label>

                <label style={labelStyle}>
                  Amount (UGX)
                  <input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} min="0" step="0.01" />
                </label>
              </div>

              <label style={labelStyle}>
                Description
                <input
                  type="text"
                  placeholder="e.g. Reimburse groceries bought with personal money"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Paid From (cash source)
                <select value={paidTo} onChange={e => setPaidTo(e.target.value as 'till' | 'mpesa')} style={inputStyle}>
                  <option value="till">Till (Cash)</option>
                  <option value="mpesa">M-Pesa</option>
                </select>
              </label>

              {paidTo === 'till' && currentTill && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', margin: 0 }}>
                  Linked to Till Session #{currentTill.id}
                </p>
              )}

              {paidTo === 'till' && !currentTill && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-warning)', margin: 0, fontWeight: 600 }}>
                  No till session open. Consider using M-Pesa instead, or open the till first.
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowForm(false); setError('') }} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                  Cancel
                </button>
                <button type="submit" disabled={processing} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.5 : 1 }}>
                  {processing ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Loading...</p>
      ) : reimbursements.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 48, fontSize: '1.125rem' }}>No reimbursements recorded.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reimbursements.map((r: Reimbursement) => (
            <div key={r.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: r.paid_to === 'till' ? 'var(--color-primary)' : '#4CAF50',
                    color: '#fff',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}>
                    {r.paid_to}
                  </span>
                  {r.till_session_id && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Till #{r.till_session_id}</span>
                  )}
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', margin: 0 }}>{r.description}</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{fmt.format(r.amount_cents / 100)}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{r.date}</span>
                <button onClick={() => handleDelete(r.id)} style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.75rem' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
