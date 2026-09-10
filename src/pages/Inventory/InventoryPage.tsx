import { useState } from 'react'
import { useInventory } from '../../hooks/useInventory'
import { useItems } from '../../hooks/useItems'
import { useAuth } from '../../context/AuthContext'
import type { ItemPurchaseWithName } from '../../../shared/types'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })

export function InventoryPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const { items } = useItems({ kind: 'priced', activeOnly: true })
  const { purchases, dailyTotal, loading, record } = useInventory(date)
  const { userId } = useAuth()

  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState('')

  const selectedItem = items.find(p => String(p.id) === itemId)
  const unitCostCents = selectedItem?.cost_price_cents ?? 0
  const quantityNum = parseFloat(quantity)
  const computedTotal = isNaN(quantityNum) || quantityNum <= 0 ? 0 : Math.round(quantityNum * unitCostCents)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!itemId || !quantity || isNaN(quantityNum) || quantityNum <= 0) {
      setError('Select an item and enter a valid quantity')
      return
    }
    setProcessing(true)
    await record({
      item_id: Number(itemId),
      quantity: quantityNum,
      cost_cents: computedTotal,
      date,
      created_by: userId ?? null,
    })
    setProcessing(false)
    setSuccess(`Recorded purchase — ${fmt.format(computedTotal / 100)}`)
    setItemId('')
    setQuantity('')
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Food Cost (Daily Purchases)</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', margin: 0 }}>
            Record the day's stock purchases. This is your daily food cost.
          </p>
        </div>
      </div>

      {/* Date picker */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '1rem' }}>
          Daily Food Cost: {fmt.format(dailyTotal / 100)}
        </span>
      </div>

      {/* Record form */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--color-border)' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 16 }}>Record Daily Purchase</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <p style={{ color: 'var(--color-danger)', fontWeight: 600, margin: 0 }}>{error}</p>}
          {success && <p style={{ color: '#4CAF50', fontWeight: 600, margin: 0 }}>{success}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={labelStyle}>
              Item
              <select value={itemId} onChange={e => setItemId(e.target.value)} style={inputStyle}>
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
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>
              {selectedItem ? `${selectedItem.name} × ${quantity || '0'} kg @ ${fmt.format(unitCostCents / 100)}/kg` : 'Select an item to preview cost'}
            </span>
            <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: '1.125rem' }}>
              {fmt.format(computedTotal / 100)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="submit" disabled={processing} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.5 : 1 }}>
              {processing ? 'Saving...' : 'Record Purchase'}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Loading...</p>
      ) : purchases.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 48, fontSize: '1.125rem' }}>
          No purchases recorded for this date.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {purchases.map((p: ItemPurchaseWithName) => (
            <div key={p.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>{p.item_name ?? `Item #${p.item_id}`}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>{p.quantity_kg} kg</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>@{fmt.format((p.unit_cost_cents ?? p.cost_cents) / 100)}/kg</span>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', width: 100, textAlign: 'right' }}>{fmt.format(p.cost_cents / 100)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}