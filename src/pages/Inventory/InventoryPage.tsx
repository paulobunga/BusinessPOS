import { useEffect, useMemo, useState } from 'react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { DatePicker } from '../../components/ui/date-picker'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { Check, ChevronsUpDown, Package, Plus, Search, X } from 'lucide-react'
import type { ItemPurchaseWithName } from '../../../shared/types'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })

type YieldRow = { mealId: string; portions: string }
type Tab = 'raw' | 'meals'

export function InventoryPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [tab, setTab] = useState<Tab>('raw')
  const [date, setDate] = useState(today)
  const { items, retry: retryItems } = useItems({ kind: 'priced', activeOnly: true })
  const { categories, retry: retryCategories } = useCategories()
  const purchaseOnlyCatIds = useMemo(
    () => new Set(categories.filter(c => c.purchase_only === 1).map(c => c.id)),
    [categories]
  )
  const { purchases, dailyTotal, loading, record } = useInventory(date)
  const { userId } = useAuth()

  const rawItems = items.filter(p => purchaseOnlyCatIds.has(p.category_id))
  const meals = items.filter(p => !purchaseOnlyCatIds.has(p.category_id))
  const mealCats = categories.filter(c => c.kind === 'priced' && c.purchase_only !== 1)

  // Record purchase dialog
  const [open, setOpen] = useState(false)
  const [purchaseDate, setPurchaseDate] = useState(today)
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [costPerUnit, setCostPerUnit] = useState('')
  const [yieldEnabled, setYieldEnabled] = useState(false)
  const [yieldRows, setYieldRows] = useState<YieldRow[]>([])
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const [comboOpen, setComboOpen] = useState(false)
  const [comboQuery, setComboQuery] = useState('')

  const [addNestedOpen, setAddNestedOpen] = useState(false)
  const [nestedName, setNestedName] = useState('')
  const [nestedUnit, setNestedUnit] = useState('')
  const [nestedError, setNestedError] = useState('')
  const [nestedProcessing, setNestedProcessing] = useState(false)

  // Add raw input dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addUnit, setAddUnit] = useState('kg')
  const [addUnitCost, setAddUnitCost] = useState('')
  const [addError, setAddError] = useState('')
  const [addProcessing, setAddProcessing] = useState(false)

  // Add meal dialog
  const [mealOpen, setMealOpen] = useState(false)
  const [mealName, setMealName] = useState('')
  const [mealCatId, setMealCatId] = useState('')
  const [mealPrice, setMealPrice] = useState('')
  const [mealError, setMealError] = useState('')
  const [mealProcessing, setMealProcessing] = useState(false)

  const selectedItem = items.find(p => String(p.id) === itemId)
  const quantityNum = parseFloat(quantity)
  const costPerUnitNum = parseFloat(costPerUnit)
  const computedTotal =
    isNaN(quantityNum) || isNaN(costPerUnitNum) || quantityNum <= 0 || costPerUnitNum < 0
      ? 0
      : Math.round(quantityNum * costPerUnitNum)

  const validYieldRows = yieldRows
    .map(r => ({ mealId: r.mealId, portions: parseFloat(r.portions) }))
    .filter(r => r.mealId && !isNaN(r.portions) && r.portions > 0)
  const totalPortions = validYieldRows.reduce((sum, r) => sum + r.portions, 0)
  const costPerPortion = yieldEnabled && totalPortions > 0 && computedTotal > 0
    ? Math.round(computedTotal / totalPortions)
    : 0

  const comboFiltered = useMemo(() => {
    const q = comboQuery.trim().toLowerCase()
    const base = q ? rawItems.filter(p => p.name.toLowerCase().includes(q)) : rawItems
    return base.slice(0, 6)
  }, [rawItems, comboQuery])

  useEffect(() => {
    setCostPerUnit(selectedItem ? String(selectedItem.cost_price_cents) : '')
    if (selectedItem?.purchase_unit) setUnit(selectedItem.purchase_unit)
  }, [selectedItem])

  const resetRecordForm = () => {
    setItemId('')
    setQuantity('')
    setUnit('kg')
    setCostPerUnit('')
    setYieldEnabled(false)
    setYieldRows([])
    setComboQuery('')
  }

  const addYieldRow = () => setYieldRows(rows => [...rows, { mealId: '', portions: '' }])
  const setYieldRow = (index: number, patch: Partial<YieldRow>) =>
    setYieldRows(rows => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  const removeYieldRow = (index: number) =>
    setYieldRows(rows => rows.filter((_, i) => i !== index))

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
    if (yieldEnabled && validYieldRows.length === 0) {
      setError('Add at least one meal and its portions, or turn off yields')
      return
    }
    setProcessing(true)
    const yields = yieldEnabled
      ? validYieldRows.map(r => ({ itemId: Number(r.mealId), portions: Math.round(r.portions) }))
      : []
    try {
      await record({
        item_id: Number(itemId),
        quantity: quantityNum,
        cost_cents: computedTotal,
        date: purchaseDate || today,
        created_by: userId ?? null,
        unit: unit.trim() || 'kg',
        yields,
      })
      resetRecordForm()
      setOpen(false)
    } catch (err) {
      setError((err as Error).message || 'Failed to record purchase')
    } finally {
      setProcessing(false)
    }
  }

  const handleAddRaw = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    const name = addName.trim()
    if (!name) {
      setAddError('Item name is required')
      return
    }
    if (isNaN(parseFloat(addUnitCost)) || parseFloat(addUnitCost) < 0) {
      setAddError('Enter a valid default unit cost')
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
      await window.api['items:upsert']({
        category_id: stockCat.id,
        name,
        selling_price_cents: 0,
        cost_price_cents: Math.round(parseFloat(addUnitCost)),
        purchase_unit: unitName,
        active: 1,
      })
      retryItems()
      setAddOpen(false)
      setAddName('')
      setAddUnit('kg')
      setAddUnitCost('')
    } catch (err) {
      setAddError((err as Error).message || 'Failed to add raw input')
    } finally {
      setAddProcessing(false)
    }
  }

  const handleNestedAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setNestedError('')
    const name = nestedName.trim()
    if (!name) return
    setNestedProcessing(true)
    try {
      let stockCat = categories.find(c => c.purchase_only === 1)
      if (!stockCat) {
        stockCat = await window.api['categories:upsert']({ name: 'Stock', kind: 'priced', purchase_only: 1 })
        retryCategories()
      }
      const created = await window.api['items:upsert']({
        category_id: stockCat.id,
        name,
        selling_price_cents: 0,
        cost_price_cents: 0,
        purchase_unit: nestedUnit.trim() || 'kg',
        active: 1,
      })
      retryItems()
      setItemId(String(created.id))
      setUnit(created.purchase_unit ?? 'kg')
      setCostPerUnit('')
      setComboQuery(created.name)
      setNestedName('')
      setNestedUnit('')
      setAddNestedOpen(false)
      setComboOpen(false)
    } catch (err) {
      setNestedError((err as Error).message || 'Failed to add item')
    } finally {
      setNestedProcessing(false)
    }
  }

  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault()
    setMealError('')
    const name = mealName.trim()
    if (!name) {
      setMealError('Meal name is required')
      return
    }
    if (!mealCatId) {
      setMealError('Select a category')
      return
    }
    if (isNaN(parseFloat(mealPrice)) || parseFloat(mealPrice) < 0) {
      setMealError('Enter a valid selling price')
      return
    }
    setMealProcessing(true)
    try {
      await window.api['items:upsert']({
        category_id: Number(mealCatId),
        name,
        selling_price_cents: Math.round(parseFloat(mealPrice)),
        cost_price_cents: 0,
        active: 1,
      })
      retryItems()
      setMealOpen(false)
      setMealName('')
      setMealCatId('')
      setMealPrice('')
    } catch (err) {
      setMealError((err as Error).message || 'Failed to add meal')
    } finally {
      setMealProcessing(false)
    }
  }

  const toggleOutOfStock = async (item: { id: number; category_id: number; name: string; out_of_stock: number }) => {
    try {
      await window.api['items:upsert']({
        id: item.id,
        category_id: item.category_id,
        name: item.name,
        out_of_stock: item.out_of_stock ? 0 : 1,
      })
      retryItems()
    } catch {
      // ignore toggle failures
    }
  }

  const inputClass = 'h-11 rounded-[var(--radius-md)] bg-background text-[0.875rem]'

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="m-0 text-[0.875rem] text-muted-foreground">
          Raw inputs are what you buy (e.g. a whole chicken). Meals are what you sell on the POS (e.g. Boiled Chicken).
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
        <TabsList>
          <TabsTrigger value="raw">Raw Inputs</TabsTrigger>
          <TabsTrigger value="meals">Meals</TabsTrigger>
        </TabsList>

        <TabsContent value="raw">
          <Card>
            <CardHeader>
              <CardTitle>Raw Inputs</CardTitle>
              <CardDescription>
                What you buy (e.g. a whole chicken). Record purchases against these, then yield portions into meals.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Date filter for the list */}
          <div className="flex flex-wrap items-end gap-4">
            <Label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
              Viewing date
              <DatePicker value={date} onValueChange={setDate} />
            </Label>
            <span className="ml-auto pb-1 text-base font-bold">
              Food Cost ({date}): {fmt.format(dailyTotal)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button onClick={() => { setAddError(''); setAddOpen(true) }} variant="outline" className="h-11 border-border bg-card font-semibold">
              + Add Raw Input
            </Button>
            <Button onClick={() => { setError(''); setPurchaseDate(today); setOpen(true) }} className="bg-primary font-semibold">
              + Record Purchase
            </Button>
          </div>

          {/* Purchase list */}
          {loading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : purchases.length === 0 ? (
            <p className="p-12 text-center text-lg text-muted-foreground">
              No purchases recorded for this date.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {purchases.map((p: ItemPurchaseWithName) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-card px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="m-0 text-[0.9375rem] font-bold">{p.item_name ?? `Item #${p.item_id}`}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {(p.yields ?? []).map(y => (
                          <span key={y.id} className="rounded-full border border-border bg-background px-2 py-0.5 text-[0.8125rem] text-muted-foreground">
                            → {y.portions} × {y.name}
                          </span>
                        ))}
                      </div>
                    </div>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meals">
          <Card>
            <CardHeader>
              <CardTitle>Meals</CardTitle>
              <CardDescription>
                What you sell on the POS. Each meal shows its selling price and current cost per serving.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="ml-auto">
            <Button onClick={() => { setMealError(''); setMealCatId(mealCats[0] ? String(mealCats[0].id) : ''); setMealOpen(true) }} className="bg-primary font-semibold">
              + Add Meal
            </Button>
          </div>

          {meals.length === 0 ? (
            <p className="p-12 text-center text-lg text-muted-foreground">
              No meals yet. Add the dishes you sell on the POS.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {meals.map(m => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-card px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="m-0 text-[0.9375rem] font-bold">{m.name}</p>
                      {m.out_of_stock === 1 && (
                        <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[0.75rem] font-bold text-warning">
                          OUT OF STOCK
                        </span>
                      )}
                    </div>
                    <span className="text-[0.8125rem] text-muted-foreground">{m.category_name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[0.9375rem] font-bold">{fmt.format(m.selling_price_cents)}</span>
                      <span className="text-[0.8125rem] text-muted-foreground">cost {fmt.format(m.cost_price_cents)}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-border bg-background px-3 text-[0.8125rem] font-semibold"
                      onClick={() => toggleOutOfStock(m)}
                    >
                      {m.out_of_stock === 1 ? 'Mark in stock' : 'Mark out of stock'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add raw input */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Raw Input</DialogTitle>
            <DialogDescription>
              A raw input is something you buy (e.g. whole chicken, matooke, oil). It stays hidden from the POS — record purchases and yields separately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddRaw} className="flex flex-col gap-4">
            {addError && <p className="m-0 font-semibold text-destructive">{addError}</p>}

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Name
              <Input value={addName} onChange={e => setAddName(e.target.value)} className={inputClass} placeholder="e.g. Whole Chicken" autoFocus />
            </Label>

            <div className="grid grid-cols-2 gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Purchase unit
                <Input value={addUnit} onChange={e => setAddUnit(e.target.value)} className={inputClass} placeholder="kg" />
              </Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Default unit cost (UGX)
                <Input type="number" min="0" step="0.5" value={addUnitCost} onChange={e => setAddUnitCost(e.target.value)} className={inputClass} placeholder="e.g. 17000" />
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary font-semibold" disabled={addProcessing}>
                {addProcessing ? 'Saving...' : 'Add Raw Input'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record purchase */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Purchase</DialogTitle>
            <DialogDescription>
              Log what you bought and (optionally) which meals it yields. Purchase date defaults to today.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex max-h-[min(80vh,700px)] flex-col gap-4 overflow-y-auto pr-1">
            {error && <p className="m-0 font-semibold text-destructive">{error}</p>}

            <div className="grid grid-cols-[1fr_11rem] gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Date
                <DatePicker value={purchaseDate} onValueChange={setPurchaseDate} className="w-full" />
              </Label>
            </div>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Raw input
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="item-select"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="h-11 w-full justify-between rounded-[var(--radius-md)] border-border bg-background px-3 text-[0.875rem] font-normal"
                  >
                    <span className={`truncate ${selectedItem ? '' : 'text-muted-foreground'}`}>
                      {selectedItem ? selectedItem.name : 'Search for a raw input…'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="flex items-center gap-2 border-b border-border px-3">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      autoFocus
                      value={comboQuery}
                      onChange={e => setComboQuery(e.target.value)}
                      placeholder="Search raw inputs…"
                      className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="max-h-[240px] overflow-auto p-1">
                    {comboFiltered.length === 0 && (
                      <p className="px-3 py-4 text-center text-sm text-muted-foreground">No raw inputs found.</p>
                    )}
                    {comboFiltered.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setItemId(String(p.id)); setComboQuery(p.name); setComboOpen(false) }}
                        className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left text-sm hover:bg-muted"
                      >
                        <Check className={`h-4 w-4 shrink-0 ${selectedItem?.id === p.id ? 'opacity-100' : 'opacity-0'}`} />
                        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{p.purchase_unit ?? 'kg'}</span>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-border p-1">
                    <button
                      type="button"
                      onClick={() => { setNestedError(''); setNestedName(comboQuery.trim()); setNestedUnit(''); setComboOpen(false); setAddNestedOpen(true) }}
                      className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left text-[0.875rem] font-medium text-primary hover:bg-muted"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-primary" />
                      Add new raw input{comboQuery.trim() ? `: "${comboQuery.trim()}"` : ''}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
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
                  : 'Select a raw input and enter cost to preview total'}
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
                This raw input yields sellable meals (e.g. whole chicken → Boiled + Fried)
              </Label>
            </div>

            {yieldEnabled && (
              <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-background p-4">
                {yieldRows.map((row, i) => {
                  const otherRows = yieldRows.filter((_, idx) => idx !== i)
                  const usableMeals = meals.filter(m => !otherRows.some(r => r.mealId && Number(r.mealId) === m.id))
                  const rowCost = computedTotal > 0 && totalPortions > 0 && row.mealId && !isNaN(parseFloat(row.portions))
                    ? Math.round((computedTotal * parseFloat(row.portions)) / totalPortions)
                    : 0
                  return (
                    <div key={i} className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border px-3 py-3">
                      <div className="grid grid-cols-[1fr_6rem] gap-3">
                        <Label className="flex flex-col gap-1 text-[0.8125rem] font-semibold">
                          Meal
                          <Select value={row.mealId} onValueChange={(v) => setYieldRow(i, { mealId: v })}>
                            <SelectTrigger className="h-10 w-full rounded-[var(--radius-md)]">
                              <SelectValue placeholder="Select meal..." />
                            </SelectTrigger>
                            <SelectContent>
                              {usableMeals.map(m => (
                                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Label>
                        <Label className="flex flex-col gap-1 text-[0.8125rem] font-semibold">
                          Portions
                          <Input
                            type="number"
                            placeholder="0"
                            min="1"
                            step="1"
                            value={row.portions}
                            onChange={e => setYieldRow(i, { portions: e.target.value })}
                            className="h-10 rounded-[var(--radius-md)] bg-background text-[0.875rem]"
                          />
                        </Label>
                      </div>
                      <div className="flex items-center justify-between">
                        {rowCost > 0 ? (
                          <span className="text-[0.8125rem] text-muted-foreground">
                            carries {fmt.format(rowCost)} ({fmt.format(Math.round(computedTotal / totalPortions))}/serving)
                          </span>
                        ) : (
                          <span className="text-[0.8125rem] text-muted-foreground">cost auto-split by portions</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeYieldRow(i)}
                          className="ml-auto grid h-6 w-6 place-items-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-muted"
                          aria-label="Remove yield"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
                <Button type="button" variant="outline" className="h-10 border-border bg-background font-semibold" onClick={addYieldRow}>
                  <Plus className="h-4 w-4" />
                  {yieldRows.length === 0 ? 'Add a yield (meal + portions)' : 'Add another meal'}
                </Button>
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

      {/* Nested add new raw input */}
      <Dialog open={addNestedOpen} onOpenChange={setAddNestedOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add new raw input</DialogTitle>
            <DialogDescription>Create a stock item so you can record purchases against it.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleNestedAdd} className="flex flex-col gap-4">
            {nestedError && <p className="m-0 font-semibold text-destructive">{nestedError}</p>}

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Name
              <Input autoFocus value={nestedName} onChange={e => setNestedName(e.target.value)} className={inputClass} placeholder="e.g. Whole Chicken" />
            </Label>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Unit (optional)
              <Input value={nestedUnit} onChange={e => setNestedUnit(e.target.value)} className={inputClass} placeholder="kg, bunch, box…" />
            </Label>

            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setAddNestedOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary font-semibold" disabled={!nestedName.trim() || nestedProcessing}>
                {nestedProcessing ? 'Saving...' : 'Add item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add meal */}
      <Dialog open={mealOpen} onOpenChange={setMealOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Meal</DialogTitle>
            <DialogDescription>Add a dish you sell on the POS. Its cost per serving updates automatically when you record a purchase that yields it.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddMeal} className="flex flex-col gap-4">
            {mealError && <p className="m-0 font-semibold text-destructive">{mealError}</p>}

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Meal name
              <Input autoFocus value={mealName} onChange={e => setMealName(e.target.value)} className={inputClass} placeholder="e.g. Boiled Chicken" />
            </Label>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Category
              <Select value={mealCatId} onValueChange={setMealCatId}>
                <SelectTrigger className="h-11 w-full rounded-[var(--radius-md)]">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {mealCats.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Selling price (UGX)
              <Input type="number" min="0" step="0.5" value={mealPrice} onChange={e => setMealPrice(e.target.value)} className={inputClass} placeholder="e.g. 8000" />
            </Label>

            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setMealOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary font-semibold" disabled={mealProcessing}>
                {mealProcessing ? 'Saving...' : 'Add Meal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}