import { useState } from 'react'
import { useExpenses } from '../../hooks/useExpenses'
import { ExpenseForm } from './ExpenseForm'
import { ExpenseList } from './ExpenseList'
import type { Expense, CreateExpensePayload } from '../../../shared/types'

export function ExpensesPage() {
  const [filters, setFilters] = useState<{ date_from?: string; date_to?: string; category?: string; payment_source?: string }>({})
  const { expenses, loading, create, update, remove } = useExpenses(filters)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)

  const handleCreate = async (data: Parameters<typeof create>[0]) => {
    await create(data)
    setShowForm(false)
  }

  const handleUpdate = async (data: Parameters<typeof update>[1]) => {
    if (!editing) return
    await update(editing.id, data)
    setEditing(null)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this expense?')) return
    await remove(id)
  }

  const totalCents = expenses.reduce((sum, e) => sum + e.amount_cents, 0)

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
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Expenses</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
        >
          + New Expense
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>From</label>
        <input type="date" value={filters.date_from ?? ''} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value || undefined }))} style={inputStyle} />
        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>To</label>
        <input type="date" value={filters.date_to ?? ''} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value || undefined }))} style={inputStyle} />
        <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Source</label>
        <select value={filters.payment_source ?? ''} onChange={e => setFilters(f => ({ ...f, payment_source: e.target.value || undefined }))} style={inputStyle}>
          <option value="">All</option>
          <option value="till">Till</option>
          <option value="personal">Personal</option>
          <option value="mpesa">Mpesa</option>
        </select>
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.9375rem' }}>
          Total: UGX {(totalCents / 100).toLocaleString()}
        </span>
      </div>

      {/* Form modal */}
      {(showForm || editing) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 520, border: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>{editing ? 'Edit Expense' : 'New Expense'}</h2>
            <ExpenseForm
              initial={editing ? { category: editing.category, description: editing.description ?? '', amount_cents: editing.amount_cents, payment_source: editing.payment_source, reference: editing.reference ?? '', date: editing.date } : undefined}
              onSubmit={editing ? handleUpdate : handleCreate}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Loading...</p>
      ) : (
        <ExpenseList expenses={expenses} onEdit={setEditing} onDelete={handleDelete} />
      )}
    </div>
  )
}
