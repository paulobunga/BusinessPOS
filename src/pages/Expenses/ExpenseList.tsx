import type { Expense } from '../../../shared/types'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'

interface Props {
  expenses: Expense[]
  onEdit: (expense: Expense) => void
  onDelete: (id: number) => void
}

function formatCents(cents: number) {
  return `UGX ${(cents / 100).toLocaleString()}`
}

const SOURCE_COLORS: Record<string, string> = {
  till: 'bg-primary text-white',
  personal: 'bg-warning text-white',
  mpesa: 'bg-[#4CAF50] text-white',
}

export function ExpenseList({ expenses, onEdit, onDelete }: Props) {
  if (expenses.length === 0) {
    return <p className="p-6 text-center text-muted-foreground">No expenses recorded.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {expenses.map(exp => (
        <div key={exp.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-card px-4 py-3">
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[0.875rem] font-bold">{exp.category}</span>
              <Badge className={SOURCE_COLORS[exp.payment_source] ?? 'bg-muted text-foreground'}>
                {exp.payment_source}
              </Badge>
              {exp.reference && (
                <span className="text-xs text-muted-foreground">Ref: {exp.reference}</span>
              )}
            </div>
            {exp.description && (
              <p className="m-0 text-[0.875rem] text-muted-foreground">{exp.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[0.9375rem] font-bold">{formatCents(exp.amount_cents)}</span>
            <span className="text-xs text-muted-foreground">{exp.date}</span>
            <Button onClick={() => onEdit(exp)} variant="outline" size="xs">
              Edit
            </Button>
            <Button onClick={() => onDelete(exp.id)} variant="outline" size="xs" className="border-destructive text-destructive">
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}