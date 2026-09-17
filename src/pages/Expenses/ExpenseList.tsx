import type { Expense } from '../../../shared/types'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { usePagination } from '../../hooks/usePagination'
import { PaginationFooter } from '../../components/PaginationFooter'

interface Props {
  expenses: Expense[]
  onEdit: (expense: Expense) => void
  onDelete: (id: number) => void
}

function formatCents(cents: number) {
  return `UGX ${cents.toLocaleString()}`
}

const SOURCE_COLORS: Record<string, string> = {
  till: 'bg-primary text-white',
  personal: 'bg-warning text-white',
  mpesa: 'bg-success text-white',
}

export function ExpenseList({ expenses, onEdit, onDelete }: Props) {
  const pager = usePagination(expenses)

  if (expenses.length === 0) {
    return <p className="p-6 text-center text-muted-foreground">No expenses recorded.</p>
  }

  return (
    <div>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
        <Table className="table-zebra">
          <TableHeader>
            <TableRow className="bg-card hover:bg-card">
              <TableHead>Category</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pager.slice.map(exp => (
              <TableRow key={exp.id}>
                <TableCell className="font-semibold">{exp.category}</TableCell>
                <TableCell>
                  <Badge className={SOURCE_COLORS[exp.payment_source] ?? 'bg-muted text-foreground'}>
                    {exp.payment_source}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[280px] truncate text-muted-foreground">
                  {exp.description}
                  {exp.reference && <span className="text-xs text-muted-foreground"> · Ref: {exp.reference}</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{exp.date}</TableCell>
                <TableCell className="text-right font-bold">{formatCents(exp.amount_cents)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => onEdit(exp)} variant="outline" size="xs">
                      Edit
                    </Button>
                    <Button onClick={() => onDelete(exp.id)} variant="outline" size="xs" className="border-destructive text-destructive">
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationFooter pager={pager} />
    </div>
  )
}