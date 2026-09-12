import { useState } from 'react'
import { useInventory } from '../../hooks/useInventory'
import { useItems } from '../../hooks/useItems'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
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
import type { ItemPurchaseWithName } from '../../../shared/types'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })

export function InventoryPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const { items } = useItems({ kind: 'priced', activeOnly: true })
  const { purchases, dailyTotal, loading, record } = useInventory(date)
  const { userId } = useAuth()

  const [open, setOpen] = useState(false)
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const selectedItem = items.find(p => String(p.id) === itemId)
  const unitCostCents = selectedItem?.cost_price_cents ?? 0
  const quantityNum = parseFloat(quantity)
  const computedTotal = isNaN(quantityNum) || quantityNum <= 0 ? 0 : Math.round(quantityNum * unitCostCents)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
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
    setItemId('')
    setQuantity('')
    setOpen(false)
  }

  const inputClass = 'h-11 rounded-[var(--radius-md)] bg-background text-[0.875rem]'

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Food Cost (Daily Purchases)</h1>
          <p className="m-0 text-[0.875rem] text-muted-foreground">
            Record the day's stock purchases. This is your daily food cost.
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
          Daily Food Cost: {fmt.format(dailyTotal / 100)}
        </span>
      </div>

      {/* Record form */}
      <div className="flex justify-end">
        <Button onClick={() => { setError(''); setOpen(true) }} className="bg-primary font-semibold">
          + Record Purchase
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Daily Purchase</DialogTitle>
            <DialogDescription>
              Enter the item and quantity purchased today.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <p className="m-0 font-semibold text-destructive">{error}</p>}

            <div className="grid grid-cols-2 gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Item
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger className="h-11 w-full rounded-[var(--radius-md)]">
                    <SelectValue placeholder="Select item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} — {fmt.format(p.cost_price_cents / 100)}/kg
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>

              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Quantity (kg)
                <Input type="number" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} min="0" step="0.1" />
              </Label>
            </div>

            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-background px-4 py-3">
              <span className="text-[0.875rem] text-muted-foreground">
                {selectedItem ? `${selectedItem.name} × ${quantity || '0'} kg @ ${fmt.format(unitCostCents / 100)}/kg` : 'Select an item to preview cost'}
              </span>
              <span className="ml-auto text-lg font-extrabold">
                {fmt.format(computedTotal / 100)}
              </span>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={processing} className="bg-primary font-semibold">
                {processing ? 'Saving...' : 'Record Purchase'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* List */}
      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : purchases.length === 0 ? (
        <p className="p-12 text-center text-lg text-muted-foreground">
          No purchases recorded for this date.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {purchases.map((p: ItemPurchaseWithName) => (
            <div key={p.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-3">
                <p className="m-0 text-[0.9375rem] font-bold">{p.item_name ?? `Item #${p.item_id}`}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[0.875rem] text-muted-foreground">{p.quantity_kg} kg</span>
                <span className="text-[0.8125rem] text-muted-foreground">@{fmt.format((p.unit_cost_cents ?? p.cost_cents) / 100)}/kg</span>
                <span className="w-[100px] text-right text-[0.9375rem] font-bold">{fmt.format(p.cost_cents / 100)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}