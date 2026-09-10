import { useState, useEffect } from 'react'
import { useWaste } from '../../hooks/useWaste'
import { useItems } from '../../hooks/useItems'
import type { WasteRecord } from '../../../shared/types'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })

const REASONS: { value: 'staff_meal' | 'spoiled' | 'other'; label: string }[] = [
  { value: 'staff_meal', label: 'Cooked leftovers — given to staff' },
  { value: 'spoiled', label: 'Raw leftovers — thrown out' },
  { value: 'other', label: 'Other' },
]

export function WastePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const { items } = useItems({ kind: 'priced', activeOnly: true })
  const { records, dailyTotal, loading, record, byItem, byItemData } = useWaste(date)

  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<'staff_meal' | 'spoiled' | 'other'>('staff_meal')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    byItem(date, date)
  }, [date, byItem])

  const selectedItem = items.find(p => String(p.id) === itemId)
  const unitCostCents = selectedItem?.cost_price_cents ?? 0
  const quantityNum = parseFloat(quantity)
  const autoValue = isNaN(quantityNum) || quantityNum <= 0 ? 0 : Math.round(quantityNum * unitCostCents)
  const valueInput = estimatedValue === '' || estimatedValue === null ? autoValue : Math.round(parseFloat(estimatedValue) * 100)

  const handleItemChange = (v: string) => {
    setItemId(v)
    setEstimatedValue('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!itemId || !quantity || isNaN(quantityNum) || quantityNum <= 0) {
      setError('Select an item and enter a valid quantity')
      return
    }
    if (isNaN(valueInput) || valueInput < 0) {
      setError('Enter a valid estimated value')
      return
    }
    setProcessing(true)
    await record({
      item_id: Number(itemId),
      quantity: quantityNum,
      estimated_value_cents: valueInput,
      reason,
      waste_date: date,
      notes: notes.trim() || undefined,
    })
    await byItem(date, date)
    setProcessing(false)
    setSuccess(`Recorded waste — ${fmt.format(valueInput / 100)}`)
    setItemId('')
    setQuantity('')
    setEstimatedValue('')
    setNotes('')
  }

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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Waste Recording</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', margin: 0 }}>
            Food bought but not sold is a loss. Record cooked leftovers given to staff or raw leftovers thrown out.
          </p>
        </div>
      </div>

      {/* Date picker */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '1rem' }}>
          Daily Waste Value: {fmt.format(dailyTotal / 100)}
        </span>
      </div>

      {/* Record form */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--color-border)' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 16 }}>Record Waste</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <p style={{ color: 'var(--color-danger)', fontWeight: 600, margin: 0 }}>{error}</p>}
          {success && <p style={{ color: '#4CAF50', fontWeight: 600, margin: 0 }}>{success}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={labelStyle}>
              Item
              <select value={itemId} onChange={e => handleItemChange(e.target.value)} style={inputStyle}>
                <option value="">Select item...</option>
                {items.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {fmt.format(p.cost_price_cents / 100)}/kg</option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Quantity (kg)
              <input type="number" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} style={inputStyle} min="0" step="0.1" />
            </label>

            <label style={labelStyle}>
              Reason
              <select value={reason} onChange={e => setReason(e.target.value as typeof reason)} style={inputStyle}>
                {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>

            <label style={labelStyle}>
              Estimated Value (UGX)
              <input
                type="number"
                placeholder={autoValue > 0 ? String(autoValue / 100) : 'auto'}
                value={estimatedValue}
                onChange={e => setEstimatedValue(e.target.value)}
                style={inputStyle}
                min="0"
                step="0.01"
              />
            </label>
          </div>

          {selectedItem && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', margin: 0 }}>
              Auto-calculated as {quantity || '0'} kg × {fmt.format(unitCostCents / 100)}/kg = {fmt.format(autoValue / 100)}. Leave the field empty to use this value.
            </p>
          )}

          <label style={labelStyle}>
            Notes (optional)
            <input type="text" placeholder="e.g. 5 portions of goat curry given to staff" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="submit" disabled={processing} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.5 : 1 }}>
              {processing ? 'Saving...' : 'Record Waste'}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Loading...</p>
      ) : records.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 48, fontSize: '1.125rem' }}>
          No waste recorded for this date.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {records.map((w: WasteRecord) => (
            <div key={w.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>{w.item_name ?? `Item #${w.item_id}`}</p>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: w.reason === 'staff_meal' ? '#4CAF50' : w.reason === 'spoiled' ? 'var(--color-warning)' : 'var(--color-muted)',
                    color: '#fff',
                    fontWeight: 600,
                  }}>
                    {REASONS.find(r => r.value === w.reason)?.label ?? w.reason}
                  </span>
                </div>
                {w.notes && <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', margin: 0 }}>{w.notes}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>{w.quantity} kg</span>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', width: 100, textAlign: 'right' }}>{fmt.format(w.estimated_value_cents / 100)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aggregate by item */}
      {byItemData.length > 0 && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 16, border: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--color-text-primary)' }}>Waste by Item</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byItemData.map(row => (
              <div key={row.item_name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{row.item_name}</span>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{row.total_quantity} kg</span>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', width: 100, textAlign: 'right' }}>{fmt.format(row.total_value_cents / 100)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}