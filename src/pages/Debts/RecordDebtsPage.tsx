import { useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useRecordDebts } from '@/hooks/useRecordDebts'
import { useAuth } from '@/context/AuthContext'
import { useTill } from '@/context/TillContext'
import type { DebtEntry, DebtEntryItem } from '@/hooks/useRecordDebts'

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

export function RecordDebtsPage() {
  const { userId } = useAuth()
  const { currentTill } = useTill()
  const { record, loading, error } = useRecordDebts()

  const [entries, setEntries] = useState<DebtEntry[]>([])
  const [showConfirm, setShowConfirm] = useState(false)

  const addEntry = () => {
    setEntries((prev) => [...prev, { customer_name: '', date: '2026-09-15', items: [{ name_snapshot: '', unit_price_cents: 0, quantity: 1 }], paid_cents: 0 }])
  }

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }

  const updateEntry = (index: number, updates: Partial<DebtEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...updates } : e)))
  }

  const updateItem = (entryIndex: number, itemIndex: number, updates: Partial<DebtEntryItem>) => {
    setEntries((prev) => prev.map((e, i) => {
      if (i !== entryIndex) return e
      return {
        ...e,
        items: e.items.map((item, j) => (j === itemIndex ? { ...item, ...updates } : item)),
      }
    }))
  }

  const addItem = (entryIndex: number) => {
    setEntries((prev) => prev.map((e, i) => {
      if (i !== entryIndex) return e
      return { ...e, items: [...e.items, { name_snapshot: '', unit_price_cents: 0, quantity: 1 }] }
    }))
  }

  const removeItem = (entryIndex: number, itemIndex: number) => {
    setEntries((prev) => prev.map((e, i) => {
      if (i !== entryIndex) return e
      return { ...e, items: e.items.filter((_, j) => j !== itemIndex) }
    }))
  }

  const totalDebt = entries.reduce((sum, e) => {
    const subtotal = e.items.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0)
    return sum + Math.max(subtotal - (e.paid_cents || 0), 0)
  }, 0)

  const entryCount = entries.filter((e) => e.customer_name.trim() && e.items.some((i) => i.name_snapshot.trim() && i.unit_price_cents > 0)).length

  const handleRecord = async () => {
    if (!userId) return
    const validEntries = entries.filter((e) => e.customer_name.trim() && e.items.some((i) => i.name_snapshot.trim() && i.unit_price_cents > 0))
    const result = await record(validEntries, userId)
    if (result) {
      setShowConfirm(false)
      setEntries([])
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Record Debts</h1>
          <p className="text-sm text-muted-foreground">Enter unpaid sales to record as customer debts</p>
        </div>
        <Button onClick={addEntry} variant="default" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Entry
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 p-12 text-center">
          <p className="text-lg text-muted-foreground">No entries yet. Click "Add Entry" to start recording debts.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-card hover:bg-card">
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Debt</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, i) => {
                  const subtotal = entry.items.reduce((s, item) => s + item.unit_price_cents * item.quantity, 0)
                  const paid = entry.paid_cents || 0
                  const debt = Math.max(subtotal - paid, 0)
                  return (
                    <>
                      <TableRow key={i}>
                        <TableCell>
                          <Input
                            value={entry.customer_name}
                            onChange={(e) => updateEntry(i, { customer_name: e.target.value })}
                            placeholder="Customer name"
                            className="h-9 bg-background text-base"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            {entry.items.map((item, j) => (
                              <div key={j} className="flex gap-1.5">
                                <Input
                                  value={item.name_snapshot}
                                  onChange={(e) => updateItem(i, j, { name_snapshot: e.target.value })}
                                  placeholder="Item"
                                  className="h-8 flex-1 bg-background text-xs"
                                />
                                <Input
                                  type="number"
                                  value={item.unit_price_cents || ''}
                                  onChange={(e) => updateItem(i, j, { unit_price_cents: Number(e.target.value) })}
                                  placeholder="Price"
                                  className="h-8 w-20 bg-background text-xs"
                                />
                                <Input
                                  type="number"
                                  value={item.quantity || ''}
                                  onChange={(e) => updateItem(i, j, { quantity: Number(e.target.value) || 1 })}
                                  placeholder="Qty"
                                  className="h-8 w-14 bg-background text-xs"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => removeItem(i, j)}
                                  className="h-8 w-8 shrink-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <Button type="button" variant="outline" size="xs" onClick={() => addItem(i)} className="h-7 self-start">
                              + Add Item
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{fmt(subtotal)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={paid || ''}
                            onChange={(e) => updateEntry(i, { paid_cents: Number(e.target.value) })}
                            placeholder="0"
                            className="h-8 w-24 bg-background text-xs text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right font-bold">{fmt(debt)}</TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeEntry(i)} className="h-8 w-8">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <p className="text-sm text-muted-foreground">Entries: {entryCount} valid</p>
              <p className="text-lg font-bold">Total Debt: {fmt(totalDebt)}</p>
            </div>
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={entryCount === 0 || loading}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" /> Record {entryCount > 0 ? `${entryCount} Debt${entryCount > 1 ? 's' : ''}` : 'Debts'}
            </Button>
          </div>
        </>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Record Debts</DialogTitle>
            <DialogDescription>
              This will record <strong>{entryCount}</strong> debt entries totaling <strong>{fmt(totalDebt)}</strong> UGX. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={handleRecord} disabled={loading}>
              {loading ? 'Recording...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
