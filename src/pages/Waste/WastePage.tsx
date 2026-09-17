import { useState, useEffect } from 'react'
import { useWaste } from '../../hooks/useWaste'
import { useItems } from '../../hooks/useItems'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { PaginationFooter } from '../../components/PaginationFooter'
import { usePagination } from '../../hooks/usePagination'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { DatePicker } from '../../components/ui/date-picker'
import type { WasteRecord } from '../../../shared/types'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })

const REASONS: { value: 'staff_meal' | 'spoiled' | 'other'; label: string }[] = [
  { value: 'staff_meal', label: 'Cooked leftovers — given to staff' },
  { value: 'spoiled', label: 'Raw leftovers — thrown out' },
  { value: 'other', label: 'Other' },
]

const REASON_COLORS: Record<string, string> = {
  staff_meal: 'bg-success text-white',
  spoiled: 'bg-warning text-white',
  other: 'bg-muted text-foreground',
}

export function WastePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const { items } = useItems({ kind: 'priced', activeOnly: true })
  const { records, dailyTotal, loading, record, byItem, byItemData } = useWaste(date)

  const [open, setOpen] = useState(false)
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<'staff_meal' | 'spoiled' | 'other'>('staff_meal')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    byItem(date, date)
  }, [date, byItem])

  const recordsPager = usePagination(records)
  const byItemPager = usePagination(byItemData)

  const selectedItem = items.find(p => String(p.id) === itemId)
  const unitCostCents = selectedItem?.cost_price_cents ?? 0
  const quantityNum = parseFloat(quantity)
  const autoValue = isNaN(quantityNum) || quantityNum <= 0 ? 0 : Math.round(quantityNum * unitCostCents)
  const valueInput = estimatedValue === '' || estimatedValue === null ? autoValue : Math.round(parseFloat(estimatedValue))

  const handleItemChange = (v: string) => {
    setItemId(v)
    setEstimatedValue('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
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
    setItemId('')
    setQuantity('')
    setEstimatedValue('')
    setNotes('')
    setOpen(false)
  }

  const inputClass = 'h-11 rounded-[var(--radius-md)] bg-background text-[0.875rem]'

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Waste Recording</h1>
          <p className="m-0 text-[0.875rem] text-muted-foreground">
            Food bought but not sold is a loss. Record cooked leftovers given to staff or raw leftovers thrown out.
          </p>
        </div>
      </div>

      {/* Date picker */}
      <div className="flex flex-wrap items-end gap-4">
        <Label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
          Date
          <DatePicker value={date} onValueChange={setDate} />
        </Label>
        <span className="ml-auto pb-1 text-base font-bold">
          Daily Waste Value: {fmt.format(dailyTotal)}
        </span>
      </div>

      {/* Record form */}
      <div className="flex justify-end">
        <Button onClick={() => { setError(''); setOpen(true) }} className="bg-primary font-semibold">
          + Record Waste
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Waste</DialogTitle>
            <DialogDescription>
              Food bought but not sold is a loss. Record cooked leftovers given to staff or raw leftovers thrown out.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <p className="m-0 font-semibold text-destructive">{error}</p>}

            <div className="grid grid-cols-2 gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Item
                <Select value={itemId} onValueChange={handleItemChange}>
                  <SelectTrigger className="h-11 w-full rounded-[var(--radius-md)]">
                    <SelectValue placeholder="Select item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} — {fmt.format(p.cost_price_cents)}/kg
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>

              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Quantity (kg)
                <Input type="number" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} min="0" step="0.1" />
              </Label>

              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Reason
                <Select value={reason} onValueChange={v => setReason(v as typeof reason)}>
                  <SelectTrigger className="h-11 w-full rounded-[var(--radius-md)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>

              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Estimated Value (UGX)
                <Input
                  type="number"
                  placeholder={autoValue > 0 ? String(autoValue) : 'auto'}
                  value={estimatedValue}
                  onChange={e => setEstimatedValue(e.target.value)}
                  className={inputClass}
                  min="0"
                  step="0.01"
                />
              </Label>
            </div>

            {selectedItem && (
              <p className="m-0 text-[0.8125rem] text-muted-foreground">
                Auto-calculated as {quantity || '0'} kg × {fmt.format(unitCostCents)}/kg = {fmt.format(autoValue)}. Leave the field empty to use this value.
              </p>
            )}

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Notes (optional)
              <Input type="text" placeholder="e.g. 5 portions of goat curry given to staff" value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
            </Label>

            <DialogFooter>
              <Button type="submit" disabled={processing} className="bg-primary font-semibold">
                {processing ? 'Saving...' : 'Record Waste'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* List */}
      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : records.length === 0 ? (
        <p className="p-12 text-center text-lg text-muted-foreground">
          No waste recorded for this date.
        </p>
      ) : (
        <div>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <Table className="table-zebra">
              <TableHeader>
                <TableRow className="bg-card hover:bg-card">
                  <TableHead>Item</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Estimated Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordsPager.slice.map((w: WasteRecord) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-semibold">{w.item_name ?? `Item #${w.item_id}`}</TableCell>
                    <TableCell>
                      <Badge className={REASON_COLORS[w.reason] ?? 'bg-muted text-foreground'}>
                        {REASONS.find(r => r.value === w.reason)?.label ?? w.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">{w.notes ?? '—'}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{w.quantity} kg</TableCell>
                    <TableCell className="text-right font-bold">{fmt.format(w.estimated_value_cents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationFooter pager={recordsPager} />
        </div>
      )}

      {/* Aggregate by item */}
      {byItemData.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-[0.9375rem] font-bold text-foreground">Waste by Item</h3>
          <div>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <Table className="table-zebra">
              <TableHeader>
                <TableRow className="bg-card hover:bg-card">
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byItemPager.slice.map(row => (
                  <TableRow key={row.item_name}>
                    <TableCell className="font-semibold">{row.item_name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.total_quantity} kg</TableCell>
                    <TableCell className="text-right font-bold">{fmt.format(row.total_value_cents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationFooter pager={byItemPager} />
        </div>
        </div>
      )}
    </div>
  )
}