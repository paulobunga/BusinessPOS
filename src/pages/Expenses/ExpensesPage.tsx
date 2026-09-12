import { useState } from 'react'
import { useExpenses } from '../../hooks/useExpenses'
import { ExpenseForm } from './ExpenseForm'
import { ExpenseList } from './ExpenseList'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { DatePicker } from '../../components/ui/date-picker'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { Expense } from '../../../shared/types'

export function ExpensesPage() {
  const [filters, setFilters] = useState<{ date_from?: string; date_to?: string; category?: string; payment_source?: string }>({})
  const { expenses, loading, create, update, remove } = useExpenses(filters)
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

  const selectClass = 'h-11 w-full rounded-[var(--radius-md)]'

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true) }} className="bg-primary font-semibold">
          + New Expense
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
          From
          <DatePicker value={filters.date_from ?? ''} onValueChange={v => setFilters(f => ({ ...f, date_from: v || undefined }))} />
        </label>
        <label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
          To
          <DatePicker value={filters.date_to ?? ''} onValueChange={v => setFilters(f => ({ ...f, date_to: v || undefined }))} />
        </label>
        <label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
          Source
          <Select value={filters.payment_source ?? 'all'} onValueChange={v => setFilters(f => ({ ...f, payment_source: v === 'all' ? undefined : v }))}>
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="till">Till</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="mpesa">Mpesa</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <span className="ml-auto pb-1 text-[0.9375rem] font-bold">
          Total: UGX {(totalCents / 100).toLocaleString()}
        </span>
      </div>

      {/* Form modal */}
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

      {/* List */}
      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : (
        <ExpenseList expenses={expenses} onEdit={setEditing} onDelete={setDeleteId} />
      )}

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