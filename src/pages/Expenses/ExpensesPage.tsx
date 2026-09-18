import { useState } from 'react'
import { useExpenses } from '../../hooks/useExpenses'
import { ExpenseForm } from './ExpenseForm'
import { ExpenseList } from './ExpenseList'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { DateRangeFilter } from '../../components/DateRangeFilter'
import { FilterBar, FilterSelect } from '../../components/FilterBar'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { Expense } from '../../../shared/types'

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

export function ExpensesPage() {
  const [filters, setFilters] = useState<{ date_from?: string; date_to?: string; category?: string; payment_source?: string }>({})
  const { expenses, loading, error, create, update, remove } = useExpenses(filters)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

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
    await remove(id)
  }

  const totalCents = expenses.reduce((sum, e) => sum + e.amount_cents, 0)

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <div className="flex items-center gap-4">
          <span className="text-[0.9375rem] font-bold">Total: {fmt(totalCents)}</span>
          <Button onClick={() => { setEditing(null); setShowForm(true) }} className="bg-primary font-semibold">
            + New Expense
          </Button>
        </div>
      </div>

      <FilterBar>
        <DateRangeFilter
          dateFrom={filters.date_from ?? ''}
          dateTo={filters.date_to ?? ''}
          onDateFromChange={v => setFilters(f => ({ ...f, date_from: v || undefined }))}
          onDateToChange={v => setFilters(f => ({ ...f, date_to: v || undefined }))}
          onReset={() => setFilters({})}
        >
          <FilterSelect
            label="Source"
            value={filters.payment_source ?? 'all'}
            onChange={v => setFilters(f => ({ ...f, payment_source: v === 'all' ? undefined : v }))}
            options={[
              { value: 'all', label: 'All' },
              { value: 'till', label: 'Till' },
              { value: 'personal', label: 'Personal' },
              { value: 'mpesa', label: 'Mpesa' },
            ]}
          />
        </DateRangeFilter>
      </FilterBar>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="text-center font-semibold text-destructive">{error}</p>
      ) : (
        <ExpenseList expenses={expenses} onEdit={setEditing} onDelete={setDeleteId} />
      )}

      <Dialog open={(showForm || editing != null)} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null) } }}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editing ? 'Edit Expense' : 'New Expense'}</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            initial={editing ? { category: editing.category, description: editing.description ?? '', amount_cents: editing.amount_cents, payment_source: editing.payment_source, reference: editing.reference ?? '', date: editing.date } : undefined}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={o => { if (!o) setDeleteId(null) }}
        title="Delete this expense?"
        destructive
        confirmText="Delete"
        onConfirm={() => { if (deleteId != null) handleDelete(deleteId); setDeleteId(null) }}
      />
    </div>
  )
}