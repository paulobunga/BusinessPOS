import { useEffect, useState } from 'react'
import { useInventory } from '../../hooks/useInventory'
import { useItems } from '../../hooks/useItems'
import { useCategories } from '../../hooks/useCategories'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Checkbox } from '../../components/ui/checkbox'
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
  const { items, retry: retryItems } = useItems({ kind: 'priced', activeOnly: true })
  const { categories, retry: retryCategories } = useCategories()
  const purchaseOnlyCatIds = new Set(categories.filter(c => c.purchase_only === 1).map(c => c.id))
  const { purchases, dailyTotal, loading, record } = useInventory(date)
  const { userId } = useAuth()

  const [open, setOpen] = useState(false)
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [costPerUnit, setCostPerUnit] = useState('')
  const [yieldEnabled, setYieldEnabled] = useState(false)
  const [yieldItemId, setYieldItemId] = useState('')
  const [portions, setPortions] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addQty, setAddQty] = useState('')
  const [addUnit, setAddUnit] = useState('kg')
  const [addUnitCost, setAddUnitCost] = useState('')
  const [addError, setAddError] = useState('')
  const [addProcessing, setAddProcessing] = useState(false)

  const selectedItem = items.find(p => String(p.id) === itemId)
  const quantityNum = parseFloat(quantity)
  const costPerUnitNum = parseFloat(costPerUnit)
  const portionsNum = parseFloat(portions)
  const computedTotal =
    isNaN(quantityNum) || isNaN(costPerUnitNum) || quantityNum <= 0 || costPerUnitNum < 0
      ? 0
      : Math.round(quantityNum * costPerUnitNum)
  const yieldDishCount = yieldEnabled && !isNaN(quantityNum) && !isNaN(portionsNum) && quantityNum > 0 && portionsNum > 0
    ? Math.round(quantityNum * portionsNum)
    : 0
  const perPlateCost = yieldDishCount > 0 && computedTotal > 0 ? Math.round(computedTotal / yieldDishCount) : 0
  const yieldItems = items.filter(p => !purchaseOnlyCatIds.has(p.category_id))

  const addQtyNum = parseFloat(addQty)
  const addUnitCostNum = parseFloat(addUnitCost)
  const addTotal =
    isNaN(addQtyNum) || isNaN(addUnitCostNum) || addQtyNum <= 0 || addUnitCostNum < 0
      ? 0
      : Math.round(addQtyNum * addUnitCostNum)

  useEffect(() => {
    setCostPerUnit(selectedItem ? String(selectedItem.cost_price_cents) : '')
    if (selectedItem?.purchase_unit) setUnit(selectedItem.purchase_unit)
  }, [selectedItem])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!itemId || !quantity || isNaN(quantityNum) || quantityNum <= 0) {
      setError('Select an item and enter a valid quantity')
      return
    }
    if (isNaN(costPerUnitNum) || costPerUnitNum < 0) {
      setError('Enter a valid cost per unit')
      return
    }
    if (yieldEnabled && (!yieldItemId || isNaN(portionsNum) || portionsNum <= 0)) {
      setError('Select the yield dish and enter portions')
      return
    }
    setProcessing(true)
    await record({
      item_id: Number(itemId),
      quantity: quantityNum,
      cost_cents: computedTotal,
      date,
      created_by: userId ?? null,
      unit: unit.trim() || 'kg',
      yield_item_id: yieldEnabled ? Number(yieldItemId) : null,
      expected_yield: yieldEnabled && !isNaN(portionsNum) ? Math.max(1, Math.round(portionsNum)) : undefined,
    })
    setProcessing(false)
    setItemId('')
    setQuantity('')
    setUnit('kg')
    setCostPerUnit('')
    setYieldEnabled(false)
    setYieldItemId('')
    setPortions('')
    setOpen(false)
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    const name = addName.trim()
    if (!name) {
      setAddError('Item name is required')
      return
    }
    if (isNaN(addQtyNum) || addQtyNum <= 0) {
      setAddError('Enter a valid quantity purchased')
      return
    }
    if (isNaN(addUnitCostNum) || addUnitCostNum < 0) {
      setAddError('Enter a valid unit cost')
      return
    }
    setAddProcessing(true)
    try {
      let stockCat = categories.find(c => c.purchase_only === 1)
      if (!stockCat) {
        stockCat = await window.api['categories:upsert']({ name: 'Stock', kind: 'priced', purchase_only: 1 })
        retryCategories()
      }
      const unitName = addUnit.trim() || 'kg'
      const createdItem = await window.api['items:upsert']({
        category_id: stockCat.id,
        name,
        selling_price_cents: 0,
        cost_price_cents: Math.round(addUnitCostNum),
        purchase_unit: unitName,
        active: 1,
      })
      await record({
        item_id: createdItem.id,
        quantity: addQtyNum,
        cost_cents: addTotal,
        date,
        created_by: userId ?? null,
        unit: unitName,
      })
      retryItems()
      setAddOpen(false)
      setAddName('')
      setAddQty('')
      setAddUnit('kg')
      setAddUnitCost('')
    } catch (err) {
      setAddError((err as Error).message || 'Failed to add item')
    } finally {
      setAddProcessing(false)
    }
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
          Daily Food Cost: {fmt.format(dailyTotal)}
        </span>
      </div>

      {/* Record form */}
      <div className="flex justify-end gap-2">
        <Button onClick={() => { setAddError(''); setAddOpen(true) }} variant="outline" className="h-11 border-border bg-card font-semibold">
          + Add Item
        </Button>
        <Button onClick={() => { setError(''); setOpen(true) }} className="bg-primary font-semibold">
          + Record Purchase
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Item &amp; Record Purchase</DialogTitle>
            <DialogDescription>
              Create a stock item and log today's purchase in one step. Prices vary per season — enter the unit cost you actually paid (e.g. a bunch of matooke at 15,000 or 20,000 UGX).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddItem} className="flex flex-col gap-4">
            {addError && <p className="m-0 font-semibold text-destructive">{addError}</p>}

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Item name
              <Input value={addName} onChange={e => setAddName(e.target.value)} className={inputClass} placeholder="e.g. Sugar, Tomatoes, Bunch of Matooke" autoFocus />
            </Label>

            <div className="grid grid-cols-2 gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Qty purchased ({addUnit || 'unit'})
                <Input type="number" min="0" step="0.1" value={addQty} onChange={e => setAddQty(e.target.value)} className={inputClass} placeholder="0" />
              </Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Purchase unit
                <Input value={addUnit} onChange={e => setAddUnit(e.target.value)} className={inputClass} placeholder="kg" />
              </Label>
            </div>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Unit cost (UGX)
              <Input type="number" min="0" step="0.5" value={addUnitCost} onChange={e => setAddUnitCost(e.target.value)} className={inputClass} placeholder="e.g. 20000 per bunch" />
            </Label>

            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-background px-4 py-3">
              <span className="text-[0.875rem] text-muted-foreground">
                {addName.trim()
                  ? `${addName.trim()} × ${addQty || '0'} ${addUnit || 'unit'} @ ${fmt.format(isNaN(addUnitCostNum) ? 0 : addUnitCostNum)}/${addUnit || 'unit'}`
                  : 'Enter an item, quantity and unit cost to preview'}
              </span>
              <span className="ml-auto text-lg font-extrabold">
                {fmt.format(addTotal)}
              </span>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary font-semibold" disabled={addProcessing}>
                {addProcessing ? 'Saving...' : 'Add & Record Purchase'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
<DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Record Daily Purchase</DialogTitle>
              <DialogDescription>
                Enter the item, quantity and cost purchased today.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && <p className="m-0 font-semibold text-destructive">{error}</p>}

              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Item
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger className="h-11 w-full rounded-[var(--radius-md)]">
                    <SelectValue placeholder="Select item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} — {fmt.format(p.cost_price_cents)}/{p.purchase_unit ?? 'kg'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>

              <div className="grid grid-cols-2 gap-4">
                <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                  Quantity ({selectedItem?.purchase_unit ?? 'kg'})
                  <Input type="number" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} min="0" step="0.1" />
                </Label>
                <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                  Unit
                  <Input value={unit} onChange={e => setUnit(e.target.value)} className={inputClass} placeholder="kg" />
                </Label>
              </div>

              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Cost per {unit || 'unit'} (UGX)
                <Input type="number" placeholder="0" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} className={inputClass} min="0" step="0.5" />
              </Label>

              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-background px-4 py-3">
                <span className="text-[0.875rem] text-muted-foreground">
                  {selectedItem && !isNaN(costPerUnitNum)
                    ? `${selectedItem.name} × ${quantity || '0'} ${unit || 'unit'} @ ${fmt.format(costPerUnitNum)}/${unit || 'unit'}`
                    : 'Select an item and enter cost to preview total'}
                </span>
                <span className="ml-auto text-lg font-extrabold">
                  {fmt.format(computedTotal)}
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-background p-3">
                <Checkbox
                  id="yields-enabled"
                  checked={yieldEnabled}
                  onCheckedChange={v => setYieldEnabled(!!v)}
                />
                <Label htmlFor="yields-enabled" className="text-[0.875rem] font-semibold">
                  Yields sellable portions (e.g. whole chicken → plates)
                </Label>
              </div>

              {yieldEnabled && (
                <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-background p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                      Yields dish
                      <Select value={yieldItemId} onValueChange={setYieldItemId}>
                        <SelectTrigger className="h-11 w-full rounded-[var(--radius-md)]">
                          <SelectValue placeholder="Select dish..." />
                        </SelectTrigger>
                        <SelectContent>
                          {yieldItems.map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Label>
                    <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                      Portions per {unit || 'unit'}
                      <Input type="number" placeholder="0" value={portions} onChange={e => setPortions(e.target.value)} className={inputClass} min="1" />
                    </Label>
                  </div>
                  {yieldDishCount > 0 && computedTotal > 0 && (
                    <p className="m-0 text-[0.875rem] text-muted-foreground">
                      {quantityNum} {unit || 'unit'} → {yieldDishCount} plates @ {fmt.format(perPlateCost)}/plate
                    </p>
                  )}
                </div>
              )}

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
                {p.yield_item_name && (
                  <span className="text-[0.8125rem] text-muted-foreground">→ {p.yield_item_name}</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[0.875rem] text-muted-foreground">{p.quantity_kg} {p.unit ?? 'kg'}</span>
                <span className="text-[0.8125rem] text-muted-foreground">@{fmt.format(p.unit_cost_cents ?? p.cost_cents)}/{p.unit ?? 'kg'}</span>
                <span className="w-[100px] text-right text-[0.9375rem] font-bold">{fmt.format(p.cost_cents)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}