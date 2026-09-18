import { useEffect, useMemo, useState } from 'react'
import { useInventory } from '../../hooks/useInventory'
import { useItems } from '../../hooks/useItems'
import { useCategories } from '../../hooks/useCategories'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { PaginationFooter } from '../../components/PaginationFooter'
import { usePagination } from '../../hooks/usePagination'
import { DatePicker } from '../../components/ui/date-picker'
import { DateRangeFilter } from '../../components/DateRangeFilter'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { Check, ChevronsUpDown, Package, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ItemPurchaseWithName } from '../../../shared/types'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })

export function InventoryPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const { items, retry: retryItems } = useItems({ kind: 'priced', activeOnly: true })
  const { categories, retry: retryCategories } = useCategories()
  const purchaseOnlyCatIds = useMemo(
    () => new Set(categories.filter(c => c.purchase_only === 1).map(c => c.id)),
    [categories]
  )
  const { purchases, dailyTotal, loading, record } = useInventory(dateFrom || today)
  const { userId } = useAuth()

  const purchasesPager = usePagination(purchases)

  const isStockItem = (categoryId: number) => purchaseOnlyCatIds.has(categoryId)
  const stockItems = items.filter(p => isStockItem(p.category_id))
  const pricedCats = categories.filter(c => c.kind === 'priced' && c.purchase_only !== 1)
  const itemsPager = usePagination(items)

  const [availability, setAvailability] = useState<Record<number, number | null>>({})
  useEffect(() => {
    const ids = items.map(i => i.id)
    if (ids.length === 0) return
    const getAvailability = (window.api as unknown as Record<string, ((itemIds: number[]) => Promise<Record<number, number | null>>) | undefined>)['inventory:stockAvailability']
    if (typeof getAvailability !== 'function') return
    getAvailability(ids)
      .then(result => setAvailability(prev => ({ ...prev, ...result })))
      .catch(() => { /* stock tracking unavailable — hide stock column values */ })
  }, [items])

  // Record purchase dialog
  const [open, setOpen] = useState(false)
  const [purchaseDate, setPurchaseDate] = useState(today)
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [costPerUnit, setCostPerUnit] = useState('')
  const [totalYield, setTotalYield] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const [comboOpen, setComboOpen] = useState(false)
  const [comboQuery, setComboQuery] = useState('')

  const [addNestedOpen, setAddNestedOpen] = useState(false)
  const [nestedName, setNestedName] = useState('')
  const [nestedUnit, setNestedUnit] = useState('')
  const [nestedError, setNestedError] = useState('')
  const [nestedProcessing, setNestedProcessing] = useState(false)

  // Add item dialog (stock item or meal)
  const [addOpen, setAddOpen] = useState(false)
  const [addKind, setAddKind] = useState<'stock' | 'meal'>('stock')
  const [addName, setAddName] = useState('')
  const [addCatId, setAddCatId] = useState('')
  const [addUnit, setAddUnit] = useState('kg')
  const [addUnitCost, setAddUnitCost] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [addError, setAddError] = useState('')
  const [addProcessing, setAddProcessing] = useState(false)

  const selectedItem = items.find(p => String(p.id) === itemId)
  const quantityNum = parseFloat(quantity)
  const costPerUnitNum = parseFloat(costPerUnit)
  const computedTotal =
    isNaN(quantityNum) || isNaN(costPerUnitNum) || quantityNum <= 0 || costPerUnitNum < 0
      ? 0
      : Math.round(quantityNum * costPerUnitNum)

  const comboFiltered = useMemo(() => {
    const q = comboQuery.trim().toLowerCase()
    const base = q ? stockItems.filter(p => p.name.toLowerCase().includes(q)) : stockItems
    return base.slice(0, 6)
  }, [stockItems, comboQuery])

  useEffect(() => {
    setCostPerUnit(selectedItem ? String(selectedItem.cost_price_cents) : '')
    if (selectedItem?.purchase_unit) setUnit(selectedItem.purchase_unit)
  }, [selectedItem])

  const resetRecordForm = () => {
    setItemId('')
    setQuantity('')
    setUnit('kg')
    setCostPerUnit('')
    setTotalYield('')
    setComboQuery('')
  }

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
    setProcessing(true)
    try {
      await record({
        item_id: Number(itemId),
        quantity: quantityNum,
        cost_cents: computedTotal,
        date: purchaseDate || today,
        created_by: userId ?? null,
        unit: unit.trim() || 'kg',
        total_yield: parseInt(totalYield) || 0,
      })
      resetRecordForm()
      setOpen(false)
    } catch (err) {
      setError((err as Error).message || 'Failed to record purchase')
    } finally {
      setProcessing(false)
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    const name = addName.trim()
    if (!name) {
      setAddError('Item name is required')
      return
    }
    setAddProcessing(true)
    try {
      if (addKind === 'stock') {
        if (isNaN(parseFloat(addUnitCost)) || parseFloat(addUnitCost) < 0) {
          setAddError('Enter a valid default unit cost')
          return
        }
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
      } else {
        if (!addCatId) {
          setAddError('Select a category')
          return
        }
        if (isNaN(parseFloat(addPrice)) || parseFloat(addPrice) < 0) {
          setAddError('Enter a valid selling price')
          return
        }
        await window.api['items:upsert']({
          category_id: Number(addCatId),
          name,
          selling_price_cents: Math.round(parseFloat(addPrice)),
          cost_price_cents: 0,
          active: 1,
        })
      }
      retryItems()
      setAddOpen(false)
      setAddName('')
      setAddCatId('')
      setAddUnit('kg')
      setAddUnitCost('')
      setAddPrice('')
    } catch (err) {
      setAddError((err as Error).message || 'Failed to add item')
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

  const stockLabel = (id: number): string => {
    const v = availability[id]
    if (v == null) return '—'
    return String(v)
  }

  const isOut = (id: number, flag: number): boolean =>
    flag === 1 || (availability[id] != null && (availability[id] as number) <= 0)

  const inputClass = 'h-11 rounded-[var(--radius-md)] bg-background text-[0.875rem]'

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex items-center gap-3">
          <span className="text-[0.9375rem] font-bold">Food Cost: {fmt.format(dailyTotal)}</span>
          <Button onClick={() => { setAddError(''); setAddKind('stock'); setAddCatId(''); setAddOpen(true) }} variant="outline" className="h-11 border-border bg-card font-semibold">
            + Add Item
          </Button>
          <Button onClick={() => { setError(''); setPurchaseDate(today); setOpen(true) }} className="bg-primary font-semibold">
            + Record Purchase
          </Button>
        </div>
      </div>

      <DateRangeFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onReset={() => { setDateFrom(''); setDateTo('') }}
      />

      <h2 className="text-lg font-bold">Purchases</h2>

      {loading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : purchases.length === 0 ? (
            <p className="p-12 text-center text-lg text-muted-foreground">
              No purchases recorded for this date.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
                <Table className="table-zebra">
                  <TableHeader>
                    <TableRow className="bg-card hover:bg-card">
                      <TableHead>Item</TableHead>
                      <TableHead>Total Yield</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchasesPager.slice.map((p: ItemPurchaseWithName) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold">{p.item_name ?? `Item #${p.item_id}`}</TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {p.total_yield > 0 ? `${p.total_yield} pcs` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {p.quantity_kg} {p.unit ?? 'kg'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmt.format(p.unit_cost_cents ?? p.cost_cents)}/{p.unit ?? 'kg'}
                        </TableCell>
                        <TableCell className="text-right font-bold">{fmt.format(p.cost_cents)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationFooter pager={purchasesPager} />
            </div>
          )}

      <h2 className="text-lg font-bold">Items</h2>

      {items.length === 0 ? (
            <p className="p-12 text-center text-lg text-muted-foreground">
              No items yet. Add a stock item or a meal to get started.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
                <Table className="table-zebra">
                  <TableHeader>
                    <TableRow className="bg-card hover:bg-card">
                      <TableHead>Item</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsPager.slice.map(m => {
                      const stock = isStockItem(m.category_id)
                      const out = isOut(m.id, m.out_of_stock)
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-semibold">{m.name}</TableCell>
                          <TableCell>
                            <span className={cn(
                              'rounded-full border px-2 py-0.5 text-[0.75rem] font-bold',
                              stock
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-success/40 bg-success/10 text-success'
                            )}>
                              {stock ? 'STOCK' : 'MEAL'}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{m.category_name}</TableCell>
                          <TableCell className="text-right font-bold">
                            {stock
                              ? <span className="font-normal text-muted-foreground">{fmt.format(m.cost_price_cents)}/{m.purchase_unit ?? 'kg'}</span>
                              : fmt.format(m.selling_price_cents)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{stockLabel(m.id)}</TableCell>
                          <TableCell>
                            {out && (
                              <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[0.75rem] font-bold text-warning">
                                OUT OF STOCK
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 border-border bg-background px-3 text-[0.8125rem] font-semibold"
                              onClick={() => toggleOutOfStock(m)}
                            >
                              {m.out_of_stock === 1 ? 'Mark in stock' : 'Mark out of stock'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <PaginationFooter pager={itemsPager} />
            </div>
          )}

      {/* Add item (stock or meal) */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
            <DialogDescription>
              A stock item is something you buy (e.g. whole chicken) and stays hidden from the POS. A meal is a dish you sell on the POS.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddItem} className="flex flex-col gap-4">
            {addError && <p className="m-0 font-semibold text-destructive">{addError}</p>}

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Name
              <Input value={addName} onChange={e => setAddName(e.target.value)} className={inputClass} placeholder="e.g. Whole Chicken" autoFocus />
            </Label>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Type
              <Select value={addKind} onValueChange={(v) => setAddKind(v as 'stock' | 'meal')}>
                <SelectTrigger className="h-11 w-full rounded-[var(--radius-md)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock item (bought, hidden from POS)</SelectItem>
                  <SelectItem value="meal">Meal (sold on POS)</SelectItem>
                </SelectContent>
              </Select>
            </Label>

            {addKind === 'stock' ? (
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
            ) : (
              <>
                <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                  Category
                  <Select value={addCatId} onValueChange={setAddCatId}>
                    <SelectTrigger className="h-11 w-full rounded-[var(--radius-md)]">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pricedCats.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>
                <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                  Selling price (UGX)
                  <Input type="number" min="0" step="0.5" value={addPrice} onChange={e => setAddPrice(e.target.value)} className={inputClass} placeholder="e.g. 8000" />
                </Label>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary font-semibold" disabled={addProcessing}>
                {addProcessing ? 'Saving...' : 'Add Item'}
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
              Log what you bought and its total yield (pieces/servings this purchase produces). Purchase date defaults to today.
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
              Stock item
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
                      {selectedItem ? selectedItem.name : 'Search for a stock item…'}
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
                      placeholder="Search stock items…"
                      className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="max-h-[240px] overflow-auto p-1">
                    {comboFiltered.length === 0 && (
                      <p className="px-3 py-4 text-center text-sm text-muted-foreground">No stock items found.</p>
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
                      Add new stock item{comboQuery.trim() ? `: "${comboQuery.trim()}"` : ''}
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
                  : 'Select a stock item and enter cost to preview total'}
              </span>
              <span className="ml-auto text-lg font-extrabold">
                {fmt.format(computedTotal)}
              </span>
            </div>

            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Total Yield (pieces/servings this purchase produces)
              <Input type="number" placeholder="0" value={totalYield} onChange={e => setTotalYield(e.target.value)} className={inputClass} min="0" step="1" />
            </Label>
            <DialogFooter>
              <Button type="submit" disabled={processing} className="bg-primary font-semibold">
                {processing ? 'Saving...' : 'Record Purchase'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Nested add new stock item */}
      <Dialog open={addNestedOpen} onOpenChange={setAddNestedOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add new stock item</DialogTitle>
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
    </div>
  )
}
