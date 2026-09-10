import type { Expense } from '../../../shared/types'

interface Props {
  expenses: Expense[]
  onEdit: (expense: Expense) => void
  onDelete: (id: number) => void
}

function formatCents(cents: number) {
  return `UGX ${(cents / 100).toLocaleString()}`
}

const SOURCE_COLORS: Record<string, string> = {
  till: 'var(--color-primary)',
  personal: 'var(--color-warning)',
  mpesa: '#4CAF50',
}

export function ExpenseList({ expenses, onEdit, onDelete }: Props) {
  if (expenses.length === 0) {
    return <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 24 }}>No expenses recorded.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {expenses.map(exp => (
        <div key={exp.id} style={{
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
              <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{exp.category}</span>
              <span style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: SOURCE_COLORS[exp.payment_source] ?? 'var(--color-muted)',
                color: '#fff',
                fontWeight: 600,
              }}>
                {exp.payment_source}
              </span>
              {exp.reference && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Ref: {exp.reference}</span>
              )}
            </div>
            {exp.description && (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', margin: 0 }}>{exp.description}</p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{formatCents(exp.amount_cents)}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{exp.date}</span>
            <button onClick={() => onEdit(exp)} style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem' }}>
              Edit
            </button>
            <button onClick={() => onDelete(exp.id)} style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.75rem' }}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
