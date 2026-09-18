import { useState } from 'react'
import { useReimbursements } from '../../hooks/useReimbursements'
import { useAuth } from '../../context/AuthContext'
import { useTill } from '../../context/TillContext'
import { DateRangeFilter } from '../../components/DateRangeFilter'
import { FilterBar } from '../../components/FilterBar'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { PaginationFooter } from '../../components/PaginationFooter'
import { usePagination } from '../../hooks/usePagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { DatePicker } from '../../components/ui/date-picker'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { Reimbursement } from '../../../shared/types'

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

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
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const amtCents = Math.round(parseFloat(amount))
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
    await remove(id)
  }

  const totalCents = reimbursements.reduce((sum, r) => sum + r.amount_cents, 0)
  const pager = usePagination(reimbursements)

  const selectClass = 'h-11 w-full rounded-[var(--radius-md)]'
  const inputClass = 'h-11 rounded-[var(--radius-md)] bg-background text-[0.875rem]'

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Owner Reimbursements</h1>
        <div className="flex items-center gap-3">
          <span className="text-[0.9375rem] font-bold">
            Total: {fmt(totalCents)}
          </span>
          <Button onClick={() => setShowForm(true)} className="bg-primary font-semibold">
            + New Reimbursement
          </Button>
        </div>
      </div>

      <FilterBar>
        <DateRangeFilter
          dateFrom={startDate}
          dateTo={endDate}
          onDateFromChange={setStartDate}
          onDateToChange={setEndDate}
          onReset={() => { setStartDate(today); setEndDate(today) }}
        />
      </FilterBar>

      {/* List */}
      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : reimbursements.length === 0 ? (
        <p className="p-12 text-center text-lg text-muted-foreground">No reimbursements recorded.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <Table className="table-zebra">
              <TableHeader>
                <TableRow className="bg-card hover:bg-card">
                  <TableHead>Paid To</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pager.slice.map((r: Reimbursement) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={r.paid_to === 'till' ? 'bg-primary text-white' : 'bg-success text-white'}>
                          {r.paid_to}
                        </Badge>
                        {r.till_session_id && (
                          <span className="text-xs text-muted-foreground">Till #{r.till_session_id}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground">{r.description}</TableCell>
                    <TableCell className="text-muted-foreground">{r.date}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(r.amount_cents)}</TableCell>
                    <TableCell className="text-right">
                      <Button onClick={() => setDeleteId(r.id)} variant="outline" size="xs" className="border-destructive text-destructive">
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationFooter pager={pager} />
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setError('') } }}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">New Reimbursement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            {error && <p className="font-semibold text-destructive">{error}</p>}

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Date
              <DatePicker value={date} onValueChange={setDate} />
            </Label>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Amount (UGX)
              <Input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} min="0" step="0.01" />
            </Label>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Description
              <Input
                type="text"
                placeholder="e.g. Reimburse groceries bought with personal money"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className={inputClass}
              />
            </Label>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Paid From (cash source)
              <Select value={paidTo} onValueChange={v => setPaidTo(v as 'till' | 'mpesa')}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="till">Till (Cash)</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
            </Label>

            {paidTo === 'till' && currentTill && (
              <p className="m-0 text-[0.8125rem] text-muted-foreground">
                Linked to Till Session #{currentTill.id}
              </p>
            )}

            {paidTo === 'till' && !currentTill && (
              <p className="m-0 text-[0.8125rem] font-semibold text-warning">
                No till session open. Consider using M-Pesa instead, or open the till first.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => { setShowForm(false); setError('') }} variant="outline" className="bg-transparent font-semibold">
                Cancel
              </Button>
              <Button type="submit" disabled={processing} className="bg-primary font-semibold">
                {processing ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={o => { if (!o) setDeleteId(null) }}
        title="Delete this reimbursement?"
        destructive
        confirmText="Delete"
        onConfirm={() => { if (deleteId != null) handleDelete(deleteId); setDeleteId(null) }}
      />
    </div>
  )
}